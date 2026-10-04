import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, lstat, cp, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const editions = [
  { env: 'codex', pkg: 'documancer', skill: '.agents', agents: '.codex', ext: 'toml' },
  { env: 'opencode', pkg: 'documancer-opencode', skill: '.opencode', agents: '.opencode', ext: 'md' },
  { env: 'cursor', pkg: 'documancer-cursor', skill: '.cursor', agents: '.cursor', ext: 'md' },
];
const run = (...args) => spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8' });
const ok = result => assert.equal(result.status, 0, result.stderr || result.stdout);
const missing = async path => assert.rejects(lstat(path), { code: 'ENOENT' });

for (const edition of editions) {
  const { env, pkg, skill, agents, ext } = edition;
  test(`${env}: dry-run, install with agents, relocated render and no overwrite`, async () => {
    const project = await mkdtemp(join(tmpdir(), `documancer ${env} `));
    await mkdir(join(project, agents));
    const config = join(project, agents, 'existing-config.txt');
    await writeFile(config, 'preserve this');
    ok(run('install.mjs', env, project, '--agents', '--check'));
    const installed = join(project, skill, 'skills/documancer');
    await missing(installed);
    await missing(join(project, agents, 'agents'));
    ok(run('install.mjs', env, project, '--agents'));
    assert.equal(await readFile(config, 'utf8'), 'preserve this');
    for (const role of ['map', 'analyze', 'write', 'review']) {
      const profile = join(project, agents, `agents/documancer-${role}.${ext}`);
      assert.equal(await readFile(profile, 'utf8'), await readFile(join(root, 'packages', pkg, `subagents/documancer-${role}.${ext}`), 'utf8'));
    }
    ok(run(join(installed, 'scripts/install-agents.mjs'), project));
    const output = join(project, 'rendered');
    ok(run(join(installed, 'scripts/render.mjs'), '--set', join(installed, 'examples/set.json'), output));
    const html = await readFile(join(output, 'technical.html'), 'utf8');
    assert.match(html, /data:font\/woff2;base64,/);
    assert.doesNotMatch(html, /<script[^>]+src=|<link[^>]+stylesheet/);
    const original = await readFile(join(installed, 'SKILL.md'), 'utf8');
    const again = run('install.mjs', env, project);
    assert.notEqual(again.status, 0);
    assert.match(again.stderr, /already exists/);
    assert.equal(await readFile(join(installed, 'SKILL.md'), 'utf8'), original);
    // Installed copies themselves remain portable and can install into a second project.
    const next = await mkdtemp(join(tmpdir(), 'documancer next '));
    ok(run(join(installed, 'install.mjs'), next, '--agents'));
  });

  test(`${env}: agent conflict is detected before the skill is copied`, async () => {
    const project = await mkdtemp(join(tmpdir(), `documancer-conflict-${env}-`));
    await mkdir(join(project, agents, 'agents'), { recursive: true });
    const custom = join(project, agents, `agents/documancer-review.${ext}`);
    await writeFile(custom, 'custom profile');
    const result = run('install.mjs', env, project, '--agents');
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Existing agent differs/);
    await missing(join(project, skill, 'skills/documancer'));
    await missing(join(project, agents, `agents/documancer-map.${ext}`));
    assert.equal(await readFile(custom, 'utf8'), 'custom profile');
  });

  test(`${env}: skill-only install and rejected invalid/legacy destinations`, async () => {
    const project = await mkdtemp(join(tmpdir(), `documancer-skill-${env}-`));
    ok(run('install.mjs', env, project));
    await missing(join(project, agents, 'agents'));
    const legacy = await mkdtemp(join(tmpdir(), 'documancer-legacy-'));
    await mkdir(join(legacy, skill, 'skills/forest-documentation'), { recursive: true });
    assert.match(run('install.mjs', env, legacy).stderr, /Previous skill/);
    await missing(join(legacy, skill, 'skills/documancer'));
    const blocked = await mkdtemp(join(tmpdir(), 'documancer-blocked-'));
    await writeFile(join(blocked, skill), 'keep');
    assert.match(run('install.mjs', env, blocked).stderr, /real directory/);
    assert.equal(await readFile(join(blocked, skill), 'utf8'), 'keep');
    assert.notEqual(run('install.mjs', env, join(blocked, 'missing')).status, 0);
    assert.notEqual(run('install.mjs', env, blocked, '--force').status, 0);
  });

  test(`${env}: refuses a linked skill parent`, async t => {
    const project = await mkdtemp(join(tmpdir(), 'documancer-link-'));
    const other = await mkdtemp(join(tmpdir(), 'documancer-other-'));
    try { await symlink(other, join(project, skill), process.platform === 'win32' ? 'junction' : 'dir'); }
    catch (error) { if (error.code === 'EPERM') return t.skip('Host does not permit symlinks'); throw error; }
    const result = run('install.mjs', env, project);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /real directory/);
    await missing(join(other, 'skills'));
  });
}

test('shared resources are synchronized', () => ok(run('scripts/sync-shared.mjs', '--check')));
test('unknown environments fail without installing', () => assert.notEqual(run('install.mjs', 'unknown', root).status, 0));

test('OpenCode profiles accept Windows CRLF line endings', async () => {
  const copy = await mkdtemp(join(tmpdir(), 'documancer-crlf-'));
  await cp(join(root, 'packages/documancer-opencode'), join(copy, 'package'), { recursive: true });
  for (const role of ['map', 'analyze', 'write', 'review']) {
    const profile = join(copy, 'package/subagents', `documancer-${role}.md`);
    await writeFile(profile, (await readFile(profile, 'utf8')).replace(/\r?\n/g, '\r\n'));
  }
  const project = join(copy, 'project');
  await mkdir(project);
  ok(run(join(copy, 'package/install.mjs'), project, '--agents'));
});
