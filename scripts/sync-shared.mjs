// Copies the shared files from the canonical edition (packages/documancer) into the other editions.
// Run with --check to report drift without writing.
import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const packagesRoot = fileURLToPath(new URL('../packages/', import.meta.url));
const canonical = join(packagesRoot, 'documancer');
const otherEditions = ['documancer-opencode', 'documancer-cursor'];

// Directories are listed recursively; entries with an extension are single files.
const SHARED = [
  'assets',
  'examples',
  'install.mjs',
  'references/data-contract.md',
  'references/technical.md',
  'references/user-guide.md',
  'references/uat.md',
  'scripts/diagram.mjs',
  'scripts/install-agents.mjs',
  'scripts/installer.mjs',
  'scripts/render.mjs',
  'scripts/render.test.mjs',
  'scripts/util.mjs',
  'scripts/validate.mjs',
];

const check = process.argv.includes('--check');
if (process.argv.slice(2).some(arg => arg !== '--check')) {
  throw new Error('Usage: node scripts/sync-shared.mjs [--check]');
}

async function listFiles(path) {
  const found = [];
  for (const entry of await readdir(join(canonical, path), { withFileTypes: true })) {
    const relative = join(path, entry.name);
    found.push(...(entry.isDirectory() ? await listFiles(relative) : [relative]));
  }
  return found;
}

async function readIfPresent(path) {
  try { return await readFile(path); }
  catch (error) { if (error.code === 'ENOENT') return undefined; throw error; }
}

const files = [];
for (const entry of SHARED) files.push(...(entry.includes('.') ? [entry] : await listFiles(entry)));

let outOfSync = 0;
for (const edition of otherEditions) {
  for (const file of files) {
    const content = await readFile(join(canonical, file));
    const target = join(packagesRoot, edition, file);
    if (check) {
      if (!(await readIfPresent(target))?.equals(content)) {
        console.error(`Out of sync: ${edition}/${file}`);
        outOfSync++;
      }
    } else {
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, content);
    }
  }
}

if (outOfSync) process.exitCode = 1;
else console.log(check ? 'Shared resources match across all editions.' : 'Shared resources synchronized.');
