// Contract drift check: compares the contract (openapi.yaml in budget-tracker-specs) with the spec
// exported by this backend (npm run openapi:export).
//
// The contract may be AHEAD of the backend (contract-first), so only paths the backend implements
// are compared:
//   - contract paths/operations the backend does not implement yet -> notice, never a failure
//   - paths/operations implemented but missing from the contract   -> failure
//   - breaking differences on implemented paths (oasdiff, ERR)     -> failure
//
// Usage: node scripts/contract-drift.mjs <contract.yaml> <generated.json>
// Env:   OASDIFF  path to the oasdiff binary (default: oasdiff)
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const [contract, generated] = process.argv.slice(2);
if (!contract || !generated) {
  console.error('Usage: node scripts/contract-drift.mjs <contract.yaml> <generated.json>');
  process.exit(2);
}
const oasdiff = process.env.OASDIFF ?? 'oasdiff';
const inCi = process.env.GITHUB_ACTIONS === 'true';

function run(args) {
  const result = spawnSync(oasdiff, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (result.error) {
    console.error(`Cannot run ${oasdiff}: ${result.error.message}`);
    process.exit(2);
  }
  return result;
}

// 1. Which paths exist on each side (structural diff; contract is the base).
const structural = run(['diff', contract, generated, '-f', 'json']);
if (structural.status !== 0) {
  console.error(structural.stderr || structural.stdout);
  process.exit(2);
}
const pathsDiff = JSON.parse(structural.stdout || '{}').paths ?? {};
const unimplemented = [...(pathsDiff.deleted ?? [])];
const undocumented = [...(pathsDiff.added ?? [])];
for (const [path, item] of Object.entries(pathsDiff.modified ?? {})) {
  for (const method of item.operations?.deleted ?? []) unimplemented.push(`${method} ${path}`);
  for (const method of item.operations?.added ?? []) undocumented.push(`${method} ${path}`);
}

for (const path of unimplemented) {
  console.log(`${inCi ? '::notice::' : 'NOTICE: '}Contract endpoint not implemented yet: ${path}`);
}
let failed = false;
for (const path of undocumented) {
  console.log(`${inCi ? '::error::' : 'ERROR: '}Implemented endpoint missing from the contract: ${path}`);
  failed = true;
}

// 2. Compare only the paths the backend implements.
const implemented = Object.keys(JSON.parse(readFileSync(generated, 'utf8')).paths ?? {});
const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const matchPath = `^(${implemented.map(escape).join('|')})$`;
console.log(`Comparing implemented paths only: ${matchPath}`);

const breaking = run([
  'breaking', contract, generated, '--match-path', matchPath, '--fail-on', 'ERR',
]);
process.stdout.write(breaking.stdout);
process.stderr.write(breaking.stderr);
if (breaking.status !== 0) failed = true;

// 3. Informational: full structural differences on implemented paths.
const info = run(['diff', contract, generated, '--match-path', matchPath, '-f', 'text']);
console.log('--- oasdiff diff (informational) ---');
process.stdout.write(info.stdout);

if (failed) {
  console.error('Contract drift detected: fix the backend or update the contract (docs/COLABORACION.md section 4).');
  process.exit(1);
}
console.log('No contract drift on implemented endpoints.');
