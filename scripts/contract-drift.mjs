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
//
// Exit codes (fail closed: the check never passes without having actually run):
//   0  no drift on implemented endpoints
//   1  drift detected
//   2  the check could not run: bad usage, oasdiff missing or failing, or output that cannot be parsed
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const EXIT_DRIFT = 1;
const EXIT_CANNOT_RUN = 2;

function cannotRun(message) {
  console.error(`Contract drift check could not run: ${message}`);
  process.exit(EXIT_CANNOT_RUN);
}

const [contract, generated] = process.argv.slice(2);
if (!contract || !generated) {
  console.error('Usage: node scripts/contract-drift.mjs <contract.yaml> <generated.json>');
  process.exit(EXIT_CANNOT_RUN);
}
const oasdiff = process.env.OASDIFF ?? 'oasdiff';
const inCi = process.env.GITHUB_ACTIONS === 'true';

function run(args) {
  const result = spawnSync(oasdiff, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (result.error) {
    cannotRun(
      `cannot execute "${oasdiff}" (${result.error.message}). Install oasdiff ` +
        '(https://github.com/oasdiff/oasdiff/releases) and put it on PATH, or set OASDIFF to its path.',
    );
  }
  if (result.status === null) {
    cannotRun(`"${oasdiff}" was terminated by signal ${result.signal}.`);
  }
  return result;
}

// 1. Which paths exist on each side (structural diff; contract is the base).
const structural = run(['diff', contract, generated, '-f', 'json']);
if (structural.status !== 0) {
  cannotRun(`oasdiff diff failed: ${structural.stderr || structural.stdout}`);
}
let pathsDiff;
try {
  const parsed = JSON.parse(structural.stdout || '{}');
  if (parsed === null || typeof parsed !== 'object') throw new Error('not a JSON object');
  pathsDiff = parsed.paths ?? {};
} catch (error) {
  cannotRun(`oasdiff output could not be parsed (${error.message}).`);
}
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
let implemented;
try {
  implemented = Object.keys(JSON.parse(readFileSync(generated, 'utf8')).paths ?? {});
} catch (error) {
  cannotRun(`cannot read the generated spec ${generated} (${error.message}).`);
}
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
if (info.status !== 0) {
  cannotRun(`oasdiff diff failed: ${info.stderr || info.stdout}`);
}

if (failed) {
  console.error('Contract drift detected: fix the backend or update the contract (docs/COLABORACION.md section 4).');
  process.exit(EXIT_DRIFT);
}
console.log('No contract drift on implemented endpoints.');
