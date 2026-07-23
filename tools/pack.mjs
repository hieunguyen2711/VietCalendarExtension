/*
 * Build a clean Chrome Web Store upload ZIP.
 *
 *   node tools/pack.mjs
 *
 * Includes only what the extension loads at runtime — manifest, icons, and the
 * src/ modules. Excludes tests, tooling, docs, git, and the re-export stub, so
 * nothing dev-only ships to users. Re-run this for every store update.
 *
 * Uses the system `zip` (present on macOS/Linux) via execFileSync; no npm deps.
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'dist');

// Everything the manifest references, and nothing else.
const INCLUDE = ['manifest.json', 'icons', 'src'];

// Defense-in-depth: never let these ride along even if nested in an included dir.
const EXCLUDE_GLOBS = ['*.test.js', '*.md', '.DS_Store', 'package.json', '*.pem'];

function version() {
  const m = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
  return m.version;
}

fs.mkdirSync(OUT, { recursive: true });
const zipPath = path.join(OUT, `viet-calendar-v${version()}.zip`);
fs.rmSync(zipPath, { force: true });

// Verify every included path exists before zipping.
for (const p of INCLUDE) {
  if (!fs.existsSync(path.join(ROOT, p))) {
    console.error(`Missing required path: ${p}`);
    process.exit(1);
  }
}

const args = ['-r', '-X', zipPath, ...INCLUDE];
for (const g of EXCLUDE_GLOBS) args.push('-x', `*/${g}`, '-x', g);

execFileSync('zip', args, { cwd: ROOT, stdio: 'inherit' });

// Report what actually landed in the archive.
const listing = execFileSync('unzip', ['-l', zipPath], { cwd: ROOT, encoding: 'utf8' });
console.log('\n' + listing);
console.log(`\nWrote ${path.relative(ROOT, zipPath)}`);
