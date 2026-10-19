import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {validate,renderDocument} from './render.mjs';
const example=async name=>JSON.parse(await readFile(new URL(`../examples/${name}.json`,import.meta.url),'utf8'));

const diagram=()=>({type:'diagram',caption:'Branch and retry',description:'The middle step branches; correction returns to the start.',nodes:[{id:'start',label:'Start',row:0,column:0},{id:'check',label:'Check',row:1,column:0},{id:'end',label:'End',row:2,column:0},{id:'fix',label:'Correct source',row:1,column:1}],edges:[{from:'start',to:'check'},{from:'check',to:'end',label:'Valid'},{from:'check',to:'fix',label:'Invalid'},{from:'fix',to:'start',label:'Retry'}]});

test('diagrams reject invalid geometry, references, duplicates and raw markup fields',async()=>{
  const changes=[b=>delete b.description,b=>b.nodes=[],b=>b.nodes[0].row=-1,b=>b.nodes[0].column=1.5,b=>b.nodes[0].row=8,b=>b.nodes[0].id='Bad ID',b=>b.nodes[1].id='start',b=>b.nodes[1].row=0,b=>b.nodes[0].label='x'.repeat(181),b=>b.edges[0].to='missing',b=>b.edges[0].to='start',b=>b.edges.push({...b.edges[0]}),b=>b.edges[0].label='x'.repeat(49),b=>b.svg='<svg/>',b=>b.nodes[0].html='<b/>',b=>b.edges[0].href='https://example.com',b=>b.nodes=Array(41).fill(b.nodes[0]),b=>b.edges=Array(81).fill(b.edges[0])];
  for(const change of changes){const d=await example('technical'),b=diagram();change(b);d.overview=[b];assert.throws(()=>validate(d),/overview\[0\]/);}
  const d=await example('technical'),b=diagram();b.edges=[];d.overview=[b];assert.equal(validate(d),d);
});

test('diagrams are deterministic, accessible, escaped and uniquely identified across nested blocks',async()=>{
  const d=await example('technical'),b=diagram(),attack='</text><script>alert(1)</script><foreignObject>';
  b.nodes[0].label=attack;b.caption=attack;b.description=attack;b.edges[0].label='<img onerror=alert(1)>';
  d.overview=[b,{type:'details',title:'More',blocks:[structuredClone(b)]}];d.sections[0].id='documancer-diagram-1-title';
  const html=await renderDocument(d);assert.equal(await renderDocument(d),html);
  assert.ok(!html.includes(attack));assert.doesNotMatch(html,/<foreignObject|<img onerror/);assert.match(html,/&lt;foreignObject&gt;/);
  const ids=[...html.matchAll(/\sid="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length);
  const refs=[...html.matchAll(/marker-end="url\(#([^)]+)\)"/g)].map(m=>m[1]);for(const id of refs)assert.ok(ids.includes(id));
  assert.match(html,/class="diagram-scroll" tabindex="0" role="region"/);assert.match(html,/role="img" aria-labelledby=/);assert.match(html,/<summary>Text description<\/summary>/);
  assert.match(html,/Check → End: Valid/);assert.doesNotMatch(html,/<script[^>]+src=|<link[^>]+stylesheet|<image\b|<foreignObject\b/);
});

test('routed diagram arrows stay in bounds and avoid intermediate node interiors',async()=>{
  const {diagramHTML}=await import('./diagram.mjs');
  const b=diagram();b.edges.push({from:'end',to:'start',label:'Restart'},{from:'fix',to:'end'},{from:'fix',to:'check',label:'Recheck'});
  const svg=diagramHTML(b,'fixture');
  const [,width,height]=svg.match(/viewBox="0 0 (\d+) (\d+)"/).map(Number);
  const rectangles=[...svg.matchAll(/<g class="diagram-node"><rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)"/g)].map(m=>m.slice(1).map(Number));
  const paths=[...svg.matchAll(/class="diagram-edge" d="M ([^"]+)"/g)];assert.equal(paths.length,b.edges.length);
  for(const path of paths){
    const points=path[1].split(' L ').map(p=>p.split(' ').map(Number));
    for(const [x,y] of points)assert.ok(x>=0&&x<=width&&y>=0&&y<=height);
    for(let i=1;i<points.length;i++){
      const [x1,y1]=points[i-1],[x2,y2]=points[i];assert.ok(x1===x2||y1===y2);
      for(const [x,y,w,h] of rectangles){
        const intersects=x1===x2?x1>x&&x1<x+w&&Math.max(y1,y2)>y&&Math.min(y1,y2)<y+h:y1>y&&y1<y+h&&Math.max(x1,x2)>x&&Math.min(x1,x2)<x+w;
        assert.ok(!intersects,'arrow crosses a node interior');
      }
    }
  }
});

test('all modes render deterministically with embedded assets',async()=>{
  for(const name of ['technical','user-guide','uat']){
    const doc=await example(name);const html=await renderDocument(doc);
    assert.equal(await renderDocument(doc),html);
    assert.match(html,/data:font\/woff2;base64,/);assert.match(html,/data:image\/svg\+xml;base64,/);
    assert.match(html,/SIL OPEN FONT LICENSE/);assert.doesNotMatch(html,/@import|<script[^>]+src=|<link[^>]+stylesheet/);
    for(const url of html.matchAll(/url\(["']?([^"')]+)/g))assert.ok(url[1].startsWith('data:')||(url[1].startsWith('#')&&html.includes(`id="${url[1].slice(1)}"`)),url[1]);
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
