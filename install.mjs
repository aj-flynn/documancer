#!/usr/bin/env node
// Dispatches to the installer inside the chosen edition's package.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const EDITIONS = {
  claude: 'documancer-claude',
  codex: 'documancer',
  cursor: 'documancer-cursor',
  opencode: 'documancer-opencode',
};

const [environment, ...args] = process.argv.slice(2);

if (!Object.hasOwn(EDITIONS, environment)) {
  console.error('Usage: node install.mjs <claude|codex|cursor|opencode> <existing-project-root> [--agents] [--check]');
  process.exitCode = 1;
} else {
  const script = fileURLToPath(new URL(`./packages/${EDITIONS[environment]}/install.mjs`, import.meta.url));
  const result = spawnSync(process.execPath, [script, ...args], { stdio: 'inherit' });
  if (result.error) console.error(result.error.message);
  process.exitCode = result.status ?? 1;
}
