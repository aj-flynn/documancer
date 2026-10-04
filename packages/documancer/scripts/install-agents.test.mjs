import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,mkdir,lstat} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {agentNames,installAgents} from './install-agents.mjs';

test('dry-run, install and repeat preserve unrelated project configuration',async()=>{
 const root=await mkdtemp(join(tmpdir(),'documancer-agents-'));await mkdir(join(root,'.codex'));
 const config=join(root,'.codex/config.toml');await writeFile(config,'model = "existing-model"\n');
 const plan=await installAgents(root,{check:true});assert.equal(plan.length,4);await assert.rejects(lstat(join(root,'.codex/agents')),/ENOENT/);
 const installed=await installAgents(root);assert.ok(installed.every(x=>x.action==='create'));
 assert.equal(await readFile(config,'utf8'),'model = "existing-model"\n');
 for(const name of agentNames)assert.match(await readFile(join(root,'.codex/agents',name+'.toml'),'utf8'),new RegExp('name = "'+name+'"'));
 assert.ok((await installAgents(root)).every(x=>x.action==='unchanged'));
});
test('conflicts fail before any other agent is installed',async()=>{
 const root=await mkdtemp(join(tmpdir(),'documancer-agents-conflict-'));await mkdir(join(root,'.codex/agents'),{recursive:true});
 const custom=join(root,'.codex/agents/documancer-review.toml');await writeFile(custom,'name = "my-custom-review"');
 await assert.rejects(installAgents(root),/Existing agent differs/);
 assert.equal(await readFile(custom,'utf8'),'name = "my-custom-review"');await assert.rejects(lstat(join(root,'.codex/agents/documancer-map.toml')),/ENOENT/);
});
test('rejects a file where the agent directory belongs',async()=>{
 const root=await mkdtemp(join(tmpdir(),'documancer-agents-file-'));await writeFile(join(root,'.codex'),'keep');
 await assert.rejects(installAgents(root),/real directory/);assert.equal(await readFile(join(root,'.codex'),'utf8'),'keep');
});
test('rejects legacy agent profiles before writing new ones',async()=>{
 const root=await mkdtemp(join(tmpdir(),'documancer-agents-legacy-'));await mkdir(join(root,'.codex/agents'),{recursive:true});
 const legacy=join(root,'.codex/agents/forest-docs-map.toml');await writeFile(legacy,'legacy');
 await assert.rejects(installAgents(root),/Previous agent profile/);
 assert.equal(await readFile(legacy,'utf8'),'legacy');
 await assert.rejects(lstat(join(root,'.codex/agents/documancer-map.toml')),/ENOENT/);
});
