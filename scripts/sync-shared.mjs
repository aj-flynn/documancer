import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../packages/', import.meta.url));
const source = join(root, 'documancer');
const entries = ['assets', 'examples', 'references/data-contract.md', 'references/technical.md',
  'references/user-guide.md', 'references/uat.md', 'scripts/render.mjs', 'scripts/render.test.mjs'];
const check = process.argv.includes('--check');
if (process.argv.slice(2).some(arg => arg !== '--check')) throw new Error('Usage: node scripts/sync-shared.mjs [--check]');

async function files(path) {
  const entries = await readdir(join(source, path), { withFileTypes: true });
  const result = [];
  for (const entry of entries) {
    const relative = join(path, entry.name);
    result.push(...(entry.isDirectory() ? await files(relative) : [relative]));
  }
  return result;
}

const paths = [];
for (const entry of entries) paths.push(...(entry.includes('.') ? [entry] : await files(entry)));
let mismatches = 0;
for (const edition of ['documancer-opencode', 'documancer-cursor']) {
  for (const path of paths) {
    const content = await readFile(join(source, path));
    const target = join(root, edition, path);
    if (check) {
      let actual;
      try { actual = await readFile(target); } catch (error) { if (error.code !== 'ENOENT') throw error; }
      if (!actual?.equals(content)) { console.error(`Out of sync: ${edition}/${path}`); mismatches++; }
    } else {
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, content);
    }
  }
}
if (mismatches) process.exitCode = 1;
else console.log(check ? 'Shared resources match across all editions.' : 'Shared resources synchronized.');
