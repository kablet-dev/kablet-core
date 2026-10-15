import { writeFile, unlink, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import net from 'node:net';
import pg from 'pg';
import { loadTestManagerConfig } from '@kablet/config';
import { provisionBrowserDatabase } from './support/disposable-postgres';

function run(command: string, args: string[], env: NodeJS.ProcessEnv) {
  return new Promise<number>((resolve, reject) => {
    const child = spawn(command, args, { env, stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', (code, signal) => resolve(signal ? 1 : (code ?? 1)));
  });
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') return reject(new Error('could not allocate E2E port'));
      server.close(error => error ? reject(error) : resolve(address.port));
    });
  });
}

function pnpmLauncher(): { command: string; prefix: string[] } {
  if (process.platform !== 'win32') return { command: 'pnpm', prefix: [] };
  const npmRoot = process.env.APPDATA;
  if (!npmRoot) throw new Error('APPDATA is required to locate the Windows pnpm launcher');
  return { command: process.execPath, prefix: [join(npmRoot, 'npm', 'node_modules', 'pnpm', 'bin', 'pnpm.mjs')] };
}

async function terminate(child: ReturnType<typeof spawn>, port: number) {
  const waitForExit = () => new Promise<void>((resolve, reject) => {
    if (child.exitCode !== null) { resolve(); return; }
    const timer = setTimeout(() => reject(new Error('owned web server did not exit after termination')), 15000);
    child.once('exit', () => { clearTimeout(timer); resolve(); });
  });
  if (process.platform === 'win32' && child.pid) {
    await run('taskkill.exe', ['/pid', String(child.pid), '/t', '/f'], process.env);
  } else {
    if (child.pid) process.kill(-child.pid, 'SIGTERM');
    else child.kill('SIGTERM');
  }
  try { await waitForExit(); } catch {
    if (process.platform === 'win32' && child.pid) await run('taskkill.exe', ['/pid', String(child.pid), '/t', '/f'], process.env);
    else if (child.pid) process.kill(-child.pid, 'SIGKILL');
    else child.kill('SIGKILL');
    await waitForExit().catch(() => undefined);
  }
  try { await waitForPortClosed(port); } catch {
    if (process.platform === 'win32' && child.pid) await run('taskkill.exe', ['/pid', String(child.pid), '/t', '/f'], process.env);
    else if (child.pid) process.kill(-child.pid, 'SIGKILL');
    else child.kill('SIGKILL');
    await waitForPortClosed(port);
  }
}

async function waitForPortClosed(port: number): Promise<void> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const open = await new Promise<boolean>(resolve => {
      const probe = net.createConnection({ host: '127.0.0.1', port });
      probe.once('connect', () => { probe.destroy(); resolve(true); });
      probe.once('error', () => resolve(false));
      probe.setTimeout(500, () => { probe.destroy(); resolve(false); });
    });
    if (!open) return;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error(`owned web server port ${port} remained open after termination`);
}

async function databaseExists(database: string): Promise<boolean> {
  const manager = loadTestManagerConfig();
  const pool = new pg.Pool({ host: manager.TEST_MANAGER_HOST, port: manager.TEST_MANAGER_PORT, user: manager.TEST_MANAGER_USER, password: manager.TEST_MANAGER_PASSWORD, database: manager.TEST_MANAGER_DATABASE, max: 1 });
  try {
    const result = await pool.query('select 1 from pg_database where datname=$1', [database]);
    return result.rowCount === 1;
  } finally { await pool.end(); }
}

async function exists(path: string): Promise<boolean> {
  try { await access(path); return true; } catch { return false; }
}

async function waitForServer(url: string, child: ReturnType<typeof spawn>) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`web server exited before readiness (${child.exitCode})`);
    try { await fetch(url); return; } catch { await new Promise(resolve => setTimeout(resolve, 500)); }
  }
  throw new Error('web server did not become ready');
}

async function warmDevelopmentRoutes(baseURL: string): Promise<void> {
  for (const path of ['/experience/interactive', '/api/interaction/resume', '/api/interaction/intent', '/api/interaction/offering', '/api/interaction/contact', '/api/interaction/action']) {
    const response = await fetch(`${baseURL}${path}`, { method: 'GET' });
    if (response.status === 500) throw new Error(`web server failed while compiling ${path}`);
  }
}

