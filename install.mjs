#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const [environment, ...args] = process.argv.slice(2);
const editions = { codex: 'documancer', opencode: 'documancer-opencode', cursor: 'documancer-cursor' };
if (!Object.hasOwn(editions, environment)) {
  console.error('Usage: node install.mjs <codex|opencode|cursor> <existing-project-root> [--agents] [--check]');
  process.exitCode = 1;
} else {
  const script = fileURLToPath(new URL(`./packages/${editions[environment]}/install.mjs`, import.meta.url));
  const result = spawnSync(process.execPath, [script, ...args], { stdio: 'inherit' });
  if (result.error) console.error(result.error.message);
  process.exitCode = result.status ?? 1;
}
