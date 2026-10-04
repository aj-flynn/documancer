import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {validate,renderDocument} from './render.mjs';
const example=async name=>JSON.parse(await readFile(new URL(`../examples/${name}.json`,import.meta.url),'utf8'));

test('all modes render deterministically with embedded assets',async()=>{
  for(const name of ['technical','user-guide','uat']){
    const doc=await example(name);const html=await renderDocument(doc);
    assert.equal(await renderDocument(doc),html);
    assert.match(html,/data:font\/woff2;base64,/);assert.match(html,/data:image\/svg\+xml;base64,/);
    assert.match(html,/SIL OPEN FONT LICENSE/);assert.doesNotMatch(html,/@import|<script[^>]+src=|<link[^>]+stylesheet/);
    for(const url of html.matchAll(/url\(["']?([^"')]+)/g))assert.ok(url[1].startsWith('data:'),url[1]);
  }
});
test('rejects malformed schemas, dates and unknown fields',async()=>{
  for(const change of [d=>d.schemaVersion=2,d=>d.mode='other',d=>d.typo=true,d=>d.identity.date='2026-02-30',d=>d.sections[0].blocks[0].type='raw-html',d=>d.sections[0].blocks[1].rows[0].pop()]){
    const d=await example('technical');change(d);assert.throws(()=>validate(d));
  }
});
test('rejects duplicate, reserved and unknown anchor IDs',async()=>{
  for(const id of ['overview','main','doc-search','architecture']){const d=await example('technical');d.sections[1].id=id;assert.throws(()=>validate(d),/duplicate|reserved/)}
  const d=await example('technical');d.related=[{label:'Broken',href:'#missing'}];assert.throws(()=>validate(d),/unknown anchor/);
  const u=await example('uat');u.tests[1].id='uat-01';assert.throws(()=>validate(u),/duplicate/);
  u.tests[1].id='test-0-notes';assert.throws(()=>validate(u),/reserved/);
});
test('rejects dangerous URLs and accepts supported link types',async()=>{
  for(const url of ['javascript:alert(1)','data:text/html,hello','file:///C:/secret','//example.com','https:\\example.com','java\nscript:alert(1)','https://user:secret@example.com']){
    const d=await example('technical');d.related=[{label:'link',href:url}];assert.throws(()=>validate(d));
  }
  for(const url of ['https://example.com/a','mailto:hello@example.com','../guide.html','user-guide.html#appearance','#architecture']){const d=await example('technical');d.related=[{label:'link',href:url}];assert.equal(validate(d),d)}
});
test('untrusted content stays text in markup and summary JSON',async()=>{
  const d=await example('uat');const attack='</script><script>globalThis.injected=true</script><img src=x onerror=alert(1)>';
  d.title=attack;d.tests[0].title=attack;d.identity.source=attack;
  const html=await renderDocument(d);assert.ok(!html.includes(attack));assert.match(html,/&lt;img/);
  const embedded=html.match(/<script type="application\/json" id="document-data">([\s\S]*?)<\/script>/)[1];assert.equal(JSON.parse(embedded).title,attack);
});
test('human results cannot be preaccepted; evidence remains separate',async()=>{
  const d=await example('uat');d.tests[0].result='Passed';assert.throws(()=>validate(d),/unknown field/);delete d.tests[0].result;
  d.evidence=[{title:'Example evidence',status:'passed',detail:'Synthetic renderer fixture, not a project verification claim.',history:'Earlier fixture failed.'}];
  const html=await renderDocument(d);assert.equal((html.match(/value="Untested" checked/g)||[]).length,3);assert.ok(html.indexOf('id="evidence"')<html.indexOf('id="summary"'));
  d.evidence[0].status='skipped';assert.throws(()=>validate(d),/invalid evidence/);
});
test('custom publisher does not inherit Flynn branding',async()=>{
  const d=await example('technical');d.brand={name:'Another project'};const html=await renderDocument(d);assert.doesNotMatch(html,/class="brand-dark" src=/);assert.match(html,/>Another project<\/a>/);
  d.brand.logo='flynn';assert.throws(()=>validate(d),/requires/);
});
test('CLI preserves existing output on invalid input and rejects input overwrite',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'documancer-render-test-'));const source=join(dir,'source.json'),out=join(dir,'result.html');await writeFile(source,'{}');await writeFile(out,'KEEP');
  const cli=fileURLToPath(new URL('./render.mjs',import.meta.url));
  assert.notEqual(spawnSync(process.execPath,[cli,source,out]).status,0);assert.equal(await readFile(out,'utf8'),'KEEP');
  assert.notEqual(spawnSync(process.execPath,[cli,source,source]).status,0);assert.equal(await readFile(source,'utf8'),'{}');
});

test('standalone exports ignore stale requested companion links',async()=>{
  const d=await example('technical');d.related=[{label:'Missing guide',href:'missing.html'},{label:'UAT',href:'uat.html'}];
  assert.doesNotMatch(await renderDocument(d),/<nav class="document-links"/);
});
test('all generated subsets enforce availability and one-way UAT navigation',async()=>{
  const {renderSet}=await import('./render.mjs');const modes=['technical','user-guide','uat'];
  const dir=await mkdtemp(join(tmpdir(),'documancer-subsets-'));
  for(const mode of modes)await writeFile(join(dir,mode+'.json'),JSON.stringify(await example(mode)));
  for(let mask=1;mask<8;mask++){
    const included=modes.filter((_,i)=>mask&(1<<i));
    await writeFile(join(dir,'set.json'),JSON.stringify({documents:included.map(mode=>({source:mode+'.json',output:mode+'.html'}))}));
    await renderSet(join(dir,'set.json'),join(dir,'out'));
    for(const mode of included){
      const html=await readFile(join(dir,'out',mode+'.html'),'utf8');const nav=html.match(/<nav class="document-links"[^>]*>([\s\S]*?)<\/nav>/)?.[1]??'';
      const links=[...nav.matchAll(/href="([^"]+)"/g)].map(m=>m[1]);
      assert.deepEqual(links,included.filter(m=>m!==mode&&m!=='uat').map(m=>m+'.html'));
      assert.equal((nav.match(/target="_blank" rel="noopener noreferrer"/g)||[]).length,mode==='uat'?links.length:0);
    }
  }
});
test('known UAT links are suppressed throughout public documents; UAT guide links open separately',async()=>{
  const d=await example('technical');d.sections[0].blocks.push({type:'links',items:[{label:'Private acceptance',href:'checks.html#summary'}]});
  const html=await renderDocument(d,{companions:[{mode:'uat',href:'checks.html'}]});assert.doesNotMatch(html,/href="checks.html/);
  const u=await example('uat');u.tests[0].prerequisites.push({type:'links',items:[{label:'Instructions',href:'instructions.html#before'}]});
  assert.match(await renderDocument(u,{companions:[{mode:'user-guide',href:'instructions.html'}]}),/href="instructions.html#before" target="_blank" rel="noopener noreferrer"/);
});
test('set paths support nested output and reject traversal and duplicate modes',async()=>{
  const {renderSet}=await import('./render.mjs');const dir=await mkdtemp(join(tmpdir(),'documancer-paths-'));
  for(const mode of ['technical','uat'])await writeFile(join(dir,mode+'.json'),JSON.stringify(await example(mode)));
  const manifest=join(dir,'set.json');
  await writeFile(manifest,JSON.stringify({documents:[{source:'technical.json',output:'guides/engineering guide.html'},{source:'uat.json',output:'checks/acceptance.html'}]}));
  await renderSet(manifest,join(dir,'out'));assert.match(await readFile(join(dir,'out/checks/acceptance.html'),'utf8'),/href="..\/guides\/engineering%20guide.html" target="_blank"/);
  for(const documents of [[{source:'technical.json',output:'../escape.html'}],[{source:'technical.json',output:'a.html'},{source:'technical.json',output:'b.html'}]]){
    await writeFile(manifest,JSON.stringify({documents}));await assert.rejects(renderSet(manifest,join(dir,'out')));
  }
});
