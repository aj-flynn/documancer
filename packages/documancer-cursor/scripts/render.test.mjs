import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {validate,renderDocument,schemaVersion,packageVersion} from './render.mjs';
const example=async name=>JSON.parse(await readFile(new URL(`../examples/${name}.json`,import.meta.url),'utf8'));

const diagram=()=>({type:'diagram',caption:'Branch and retry',description:'The middle step branches; correction returns to the start.',nodes:[{id:'start',label:'Start',row:0,column:0},{id:'check',label:'Check',row:1,column:0},{id:'end',label:'End',row:2,column:0},{id:'fix',label:'Correct source',row:1,column:1}],edges:[{from:'start',to:'check'},{from:'check',to:'end',label:'Valid'},{from:'check',to:'fix',label:'Invalid'},{from:'fix',to:'start',label:'Retry'}]});

test('diagrams reject invalid geometry, references, duplicates and raw markup fields',async()=>{
  const changes=[b=>delete b.description,b=>b.nodes=[],b=>b.nodes[0].row=-1,b=>b.nodes[0].column=1.5,b=>b.nodes[0].row=16,b=>delete b.nodes[0].row,b=>{delete b.nodes[1].row;delete b.nodes[1].column;},b=>b.direction='up',b=>b.nodes[0].id='Bad ID',b=>b.nodes[1].id='start',b=>b.nodes[1].row=0,b=>b.nodes[0].label='x'.repeat(181),b=>b.edges[0].to='missing',b=>b.edges[0].to='start',b=>b.edges.push({...b.edges[0]}),b=>b.edges[0].label='x'.repeat(49),b=>b.svg='<svg/>',b=>b.nodes[0].html='<b/>',b=>b.edges[0].href='https://example.com',b=>b.nodes=Array(41).fill(b.nodes[0]),b=>b.edges=Array(81).fill(b.edges[0])];
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
  const paths=edgeSegments(svg);assert.equal(paths.length,b.edges.length);
  for(const segments of paths)for(const {a:[x1,y1],b:[x2,y2]} of segments){
    for(const [x,y] of [[x1,y1],[x2,y2]])assert.ok(x>=0&&x<=width&&y>=0&&y<=height);
    assert.ok(x1===x2||y1===y2);
    for(const [x,y,w,h] of rectangles){
      const intersects=x1===x2?x1>x&&x1<x+w&&Math.max(y1,y2)>y&&Math.min(y1,y2)<y+h:y1>y&&y1<y+h&&Math.max(x1,x2)>x&&Math.min(x1,x2)<x+w;
      assert.ok(!intersects,'arrow crosses a node interior');
    }
  }
});

