// Project-local installer shared by every Documancer edition. An edition supplies its folder layout and
// profile format in scripts/edition.mjs; nothing here touches global or project configuration.
import { cp, lstat, mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const AGENT_NAMES = ['documancer-map', 'documancer-analyze', 'documancer-write', 'documancer-review'];

const packageRoot = fileURLToPath(new URL('../', import.meta.url));
const subagentSource = new URL('../subagents/', import.meta.url);

const SKILL_ENTRIES = [
  'SKILL.md', 'README.md', 'INSTALL.md', 'USAGE.md', 'package.json', 'install.mjs',
  'assets', 'examples', 'references', 'subagents',
];
const SCRIPT_ENTRIES = [
  'render.mjs', 'validate.mjs', 'diagram.mjs', 'util.mjs',
  'installer.mjs', 'install-agents.mjs', 'edition.mjs',
];

export const hasFrontmatter = text => text.replaceAll('\r\n', '\n').startsWith('---\n');

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

async function resolveProject(projectRoot) {
  const requested = resolve(projectRoot);
  await requireRealDirectory(requested);
  return realpath(requested);
}

/**
 * Plans, and unless `check` is set performs, the optional agent profile installation.
 * Every conflict is found before any file is written; exclusive writes stop silent overwrites.
 */
export async function installAgents(edition, projectRoot, { check = false } = {}) {
  const root = await resolveProject(projectRoot);
  const parent = join(root, edition.agentParent);
  const destination = join(parent, 'agents');
  await allowMissingRealDirectory(parent);
  await allowMissingRealDirectory(destination);

  for (const name of AGENT_NAMES) {
    const legacy = join(destination, `${name.replace('documancer-', 'forest-docs-')}.${edition.agentExtension}`);
    if (await inspect(legacy)) {
      throw new Error(`Previous agent profile is still installed; review and migrate it first: ${legacy}`);
    }
  }

  const plan = [];
  for (const name of AGENT_NAMES) {
    const text = await readFile(new URL(`${name}.${edition.agentExtension}`, subagentSource), 'utf8');
    if (!edition.isValidProfile(text, name)) throw new Error(`Invalid ${edition.label} agent profile: ${name}`);
    const target = join(destination, `${name}.${edition.agentExtension}`);
    const stat = await inspect(target);
    if (stat && (stat.isSymbolicLink() || !stat.isFile())) {
      throw new Error(`Refusing linked or non-file target: ${target}`);
    }
    if (stat && (await readFile(target, 'utf8')) !== text) {
      throw new Error(`Existing agent differs; review and merge it explicitly before installing: ${target}`);
    }
    plan.push({ target, text, action: stat ? 'unchanged' : 'create' });
  }

  if (!check) {
    await mkdir(destination, { recursive: true });
    await allowMissingRealDirectory(parent);
    await allowMissingRealDirectory(destination);
    for (const item of plan) {
      if (item.action === 'create') await writeFile(item.target, item.text, { encoding: 'utf8', flag: 'wx' });
    }
  }
  return plan.map(({ target, action }) => ({ target, action: check ? `would ${action}` : action }));
}

async function installSkill(edition, args) {
  const check = args.includes('--check');
  const withAgents = args.includes('--agents');
  const projects = args.filter(arg => !arg.startsWith('--'));
  const unknownFlag = args.some(arg => arg.startsWith('--') && !['--check', '--agents'].includes(arg));
  if (projects.length !== 1 || unknownFlag) {
    throw new Error('Usage: node documancer/install.mjs <existing-project-root> [--agents] [--check]');
  }

  const projectRoot = await resolveProject(projects[0]);
  const parent = join(projectRoot, edition.skillParent);
  const skillsRoot = join(parent, 'skills');
  const destination = join(skillsRoot, 'documancer');
  await allowMissingRealDirectory(parent);
  await allowMissingRealDirectory(skillsRoot);
  const legacy = join(skillsRoot, 'forest-documentation');
  if (await inspect(legacy)) {
    throw new Error(`Previous skill is still installed; review and migrate it before installing Documancer: ${legacy}`);
  }
  if (await inspect(destination)) {
    throw new Error(`Skill destination already exists; review it before replacing: ${destination}`);
  }

  const entries = [...SKILL_ENTRIES, ...edition.extraEntries];
  for (const entry of entries) {
    if (!await inspect(join(packageRoot, entry))) throw new Error(`Incomplete skill archive; missing ${entry}`);
  }
  for (const entry of SCRIPT_ENTRIES) {
    if (!await inspect(join(packageRoot, 'scripts', entry))) {
      throw new Error(`Incomplete skill archive; missing scripts/${entry}`);
    }
  }
  const agentPlan = withAgents ? await installAgents(edition, projectRoot, { check: true }) : [];
  if (check) {
    console.log(JSON.stringify({ skill: `would create ${destination}`, agents: agentPlan }, null, 2));
    return;
  }

  await mkdir(skillsRoot, { recursive: true });
  await allowMissingRealDirectory(parent);
  await allowMissingRealDirectory(skillsRoot);
  await mkdir(destination);
  const copyOptions = { force: false, errorOnExist: true };
  for (const entry of entries) {
    await cp(join(packageRoot, entry), join(destination, entry), { recursive: true, ...copyOptions });
  }
  await mkdir(join(destination, 'scripts'));
  for (const entry of SCRIPT_ENTRIES) {
    await cp(join(packageRoot, 'scripts', entry), join(destination, 'scripts', entry), copyOptions);
  }
  const installedAgents = withAgents ? await installAgents(edition, projectRoot) : [];
  console.log(JSON.stringify({ skill: destination, agents: installedAgents }, null, 2));
}

export async function runInstaller(edition, args) {
  try {
    await installSkill(edition, args);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
