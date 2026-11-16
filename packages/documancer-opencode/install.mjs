#!/usr/bin/env node
import { cp, lstat, mkdir, readFile, realpath, rename, rm } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { installAgents } from './scripts/install-agents.mjs';

const skillRoot = dirname(fileURLToPath(import.meta.url));
const entries = [
  'SKILL.md', 'README.md', 'INSTALL.md', 'USAGE.md', 'package.json', 'install.mjs',
  'assets', 'examples', 'references', 'subagents',
];
const scriptEntries = ['render.mjs', 'diagram.mjs', 'preview.mjs', 'install-agents.mjs'];

async function inspect(path) {
  try { return await lstat(path); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

async function requireRealDirectory(path) {
  const stat = await inspect(path);
  if (!stat || stat.isSymbolicLink() || !stat.isDirectory()) {
    throw new Error(`Expected an existing, real directory: ${path}`);
  }
}

async function allowMissingRealDirectory(path) {
  const stat = await inspect(path);
  if (stat && (stat.isSymbolicLink() || !stat.isDirectory())) {
    throw new Error(`Expected a real directory or no entry: ${path}`);
  }
}

// The name and version a skill folder declares, or null when it is not a Documancer package.
async function packageInfo(folder) {
  try {
    const { name, version } = JSON.parse(await readFile(join(folder, 'package.json'), 'utf8'));
    return typeof name === 'string' && /^\d+\.\d+\.\d+$/.test(version) ? { name, version } : null;
  } catch { return null; }
}
const newer = (a, b) => a.split('.').map(Number).reduce((order, part, i) => order || part - b.split('.')[i], 0) > 0;

async function main() {
  const args = process.argv.slice(2);
  const check = args.includes('--check');
  const agents = args.includes('--agents');
  const upgrade = args.includes('--upgrade');
  const projects = args.filter(arg => !arg.startsWith('--'));
  if (projects.length !== 1 || args.some(arg => arg.startsWith('--') && !['--check', '--agents', '--upgrade'].includes(arg))) {
    throw new Error('Usage: node documancer/install.mjs <existing-project-root> [--agents] [--upgrade] [--check]');
  }

  const requestedRoot = resolve(projects[0]);
  await requireRealDirectory(requestedRoot);
  const projectRoot = await realpath(requestedRoot);
  const agentsRoot = join(projectRoot, '.opencode');
  const skillsRoot = join(agentsRoot, 'skills');
  const destination = join(skillsRoot, 'documancer');
  await allowMissingRealDirectory(agentsRoot);
  await allowMissingRealDirectory(skillsRoot);
  const legacy = join(skillsRoot, 'forest-documentation');
  if (await inspect(legacy)) {
    throw new Error(`Previous skill is still installed; review and migrate it before installing Documancer: ${legacy}`);
  }
  // An upgrade builds the new skill beside the backups, outside every skill discovery folder, then swaps it with the
  // installed one. Until that swap the installed skill is untouched.
  let backup;
  if (upgrade) {
    const installed = await packageInfo(destination), current = await packageInfo(skillRoot);
    if (!current) throw new Error('Incomplete skill archive; missing or invalid package.json');
    if (!installed) throw new Error(`Nothing to upgrade: no installed Documancer skill at ${destination}`);
    if (installed.name !== current.name) throw new Error(`A different edition is installed (${installed.name}); remove it or upgrade with that edition`);
    if (newer(installed.version, current.version)) throw new Error(`The installed skill (${installed.version}) is newer than this package (${current.version})`);
    backup = join(agentsRoot, 'documancer-backups', `documancer-${installed.version}-${new Date().toISOString().replace(/\D/g, '').slice(0, 14)}`);
    await allowMissingRealDirectory(dirname(backup));
    if (await inspect(backup)) throw new Error(`Backup destination already exists: ${backup}`);
  } else if (await inspect(destination)) {
    throw new Error(`Skill destination already exists; pass --upgrade to replace an older Documancer, or review it first: ${destination}`);
  }
  for (const entry of entries) if (!await inspect(join(skillRoot, entry))) {
    throw new Error(`Incomplete skill archive; missing ${entry}`);
  }
  for (const entry of scriptEntries) if (!await inspect(join(skillRoot, 'scripts', entry))) {
    throw new Error(`Incomplete skill archive; missing scripts/${entry}`);
  }
  // During an upgrade a profile the previous version installed is replaced; one that was edited since still stops the run.
  const agentPlan = agents ? await installAgents(projectRoot, { check: true, previous: upgrade ? join(destination, 'subagents') : undefined }) : [];
  if (check) {
    console.log(JSON.stringify({ skill: `would ${upgrade ? 'upgrade' : 'create'} ${destination}`, ...(backup ? { backup: `would move the installed skill to ${backup}` } : {}), agents: upgrade && !agents ? 'not checked; pass --agents to update installed profiles' : agentPlan }, null, 2));
    return;
  }

  await mkdir(skillsRoot, { recursive: true });
  await allowMissingRealDirectory(agentsRoot);
  await allowMissingRealDirectory(skillsRoot);
  const target = backup ? join(dirname(backup), 'incoming') : destination;
  if (backup) {
    await mkdir(dirname(backup), { recursive: true });
    await allowMissingRealDirectory(dirname(backup));
    await rm(target, { recursive: true, force: true });
  }
  try {
    await mkdir(target);
    for (const entry of entries) {
      await cp(join(skillRoot, entry), join(target, entry), { recursive: true, force: false, errorOnExist: true });
    }
    await mkdir(join(target, 'scripts'));
    for (const entry of scriptEntries) {
      await cp(join(skillRoot, 'scripts', entry), join(target, 'scripts', entry), { force: false, errorOnExist: true });
    }
    if (backup) {
      await rename(destination, backup);
      try { await rename(target, destination); }
      catch (error) { await rename(backup, destination); throw error; }
    }
  } catch (error) {
    // A failed upgrade leaves the installed skill as it was and nothing half-built beside the backups.
    if (backup) await rm(target, { recursive: true, force: true });
    throw error;
  }
  const installedAgents = agents ? await installAgents(projectRoot, { previous: backup ? join(backup, 'subagents') : undefined }) : [];
  console.log(JSON.stringify({ skill: destination, ...(backup ? { backup } : {}), agents: backup && !agents ? 'not touched; pass --agents to update installed profiles' : installedAgents }, null, 2));
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