// Each drawn edge as straight segments; a hop is kept as its straight chord, marked `hop`.
const edgeSegments=svg=>[...svg.matchAll(/class="diagram-edge[^"]*" d="([^"]+)"/g)].map(m=>{
  const segments=[];let at;
  for(const command of m[1].match(/[MLA][^MLA]*/g)){const to=command.slice(1).trim().split(' ').map(Number).slice(-2);if(command[0]!=='M')segments.push({a:at,b:to,hop:command[0]==='A'});at=to;}
  return segments;
});
const crossingFixture=()=>({type:'diagram',caption:'Crossing',description:'Two edges must cross.',nodes:[{id:'a',label:'A',row:0,column:0},{id:'b',label:'B',row:0,column:1},{id:'c',label:'C',row:1,column:0},{id:'d',label:'D',row:1,column:1}],edges:[{from:'a',to:'d'},{from:'b',to:'c'}]});

test('every diagram edge has lines and box ports of its own, and crosses others only at a right angle with a hop',async()=>{
  const {diagramHTML}=await import('./diagram.mjs');
  const dense=diagram();dense.edges.push({from:'end',to:'start',label:'Restart'},{from:'fix',to:'end'},{from:'fix',to:'check',label:'Recheck'},{from:'start',to:'fix'},{from:'end',to:'fix'});
  let hops=0;
  for(const b of [diagram(),dense,crossingFixture()]){
    const paths=edgeSegments(diagramHTML(b,'fixture')),ends=paths.flatMap(s=>[s[0].a,s.at(-1).b].map(String));
    assert.equal(new Set(ends).size,ends.length,'two edges share a port');
    for(let i=0;i<paths.length;i++)for(let j=i+1;j<paths.length;j++)for(const s of paths[i])for(const t of paths[j]){
      const flat=u=>u.a[1]===u.b[1],lo=(u,k)=>Math.min(u.a[k],u.b[k]),hi=(u,k)=>Math.max(u.a[k],u.b[k]);
      if(flat(s)===flat(t)){
        const k=flat(s)?0:1,line=flat(s)?1:0;
        if(s.a[line]===t.a[line])assert.ok(hi(s,k)<lo(t,k)||hi(t,k)<lo(s,k),'two edges share a line');
        continue;
      }
      const [h,v]=flat(s)?[s,t]:[t,s],x=v.a[0],y=h.a[1];
      if(x<lo(h,0)||x>hi(h,0)||y<lo(v,1)||y>hi(v,1))continue;
      assert.ok(x>lo(h,0)&&x<hi(h,0)&&y>lo(v,1)&&y<hi(v,1),'edges touch at a corner or an end');
      assert.ok(h.hop&&(h.a[0]+h.b[0])/2===x,'a crossing is drawn without a hop');hops++;
    }
  }
  assert.ok(hops>0);
});

test('a diagram whose edges cannot each get their own lines is rejected with the edge path',async()=>{
  const d=await example('technical');
  d.overview=[{type:'diagram',caption:'Hub',description:'Too many edges at one box.',nodes:[{id:'hub',label:'Hub',row:7,column:7},...Array.from({length:21},(_,i)=>({id:'n'+i,label:'N',row:Math.floor(i/8),column:i%8}))],edges:Array.from({length:21},(_,i)=>({from:'hub',to:'n'+i}))}];
  assert.throws(()=>validate(d),/^Error: overview\[0\]\.edges\[\d+\]: cannot be drawn without sharing a line/);
});

const projects=()=>{const ids='api job pa sms clients email voice minurl bandwidth data common'.split(' ');return {type:'diagram',caption:'Project references',description:'Which project references which.',nodes:ids.map(id=>({id,label:id[0].toUpperCase()+id.slice(1)})),edges:'api sms|api minurl|api clients|api email|api data|api voice|api bandwidth|api common|sms minurl|sms data|sms common|minurl data|minurl common|clients data|clients common|job sms|job clients|job common|job data|job email|job voice|pa minurl|pa common|pa bandwidth|pa data'.split('|').map(pair=>{const [from,to]=pair.split(' ');return {from,to};})};};
const boxes=svg=>[...svg.matchAll(/<g class="diagram-node[^"]*"><rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)"/g)].map(m=>m.slice(1).map(Number));
test('a diagram without rows and columns is laid out in layers, keeps every edge, and follows its direction',async()=>{
  const {diagramHTML,diagramWarnings}=await import('./diagram.mjs');
  const d=await example('technical'),b=projects();d.overview=[b];assert.equal(validate(d),d);
  const svg=diagramHTML({...b,direction:'down'},'auto');assert.equal(diagramHTML(structuredClone({...b,direction:'down'}),'auto'),svg,'automatic layout is deterministic');
  assert.equal([...svg.matchAll(/class="diagram-edge/g)].length,25,'no edge is dropped');
  const at=new Map(b.nodes.map((n,k)=>[n.id,boxes(svg)[k]])),cells=new Set([...at.values()].map(([x,y])=>`${x},${y}`));
  assert.equal(cells.size,b.nodes.length,'every node has a cell of its own');
  for(const e of b.edges)assert.ok(at.get(e.to)[1]>at.get(e.from)[1],`${e.from} → ${e.to} points down`);
  assert.doesNotMatch(diagramWarnings(b).join(' '),/against the/);assert.doesNotMatch(diagramWarnings({...b,direction:'down'}).join(' '),/against the/);
  d.overview=[{...b,direction:'right'}];assert.equal(validate(d),d);
  const right=diagramHTML({...b,direction:'right'},'auto'),across=new Map(b.nodes.map((n,k)=>[n.id,boxes(right)[k]]));
  for(const e of b.edges)assert.ok(across.get(e.to)[0]>across.get(e.from)[0],`${e.from} → ${e.to} points right`);
  const chosen=diagramHTML(b,'auto'),chosenAt=new Map(b.nodes.map((n,k)=>[n.id,boxes(chosen)[k]]));
  assert.ok(b.edges.every(e=>chosenAt.get(e.to)[0]>chosenAt.get(e.from)[0]),'without a direction, the layout with fewer crossings (left to right here) is chosen');
  const star={type:'diagram',caption:'What the API references',description:'One project and its references.',nodes:[...new Set(b.edges.filter(e=>e.from==='api').flatMap(e=>[e.from,e.to]))].map(id=>({id,label:id})),edges:b.edges.filter(e=>e.from==='api')};
  assert.deepEqual(diagramWarnings(star),[],'a diagram about one node may give it many edges');
  const loop={...diagram(),nodes:diagram().nodes.map(({id,label})=>({id,label}))},loopAt=new Map(loop.nodes.map((n,k)=>[n.id,boxes(diagramHTML(loop,'loop'))[k]]));
  assert.ok(loopAt.get('start')[1]<loopAt.get('check')[1]&&loopAt.get('check')[1]<loopAt.get('end')[1],'a loop back does not change the main flow');
  assert.deepEqual(diagramWarnings(loop),[]);
});

test('labels on two arrows running close together each get a place of their own',async()=>{
  const {diagramHTML}=await import('./diagram.mjs');
  const b={type:'diagram',caption:'Payment',description:'A declined payment can be retried.',nodes:[{id:'pending',label:'Payment pending'},{id:'failed',label:'Payment failed'},{id:'paid',label:'Paid'}],edges:[{from:'pending',to:'paid',label:'Approved'},{from:'pending',to:'failed',label:'Declined'},{from:'failed',to:'pending',label:'Retry'}]};
  const svg=diagramHTML(b,'labels'),labels=[...svg.matchAll(/<rect class="diagram-label-bg" x="([-\d.]+)" y="([-\d.]+)" width="([\d.]+)" height="([\d.]+)"/g)].map(m=>m.slice(1).map(Number));
  assert.equal(labels.length,3);
  for(let i=0;i<labels.length;i++)for(let j=i+1;j<labels.length;j++){const [a,c]=[labels[i],labels[j]];assert.ok(a[0]+a[2]<=c[0]||c[0]+c[2]<=a[0]||a[1]+a[3]<=c[1]||c[1]+c[3]<=a[1],'labels do not overlap');}
  for(const [x,y,w,h] of labels)for(const [X,Y,W,H] of boxes(svg))assert.ok(x+w<=X||X+W<=x||y+h<=Y||Y+H<=y,'labels do not cover boxes');
});

test('diagram warnings name crossings, loose nodes, misplaced arrows, density and hubs, and the CLI prints them',async()=>{
  const {diagramWarnings,documentDiagramWarnings}=await import('./diagram.mjs');
  assert.deepEqual(diagramWarnings(diagram()),[],'a loop back is not against the flow');
  assert.match(diagramWarnings(crossingFixture()).join('\n'),/^1 edge crossing, drawn with a hop/m);
  const b=diagram();b.nodes.push({id:'lone',label:'Lone',row:3,column:1},{id:'sink',label:'Sink',row:0,column:1});b.edges.push({from:'end',to:'sink'},{from:'start',to:'end'});
  const text=diagramWarnings(b).join('\n');
  assert.match(text,/^lone has no edges/m);assert.match(text,/^end → sink points up, against the top-to-bottom flow, and is not a loop back/m);assert.doesNotMatch(text,/skips a row/);
  const hub={type:'diagram',caption:'Hub',description:'Hub.',nodes:[{id:'hub',label:'Hub',row:0,column:3},...Array.from({length:13},(_,i)=>({id:'n'+i,label:'N',row:1+Math.floor(i/7),column:i%7}))],edges:[...Array.from({length:12},(_,i)=>({from:'hub',to:'n'+i})),{from:'n11',to:'n12'}]};
  const hubText=diagramWarnings(hub).join('\n');assert.match(hubText,/^14 nodes; more than 12/m);assert.match(hubText,/^hub \(12\) has more than 5 edges/m);
  const dense={...hub,nodes:hub.nodes.slice(0,6),edges:[]};for(const f of dense.nodes)for(const t of dense.nodes)if(f.id<t.id&&f.row<t.row)dense.edges.push({from:f.id,to:t.id});
  dense.edges.push({from:'n0',to:'n1'},{from:'n1',to:'n2'},{from:'n2',to:'n3'},{from:'n3',to:'n4'},{from:'n0',to:'n2'});
  assert.match(diagramWarnings(dense).join('\n'),/^10 edges for 6 nodes/m);
  const d=await example('technical');d.overview=[crossingFixture()];
  assert.match(documentDiagramWarnings(d).join('\n'),/^overview\[0\]: 1 edge crossing/m);
  const dir=await mkdtemp(join(tmpdir(),'documancer-warn-')),source=join(dir,'source.json');await writeFile(source,JSON.stringify(d));
  const result=spawnSync(process.execPath,[fileURLToPath(new URL('./render.mjs',import.meta.url)),'--check',source],{encoding:'utf8'});
  assert.equal(result.status,0);assert.match(result.stderr,/^Warning: overview\[0\]: 1 edge crossing/m);
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
  for(const change of [d=>d.schemaVersion=schemaVersion+1,d=>d.schemaVersion=String(schemaVersion),d=>d.mode='other',d=>d.typo=true,d=>d.identity.date='2026-02-30',d=>d.sections[0].blocks[0].type='raw-html',d=>d.sections[0].blocks[1].rows[0].pop()]){
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

test('context is optional, validated, and rendered in the intro and the detail rail',async()=>{
  const doc=await example('technical');
  assert.doesNotMatch(await renderDocument(doc),/At a glance/);
  doc.context={summary:'Adds <b>retry</b> handling.',links:[{kind:'Ticket',label:'DOC-1',href:'https://example.com/DOC-1'}]};
  const html=await renderDocument(doc);
  assert.equal(html.match(/At a glance/g).length,2);
  assert.match(html,/Adds &lt;b&gt;retry&lt;\/b&gt; handling\./);
  assert.match(html,/<span>Ticket<\/span> <a href="https:\/\/example\.com\/DOC-1" target="_blank" rel="noopener noreferrer">/);
  assert.ok(await renderDocument({...doc,context:{links:doc.context.links}}));
  assert.ok(await renderDocument({...doc,context:{summary:'Only a summary.'}}));
  for(const bad of [{},{summary:'x'.repeat(281)},{links:[]},{summary:'ok',links:[{label:'DOC-1',href:'https://example.com'}]},{links:[{kind:'Ticket',label:'x',href:'javascript:alert(1)'}]},{summary:'ok',extra:true}])
    await assert.rejects(renderDocument({...doc,context:bad}));
});
test('identity is in the footer and the skip link targets the document content',async()=>{
  const html=await renderDocument(await example('user-guide'));
  assert.match(html,/<footer class="doc-footer">.*<dl class="document-identity">/s);
  assert.doesNotMatch(html.slice(html.indexOf('<article'),html.indexOf('</article>')),/document-identity/);
  assert.match(html,/<a class="skip" href="#document-content">/);
  assert.match(html,/<article class="article" id="document-content" tabindex="-1">/);
  await assert.rejects(renderDocument({...(await example('user-guide')),sections:[{id:'document-content',title:'Reserved',blocks:[{type:'paragraph',text:'x'}]}]}));
});

test('documents must match the renderer schema version, and older ones say how to update',async()=>{
  const doc=await example('technical');
  assert.equal(doc.schemaVersion,schemaVersion);
  await assert.rejects(renderDocument({...doc,schemaVersion:schemaVersion-1}),/update it to the current data contract and set schemaVersion to 2/);
  const pkg=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
  assert.equal(pkg.version,packageVersion);
  assert.match(await renderDocument(doc),new RegExp('<meta name="generator" content="Documancer '+packageVersion.replaceAll('.','\\.')+'">'));
});
test('the footer omits source identity and shows who generated the document when given',async()=>{
  const doc=await example('user-guide');
  const footer=html=>html.slice(html.indexOf('<footer'),html.indexOf('</footer>'));
  const plain=footer(await renderDocument(doc));
  assert.doesNotMatch(plain,/Source identity|Generated by/);
  assert.match(plain,/<dt>Document<\/dt>/);
  const made=footer(await renderDocument({...doc,generatedBy:{agent:'Agent <x>',model:'model-1'}}));
  assert.match(made,/<dt>Generated by<\/dt><dd>Agent &lt;x&gt;, model-1<\/dd>/);
  assert.match(footer(await renderDocument({...doc,generatedBy:{model:'model-1'}})),/<dd>model-1<\/dd>/);
  for(const bad of [{},{agent:''},{agent:'a',tool:'b'}])await assert.rejects(renderDocument({...doc,generatedBy:bad}));
  const uat=await renderDocument({...(await example('uat')),generatedBy:{agent:'Agent',model:'model-1'}});
  assert.match(uat,/Source identity: /);
  assert.match(uat,/Generated by: Agent, model-1/);
});
test('every section is a card whose icon, label and colour come from its content',async()=>{
  const guide=await renderDocument(await example('user-guide')),uat=await renderDocument(await example('uat'));
  const cards=html=>[...html.matchAll(/<section id="([^"]+)" class="card tone-(\w+)[^"]*"[^>]*><header class="card-head"><span class="card-icon"><svg class="icon"[^>]*aria-hidden="true"/g)];
  assert.equal(cards(guide).length,(await example('user-guide')).sections.length);
  assert.match(guide,/<p class="eyebrow">Step by step<\/p>/);
  assert.deepEqual(cards(uat).map(m=>m[1]).slice(0,2),['setup','UAT-01']);
  assert.match(uat,/<div class="card-ask"><p class="eyebrow">You are judging<\/p>/);
  assert.match(uat,/<a href="#UAT-01" class="tone-ok"><span class="nav-icon">.*?<span class="dot" data-dot="UAT-01"><\/span><\/a>/);
  assert.match(guide,/<div class="note note-(warning|tip|remember)" role="note"><svg/);
  assert.doesNotMatch(guide,/class="answer-bar/);assert.match(uat,/<nav class="answer-bar screen-only" aria-label="Results">/);
});
test('appearance offers light, dark and the two cyberpunk themes, which never reach print',async()=>{
  const html=await renderDocument(await example('technical'));
  for(const value of ['system','dark','light','cyber','neo'])assert.match(html,new RegExp('<option value="'+value+'">'));
  for(const theme of ['cyber','neo']){assert.match(html,new RegExp('html\\[data-theme='+theme+'\\]\\{'));assert.match(html,new RegExp("names = \\{[^}]*"+theme+":"));}
  const screen=html.indexOf('@media screen{'),print=html.indexOf('@media print{');assert.ok(screen>0&&screen<print);
  assert.ok(html.slice(0,screen).indexOf('data-theme=cyber')<0&&html.slice(print).indexOf('data-theme=cyber')<0,'cyberpunk rules sit inside the screen block');
});
test('print is the same from every appearance and on every paper size',async()=>{
  const html=await renderDocument({...await example('uat'),title:'Plan "A" \\ </style>'});
  const css=html.slice(html.indexOf('<style>'),html.indexOf('</style></head>')),print=css.slice(css.indexOf('@media print{'));
  // Every colour a theme sets is set again for print, so no appearance can reach paper.
  const tokens=block=>new Set([...block.matchAll(/(--[a-z-]+):/g)].map(m=>m[1]));
  const themed=tokens(css.slice(css.indexOf(':root{'),css.indexOf('.tone-ok{')));
  themed.delete('--font-family');
  assert.ok(themed.size>15);
  for(const token of themed)assert.ok(tokens(print).has(token),token+' is not set for print');
  assert.match(print,/:root,html\[data-theme\]\{[^}]*color-scheme:light/);
  // The script chooses a theme by attribute only: an inline colour scheme would outrank the print rules.
  assert.doesNotMatch(html,/style\.colorScheme/);
  // Window-width rules never apply to paper.
  assert.doesNotMatch(css,/@media\s*\((min|max)-width/);
  assert.ok([...css.matchAll(/@media screen and \((min|max)-width/g)].length>=7);
  // Each sheet names the document and its page, and leaves no room for the browser's own header.
  assert.match(print,/@top-left\{content:""\}@top-center\{content:""\}@top-right\{content:""\}/);
  assert.match(print,/@bottom-right\{content:"Page " counter\(page\) " of " counter\(pages\)/);
  assert.ok(css.endsWith('@page{@bottom-left{content:"Plan \\22 A\\22  \\5c  \\3c \\2f style\\3e "}}'),css.slice(-80));
  // The document details print beside the wordmark; the footer that shows them on screen is not printed.
  assert.match(html,/<header class="site-header">.*?<dl class="document-identity">.*?<\/dl><\/header>/);
  assert.match(print,/\.doc-footer,/);
  assert.match(print,/\.site-header \.document-identity\{display:flex/);
});
