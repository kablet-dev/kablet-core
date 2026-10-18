import { loadEnvFile } from 'node:process';
import { join } from 'node:path';
import { spawn, type ChildProcess } from 'node:child_process';
import net from 'node:net';
import { chromium } from '@playwright/test';
import { provisionBrowserDatabase, seedSolenneDemo } from '../tests/e2e/support/disposable-postgres';

if (process.env.NODE_ENV !== 'production') {
  try { loadEnvFile('.env'); } catch { /* local .env is optional when variables are already exported */ }
}

function pnpmLauncher(): { command: string; prefix: string[] } {
  if (process.platform !== 'win32') return { command: 'pnpm', prefix: [] };
  const npmRoot = process.env.APPDATA;
  if (!npmRoot) throw new Error('APPDATA is required to locate the Windows pnpm launcher');
  return { command: process.execPath, prefix: [join(npmRoot, 'npm', 'node_modules', 'pnpm', 'bin', 'pnpm.mjs')] };
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') return reject(new Error('could not allocate preview port'));
      server.close(error => error ? reject(error) : resolve(address.port));
    });
  });
}

function redactServerOutput(value: string): string {
  return value
    .replace(/postgres(?:ql)?:\/\/[^\s]+/gi, 'postgres://[redacted]')
    .replace(/(KABLET_[A-Z0-9_]+|DATABASE_URL|CONTROL_DATABASE_URL)=[^\s]+/g, '$1=[redacted]');
}

function captureServerOutput(child: ChildProcess): { tail: () => string } {
  const lines: string[] = [];
  const append = (chunk: Buffer | string) => {
    const text = redactServerOutput(String(chunk));
    for (const line of text.split(/\r?\n/)) {
      if (!line) continue;
      lines.push(line);
      if (lines.length > 40) lines.shift();
      console.log(`[next] ${line}`);
    }
  };
  child.stdout?.on('data', append);
  child.stderr?.on('data', append);
  return { tail: () => lines.join('\n') || '(no child output captured)' };
}

async function waitForServer(url: string, child: ChildProcess, outputTail: () => string): Promise<void> {
  const startedAt = Date.now();
  let lastProbe = 'not attempted';
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (child.exitCode !== null) {
      throw new Error(`preview server exited before readiness (exit=${child.exitCode}, elapsedMs=${Date.now() - startedAt}, lastProbe=${lastProbe})\n${outputTail()}`);
    }
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1000) });
      lastProbe = `HTTP ${response.status}`;
      if (response.ok) {
        console.log(`preview readiness confirmed after ${attempt + 1} attempts (${Date.now() - startedAt}ms, ${lastProbe})`);
        return;
      }
    } catch (error) {
      lastProbe = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    }
    if ((attempt + 1) % 10 === 0) console.log(`waiting for preview readiness: attempt=${attempt + 1}, elapsedMs=${Date.now() - startedAt}, lastProbe=${lastProbe}`);
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error(`preview server did not become ready (elapsedMs=${Date.now() - startedAt}, lastProbe=${lastProbe})\n${outputTail()}`);
}

async function verifyPreview(baseUrl: string): Promise<void> {
  const storeResponse = await fetch(`${baseUrl}/store/solenne-demo`);
  if (storeResponse.status !== 200) throw new Error(`SOLENNE storefront returned HTTP ${storeResponse.status}`);
  const storeMarkup = await storeResponse.text();

  const imageNames = ['daily-hydration-serum', 'barrier-comfort-cream', 'gentle-cleansing-gel', 'vitamin-c-radiance-serum', 'overnight-nourishing-mask'];
  for (const name of imageNames) {
    const response = await fetch(`${baseUrl}/demo/solenne/products/${name}.png`);
    if (response.status !== 200) throw new Error(`SOLENNE media returned HTTP ${response.status}: ${name}`);
  }

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    // The first Next dev compilation can take longer than Playwright's 30s
    // navigation default on a cold Windows workspace. The HTTP health and
    // storefront checks above remain authoritative; this browser smoke check
    // only needs enough time to observe the rendered catalog.
    page.setDefaultNavigationTimeout(120_000);
    await page.goto(`${baseUrl}/store/solenne-demo`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
    await page.getByRole('heading', { name: 'SOLENNE' }).waitFor({ state: 'visible', timeout: 120_000 });
    if (await page.getByRole('button', { name: 'Help me find something' }).count() !== 1) throw new Error('SOLENNE entry action did not hydrate');
    for (const title of ['Daily Hydration Serum', 'Barrier Comfort Cream', 'Gentle Cleansing Gel', 'Vitamin C Radiance Serum', 'Overnight Nourishing Mask']) {
      if (!storeMarkup.includes(title)) throw new Error(`SOLENNE storefront omitted persisted product: ${title}`);
    }
    for (const name of imageNames) {
      if (!storeMarkup.includes(`/demo/solenne/products/${name}.png`)) throw new Error(`SOLENNE storefront omitted persisted media reference: ${name}`);
    }
  } finally {
    await browser.close();
  }
}

async function terminate(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null) return;
  if (process.platform === 'win32' && child.pid) {
    await new Promise<void>(resolve => {
      const killer = spawn('taskkill.exe', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore' });
      killer.once('exit', () => resolve());
    });
  } else if (child.pid) {
    process.kill(-child.pid, 'SIGTERM');
  }
}

async function main(): Promise<void> {
  const database = await provisionBrowserDatabase();
  let server: ChildProcess | undefined;
  let cleaning = false;
  const cleanup = async () => {
    if (cleaning) return;
    cleaning = true;
    if (server) await terminate(server).catch(() => undefined);
    await database.cleanup();
    console.log('SOLENNE preview stopped and disposable database removed.');
  };
  process.once('SIGINT', () => { void cleanup().finally(() => process.exit(0)); });
  process.once('SIGTERM', () => { void cleanup().finally(() => process.exit(0)); });

  try {
    const port = await freePort();
    const baseUrl = `http://127.0.0.1:${port}`;
    await seedSolenneDemo(database, baseUrl);
    const environment = {
      ...process.env,
      NODE_ENV: 'development',
      DATABASE_URL: database.runtimeUrl,
      CONTROL_DATABASE_URL: database.controlUrl,
      KABLET_CREDENTIAL_KEY: database.credentialKey,
      KABLET_CREDENTIAL_KEY_VERSION: database.credentialKeyVersion,
      KABLET_INTERACTION_ORGANIZATION_ID: database.organizationId,
      KABLET_INTERACTION_BUSINESS_ID: database.businessId,
      KABLET_INTERACTION_COOKIE_SECRET: database.cookieSecret,
      KABLET_INTERACTION_ENABLE_DEMO_INTERPRETER: 'true',
      KABLET_PUBLIC_ORIGIN: baseUrl,
      PORT: String(port),
    };
    const launcher = pnpmLauncher();
    server = spawn(launcher.command, [...launcher.prefix, '--filter', '@kablet/web', 'dev', '--hostname', '127.0.0.1'], { env: environment, stdio: ['ignore', 'pipe', 'pipe'], detached: process.platform !== 'win32' });
    const output = captureServerOutput(server);
    await waitForServer(`${baseUrl}/api/health`, server, output.tail);
    await verifyPreview(baseUrl);
    console.log(`SOLENNE preview ready: ${baseUrl}/store/solenne-demo`);
    console.log('Press Ctrl+C in this terminal to stop the server and remove the disposable database.');
    await new Promise<void>(() => undefined);
  } catch (error) {
    await cleanup();
    throw error;
  }
}

main().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
