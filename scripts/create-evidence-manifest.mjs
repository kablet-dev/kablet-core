import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const outputFlag = process.argv.indexOf('--output');
const output = outputFlag >= 0 ? process.argv[outputFlag + 1] : 'milestone-01-evidence.json';
if (!output || output.startsWith('-')) throw new Error('--output requires a file path');

function command(args) {
  try { return execFileSync(args[0], args.slice(1), { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
  catch { return null; }
}

const manifest = {
  schemaVersion: 'kablet-evidence.v1',
  generatedAt: new Date().toISOString(),
  repository: { commit: process.env.GITHUB_SHA ?? command(['git', 'rev-parse', 'HEAD']), branch: process.env.GITHUB_REF_NAME ?? command(['git', 'branch', '--show-current']) },
  toolchain: { packageManager: 'pnpm@11.19.0', node: process.version },
  scope: 'Milestone 01 — repository baseline, testability, and engineering discipline',
  commands: ['pnpm run typecheck', 'pnpm run lint', 'pnpm run test -- --reporter=dot', 'pnpm run build'],
  externalControls: { branchProtection: 'repository guidance only; verify in GitHub', database: 'no database operations are performed by this manifest' },
};

writeFileSync(output, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(`Evidence manifest written to ${output}`);