async function main() {
  const runId = randomUUID();
  const database = await provisionBrowserDatabase();
  const disposableIdentity = /^kablet_e2e_[a-f0-9]+$/i.test(database.database);
  let server: ReturnType<typeof spawn> | undefined;
  let stateFile: string | undefined;
  let primaryError: unknown;
  const cleanupErrors: unknown[] = [];
  let serverStopped = false;
  let serverPort = 'unassigned';
  try {
    if (!disposableIdentity) throw new Error('refusing to clean up a non-disposable database');
    const port = await freePort();
    serverPort = String(port);
    const baseURL = `http://127.0.0.1:${port}`;
    stateFile = join(tmpdir(), `kablet-e2e-${database.database}.json`);
    const environment = {
      ...process.env,
      NODE_ENV: 'development',
      DATABASE_URL: database.runtimeUrl,
      TEST_DATABASE_URL: database.runtimeUrl,
      CONTROL_DATABASE_URL: database.controlUrl,
      KABLET_INTERACTION_ORGANIZATION_ID: database.organizationId,
      KABLET_INTERACTION_BUSINESS_ID: database.businessId,
      KABLET_INTERACTION_COOKIE_SECRET: database.cookieSecret,
      KABLET_INTERACTION_ENABLE_DEMO_INTERPRETER: 'true',
      KABLET_E2E_STATE_FILE: stateFile,
      PORT: String(port),
      KABLET_E2E_BASE_URL: baseURL,
    };
    await writeFile(stateFile, JSON.stringify({ database: database.database, organizationId: database.organizationId, businessId: database.businessId, offeringId: database.offeringId, offeringRevisionId: database.offeringRevisionId, definitionId: database.definitionId, runtimeUrl: database.runtimeUrl }));
    const launcher = pnpmLauncher();
    server = spawn(launcher.command, [...launcher.prefix, '--filter', '@kablet/web', 'dev'], { env: environment, stdio: 'inherit', detached: process.platform !== 'win32' });
    await waitForServer(baseURL, server);
    await warmDevelopmentRoutes(baseURL);
    const result = await run(launcher.command, [...launcher.prefix, 'exec', 'playwright', 'test'], environment);
    if (result !== 0) throw new Error(`Playwright exited with status ${result}`);
  } catch (error) {
    primaryError = error;
  } finally {
    try {
      if (server) await terminate(server, Number(serverPort));
      serverStopped = !server || serverPort !== 'unassigned';
      if (!serverStopped) cleanupErrors.push(new Error('owned server process did not exit'));
    } catch (error) { cleanupErrors.push(error); }
    if (disposableIdentity) {
      try { await database.cleanup(); } catch (error) { cleanupErrors.push(error); }
    } else {
      cleanupErrors.push(new Error('disposable database identity was not established'));
    }
    if (stateFile) await unlink(stateFile).catch(error => cleanupErrors.push(error));
    let databaseStillExists = true;
    try { databaseStillExists = await databaseExists(database.database); } catch (error) { cleanupErrors.push(error); }
    const stateStillExists = stateFile ? await exists(stateFile) : true;
    const databaseAbsent = !databaseStillExists;
    const stateFileAbsent = !stateStillExists;
    const overallCleanup = cleanupErrors.length === 0 && serverStopped && databaseAbsent && stateFileAbsent;
    console.log(`E2E cleanup receipt: run=${runId} database=${database.database} port=${serverPort} databaseAbsent=${databaseAbsent} stateFileAbsent=${stateFileAbsent} serverStopped=${serverStopped} overall=${overallCleanup ? 'PASS' : 'FAIL'}`);
    if (!databaseAbsent) cleanupErrors.push(new Error('disposable database still exists after cleanup'));
    if (!stateFileAbsent) cleanupErrors.push(new Error('temporary state file still exists after cleanup'));
    if (!serverStopped) cleanupErrors.push(new Error('owned server is still running after cleanup'));
  }
  if (primaryError || cleanupErrors.length > 0) {
    const primaryMessage = primaryError instanceof Error ? primaryError.message : primaryError ? String(primaryError) : 'none';
    const cleanupMessage = cleanupErrors.length > 0 ? `; cleanup failures: ${cleanupErrors.map(error => error instanceof Error ? error.message : String(error)).join(' | ')}` : '';
    throw new Error(`E2E run failed: ${primaryMessage}${cleanupMessage}`);
  }
}

main().catch(error => {
  console.error('E2E orchestration failed:', error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
