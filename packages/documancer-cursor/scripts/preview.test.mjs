// Preview mode, image blocks, files beside the source and diagram change marks.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,writeFile,mkdir,cp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {validate,renderDocument,renderSet,checkDocument,viewHashes} from './render.mjs';
import {codeName} from './preview.mjs';
const examples=fileURLToPath(new URL('../examples/',import.meta.url));
const example=async name=>JSON.parse(await readFile(join(examples,name+'.json'),'utf8'));
const preview=()=>example('preview');
// A private copy of the example's files, so a test can alter them.
async function previewFolder(){const dir=await mkdtemp(join(tmpdir(),'documancer-preview-'));await cp(join(examples,'preview'),join(dir,'preview'),{recursive:true});return dir;}

test('the preview example validates, renders deterministically and embeds its files',async()=>{
  const doc=await preview();assert.equal(validate(doc),doc);
  const html=await renderDocument(doc,{baseDirectory:examples});assert.equal(await renderDocument(doc,{baseDirectory:examples}),html);
  assert.match(html,/<img src="data:image\/png;base64,/);assert.match(html,/<iframe class="proto-frame"[^>]*sandbox="allow-scripts" srcdoc="/);
  assert.match(html,/Content-Security-Policy[^>]*default-src &#39;none&#39;/);assert.doesNotMatch(html,/<script[^>]+src=|<link[^>]+stylesheet/);
  const order=['id="problem"','id="findings"','id="impact"','id="q1"','id="s1"','id="work"','id="decision"'].map(x=>html.indexOf(x));
  assert.ok(order.every((at,i)=>at>0&&(!i||at>order[i-1])),'the problem comes first, questions before views, the decision last');
  const footer=html.slice(html.indexOf('<footer'));assert.match(footer,/<dt>Ticket<\/dt><dd>example\/example-app #12<\/dd>/);assert.match(footer,/<dt>Built at<\/dt><dd>4f2a9c1d7e3b/);
  for(const hidden of ['notification-settings','authorization'])assert.ok(!html.includes(hidden),hidden+' is recorded, not shown');
  const ids=[...html.matchAll(/\sid="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length);
});

test('a malformed preview is rejected with the path of the field at fault',async()=>{
  const cases=[
    [d=>delete d.problem,/^Error: problem:/],[d=>d.problem.symptom='The helper in src/bill/lead-in.ts drops it',/^Error: problem\.symptom: "src\/bill\/lead-in\.ts"/],
    [d=>d.problem.symptom='renderLeadIn prints the wrong line',/^Error: problem\.symptom: "renderLeadIn"/],
    [d=>delete d.impact.qaReset,/^Error: impact\.qaReset:/],[d=>delete d.impact.storedData.note,/^Error: impact\.storedData\.note:/],[d=>d.impact.access.answer='maybe',/^Error: impact\.access\.answer:/],
    [d=>d.ticket.version='2',/^Error: ticket\.version:/],[d=>d.ticket.origin='customer',/^Error: ticket\.origin:/],[d=>d.ticket.builtAt.commit='main',/^Error: ticket\.builtAt\.commit:/],
    [d=>d.findings[0].basis='guessed',/^Error: findings\[0\]\.basis:/],
    [d=>d.questions[0].options.pop(),/^Error: questions\[0\]\.options: expected at least two/],[d=>d.questions[0].recommended='1c',/^Error: questions\[0\]\.recommended:/],
    [d=>d.questions[0].options[0].id='none',/^Error: questions\[0\]\.options\[0\]\.id:/],[d=>d.questions[0].choice='1b',/^Error: questions\[0\]\.choice: unknown field/],
    [d=>d.views[0].kind='page',/^Error: views\[0\]\.kind:/],[d=>d.views[0].basis='guess',/^Error: views\[0\]\.basis:/],[d=>d.views[1].id='s1',/^Error: views\[1\]\.id: duplicate/],
    [d=>d.views[0].response='ok',/^Error: views\[0\]\.response: unknown field/],[d=>d.views[0].changes[1].when='q1=1c',/^Error: views\[0\]\.changes\[1\]\.when: 1c is not an option of q1/],
    [d=>d.views[0].changes=[],/^Error: views\[0\]\.changes: a view that needs a decision lists at least one change/],[d=>delete d.views[1].changes,/^Error: views\[1\]\.changes: a view that needs a decision/],
    [d=>delete d.views[0].ask,/^Error: views\[0\]\.ask: expected a nonempty string/],[d=>d.views.at(-1).ask='Is this right?',/^Error: views\[7\]\.ask: an informational view asks nothing/],
    [d=>delete d.views[1].changes[0].proposed,/^Error: views\[1\]\.changes\[0\]\.proposed: expected a nonempty string/],[d=>d.views[0].unchanged=[''],/^Error: views\[0\]\.unchanged\[0\]/],[d=>d.views[0].proposed.image='x.png',/^Error: views\[0\]\.proposed: expected either/],
    [d=>d.views[0].now.image='../secret.png',/^Error: views\[0\]\.now\.image: expected a relative path/],[d=>d.views[0].now.image='https://example.com/a.png',/^Error: views\[0\]\.now\.image:/],
    [d=>d.views[0].proposed.prototype='preview/proto.htm',/^Error: views\[0\]\.proposed\.prototype: expected an HTML file/],
    [d=>d.views[1].rows[0].inputs.pop(),/^Error: views\[1\]\.rows\[0\]\.inputs:/],[d=>d.views[1].rows[1].id='comment-no-pause',/^Error: views\[1\]\.rows\[1\]\.id: duplicate/],
    [d=>d.views[2].tables[0].columns[1].change='new',/^Error: views\[2\]\.tables\[0\]\.columns\[1\]\.change:/],[d=>delete d.views[2].existingRows,/^Error: views\[2\]\.existingRows:/],
    [d=>d.views[3].cells[0].actor='Guest',/^Error: views\[3\]\.cells\[0\]\.actor:/],[d=>d.views[4].diagram.nodes[1].change='new',/^Error: views\[4\]\.diagram\.nodes\[1\]\.change:/],
    [d=>d.views[5].proposed.type='paragraph',/^Error: views\[5\]\.proposed\.type:/],[d=>d.views[7].proposed={image:'preview/notifications-now.png',alt:'x'},/^Error: views\[7\]\.proposed: an informational view/],
    [d=>d.work[0].size='huge',/^Error: work\[0\]\.size:/],[d=>delete d.leaveAsIs,/^Error: leaveAsIs:/],[d=>d.sections=[],/^Error: sections: not supported in preview mode/],[d=>d.views=[],/^Error: views:/],
  ];
  for(const [change,expected] of cases){const d=await preview();change(d);assert.throws(()=>validate(d),expected,String(change));}
  const guide=await example('technical');guide.views=[];assert.throws(()=>validate(guide),/^Error: views: only supported in preview mode/);
});

test('a review is answered view by view: no impact or work, no ticket to reject, and wording changes need no new screen',async()=>{
  const doc=await example('review');assert.equal(await checkDocument(doc,{baseDirectory:examples}),doc);
  const html=await renderDocument(doc,{baseDirectory:examples}),data=JSON.parse(html.match(/<script type="application\/json" id="document-data">([\s\S]*?)<\/script>/)[1]).preview;
  assert.equal(data.review,true);assert.doesNotMatch(html,/id="decision-reject"|id="impact"|id="work"/);
  assert.match(html,/id="decision-primary"[^>]*>Finish review<\/button>/);assert.match(html,/Why this review exists/);
  assert.match(html,/<strong>What this costs the user<\/strong><p>The tester stopped for about twenty seconds/);
  assert.match(html,/<h3>Proposed<\/h3><p>The same screen\. Only the wording listed under What changes is different\.<\/p>/);
  assert.match(html,/<b>Now<\/b>Weekly summary<\/div>.*<b>Proposed<\/b>Weekly summary of activity/);
  const ticket=await renderDocument(await preview(),{baseDirectory:examples});assert.match(ticket,/id="decision-reject"/);assert.equal(JSON.parse(ticket.match(/id="document-data">([\s\S]*?)<\/script>/)[1]).preview.review,false);
  const cases=[
    [d=>d.work=[{title:'x',outcome:'y',size:'small'}],/^Error: work: a review creates no work/],
    [d=>d.views[0].cost='The labelText is unclear',/^Error: views\[0\]\.cost: "labelText"/],[d=>d.views[0].cost='',/^Error: views\[0\]\.cost:/],
    [d=>delete d.views[0].now,/^Error: views\[0\]\.proposed: expected a prototype or an image/],
    [d=>{delete d.views[1].changes[0].now;delete d.views[1].changes[0].proposed;},/^Error: views\[1\]\.changes\[0\]: without a proposed screen/],
    [d=>{d.ticket.kind='change';},/^Error: impact:/],
  ];
  for(const [change,expected] of cases){const d=await example('review');change(d);assert.throws(()=>validate(d),expected,String(change));}
  const withImpact=await preview();withImpact.ticket.kind='review';delete withImpact.work;assert.ok(validate(withImpact),'a review may still give an impact');
  const cost=await preview();cost.views[0].cost='People miss comments.';assert.ok(validate(cost),'any preview may give a view its cost');
});

test('the symptom check allows quoted output and plain language',()=>{
  assert.equal(codeName('A new Section prints as `Sec. 1. Scope`; Indiana bills print `Sec. 1.` Seen since 11/15/2026 and/or earlier.'),null);
  for(const text of ['see packages/drafting/src/x.ts','bill-lead-in.ts is wrong','the lead_in value','call format()'])assert.ok(codeName(text),text);
});

test('files are read only from the source folder and as the type they claim, at any size',async()=>{
  const doc=await preview();
  await assert.rejects(renderDocument(doc),/problem\.evidence\[1\]\.file: this document refers to a file beside its source/);
  const dir=await previewFolder();assert.equal(await checkDocument(doc,{baseDirectory:dir}),doc);
  const missing=structuredClone(doc);missing.views[0].now.image='preview/missing.png';await assert.rejects(checkDocument(missing,{baseDirectory:dir}),/views\[0\]\.now\.image: file not found/);
  await assert.rejects(checkDocument(doc,{baseDirectory:join(dir,'preview')}),/file not found/);
  await writeFile(join(dir,'preview/notifications-now.png'),'not an image');await assert.rejects(checkDocument(doc,{baseDirectory:dir}),/is not a valid PNG image/);
  // No size limit: a 3 MB image and a 4 MB prototype, 7 MB of embedded files in all.
  const big=await previewFolder(),png=await readFile(join(examples,'preview/notifications-now.png'));
  await writeFile(join(big,'preview/notifications-now.png'),Buffer.concat([png,Buffer.alloc(3*1024*1024)]));
  await writeFile(join(big,'preview/notifications-proposed.html'),(await readFile(join(examples,'preview/notifications-proposed.html'),'utf8')).replace('</main>','<!--'+'x'.repeat(4*1024*1024)+'--></main>'));
  const large=structuredClone(doc);assert.equal(await checkDocument(large,{baseDirectory:big}),large);
  const html=await renderDocument(large,{baseDirectory:big});assert.ok(html.length>8*1024*1024,`rendered ${html.length} bytes`);assert.ok(html.includes('x'.repeat(4*1024*1024)),'the prototype is embedded whole');
  const cli=fileURLToPath(new URL('./render.mjs',import.meta.url)),source=join(big,'preview.json');await writeFile(source,JSON.stringify(doc));
  const checked=spawnSync(process.execPath,[cli,'--check',source],{encoding:'utf8'});assert.equal(checked.status,0,checked.stderr);assert.match(checked.stdout,/^Valid /);
  const rendered=spawnSync(process.execPath,[cli,source,join(big,'preview.html')],{encoding:'utf8'});assert.equal(rendered.status,0,rendered.stderr);
  assert.ok((await readFile(join(big,'preview.html'))).length>8*1024*1024);
});

test('a prototype must be self-contained and its change points must match the view',async()=>{
  const doc=await preview(),source=await readFile(join(examples,'preview/notifications-proposed.html'),'utf8');
  const cases=[
    [html=>html.replace('</style>','</style><link rel="stylesheet" href="https://example.com/app.css">'),/views\[0\]\.proposed\.prototype: href "https:\/\/example\.com\/app\.css" points outside/],
    [html=>html.replace('<main>','<main><img src="logo.png" alt="">'),/src "logo\.png" points outside/],
    [html=>html.replace('body{','body{background:url(https://example.com/bg.png);'),/url\(\) "https:\/\/example\.com\/bg\.png" points outside/],
    [html=>html.replace('<main>','<main><script src="//cdn.example.com/x.js"></script>'),/points outside/],
    [html=>html.replace('<main>','<main><iframe></iframe>'),/must not contain a iframe element/],
    [html=>html.replace('<meta charset="utf-8">','<meta http-equiv="refresh" content="0;url=https://example.com">'),/http-equiv/],
    [html=>html.replace(' data-change="hint"',''),/views\[0\]\.changes\[2\]\.id: no element in preview\/notifications-proposed\.html carries data-change="hint"/],
    [html=>html.replace('<h1>','<h1 data-change="title">'),/data-change="title" is not declared in views\[0\]\.changes/],
    [html=>html.replace('data-when="q1=1a"','data-when="q9=1a"'),/unknown question q9/],
  ];
  for(const [change,expected] of cases){
    const dir=await previewFolder(),changed=change(source);assert.notEqual(changed,source,String(change));
    await writeFile(join(dir,'preview/notifications-proposed.html'),changed);await assert.rejects(checkDocument(doc,{baseDirectory:dir}),expected,String(change));
  }
  const dir=await previewFolder();await writeFile(join(dir,'preview/notifications-proposed.html'),source.replace('<main>','<main><img alt="" src="data:image/gif;base64,R0lGODlhAQABAAAAACw="><a href="#top">Top</a>'));
  assert.ok(await checkDocument(doc,{baseDirectory:dir}));
});

test('no response is preselected, and earlier responses arrive only from the host',async()=>{
  const doc=await preview(),html=await renderDocument(doc,{baseDirectory:examples});
  assert.equal(html.slice(html.indexOf('<article'),html.indexOf('</article>')).match(/name="(view-\d+-response|question-\d+-choice)"[^>]* checked/g),null);
  assert.equal((html.match(/name="view-\d+-response" value="ok"/g)||[]).length,7,'the informational view has no response controls');
  assert.match(html,/<input class="sr-only" type="radio" name="question-0-choice" value="none">/);
  assert.match(html,/<div class="card-ask"><p class="eyebrow">You are deciding<\/p><p>Is this the screen you want\?<\/p><\/div>/,'each view leads with its question');
  assert.match(html,/<li class="change-pair">.*<b>Now<\/b>Sent<\/div>.*<b>Proposed<\/b>Not sent, and not sent later<\/div><\/li>/,'a change with a before and after shows both');
  assert.equal((html.match(/<div class="card-ask">/g)||[]).length,7,'the informational view and the questions have no ask band');
  assert.match(html,/name="view-0-viewing-0" value="1b" checked/,'the recommended option is the default view');
  const data=text=>JSON.parse(text.match(/<script type="application\/json" id="document-data">([\s\S]*?)<\/script>/)[1]).preview;
  assert.equal(data(html).submitUrl,null);assert.deepEqual(data(html).ticket,{repository:'example/example-app',number:12,version:2});assert.deepEqual(data(html).views[0].varies,['q1']);
  const state={submitUrl:'http://localhost:4319/respond',responses:{views:{s1:{response:'ok',options:{q1:'1a'}},e1:{response:'change',note:'Pause <billing> too'},removed:{response:'ok'}},questions:{q1:{choice:'1a'}}}};
  const carried=await renderDocument(doc,{baseDirectory:examples,preview:state});
  assert.match(carried,/name="view-0-response" value="ok" checked/);assert.match(carried,/name="view-1-response" value="change" checked/);assert.match(carried,/Pause &lt;billing&gt; too<\/textarea>/);
  assert.match(carried,/name="question-0-choice" value="1a" checked/);assert.match(carried,/name="view-0-viewing-0" value="1a" checked/);assert.equal(carried.match(/<p class="carried"/g).length,3);
  assert.equal(data(carried).submitUrl,state.submitUrl);assert.deepEqual(data(carried).views[0].ok,{options:{q1:'1a'},bulk:false});
  for(const bad of [{submitUrl:'javascript:alert(1)'},{submitUrl:'/respond'},{responses:{views:{s1:{response:'fine'}}}},{responses:{views:{s1:{response:'drop'}}}},{responses:{questions:{q1:{choice:'none'}}}},{extra:true}])
    await assert.rejects(renderDocument(doc,{baseDirectory:examples,preview:bad}),/^Error: preview/);
  await assert.rejects(renderDocument(await example('technical'),{preview:{}}),/only used with a preview document/);
});

test('view hashes follow the content and files of a view, and ignore its discussion',async()=>{
  const doc=await preview(),dir=await previewFolder(),first=await viewHashes(doc,{baseDirectory:dir});
  assert.deepEqual(Object.keys(first),doc.views.map(v=>v.id));assert.deepEqual(await viewHashes(doc,{baseDirectory:dir}),first);
  const talked=structuredClone(doc);talked.views[1].discussion=[{from:'founder',text:'Why?'}];assert.deepEqual(await viewHashes(talked,{baseDirectory:dir}),first);
  const edited=structuredClone(doc);edited.views[1].rows[0].proposed='Not sent';const second=await viewHashes(edited,{baseDirectory:dir});
  assert.notEqual(second.e1,first.e1);assert.equal(second.s1,first.s1);
  const file=join(dir,'preview/notifications-proposed.html');await writeFile(file,(await readFile(file,'utf8')).replace('Nothing is sent','No email is sent'));
  const third=await viewHashes(doc,{baseDirectory:dir});assert.notEqual(third.s1,first.s1);assert.equal(third.e1,first.e1);
  await assert.rejects(viewHashes(await example('technical')),/only for preview documents/);
});

test('the CLI checks a source without rendering, and a set refuses a preview',async()=>{
  const cli=fileURLToPath(new URL('./render.mjs',import.meta.url)),dir=await previewFolder(),source=join(dir,'preview.json'),doc=await preview();
  await writeFile(source,JSON.stringify(doc));
  const good=spawnSync(process.execPath,[cli,'--check',source],{encoding:'utf8'});assert.equal(good.status,0,good.stderr);assert.match(good.stdout,/^Valid /);
  doc.views[0].kind='page';await writeFile(source,JSON.stringify(doc));
  const bad=spawnSync(process.execPath,[cli,'--check',source],{encoding:'utf8'});assert.notEqual(bad.status,0);assert.match(bad.stderr,/^views\[0\]\.kind: expected screen/);
  await writeFile(source,JSON.stringify(await preview()));
  await writeFile(join(dir,'set.json'),JSON.stringify({documents:[{source:'preview.json',output:'preview.html'}]}));
  await assert.rejects(renderSet(join(dir,'set.json'),join(dir,'out')),/a preview is a working document and cannot be part of a set/);
});

test('image blocks work in every mode and are resolved from the folder of each set member',async()=>{
  const dir=await previewFolder(),doc=await example('user-guide');
  doc.sections[0].blocks.push({type:'image',file:'preview/notifications-now.png',alt:'The <settings> screen',caption:'Settings'});
  const html=await renderDocument(doc,{baseDirectory:dir});
  assert.match(html,/<figure class="image"><figcaption><span>Settings<\/span><\/figcaption><div class="expand-wrap"><button class="image-expand expand-button"[^>]*hidden>Expand<span class="sr-only"> image<\/span><\/button><img src="data:image\/png;base64,[^"]+" alt="The &lt;settings&gt; screen" width="\d+" height="\d+"><\/div><\/figure>/);
  for(const bad of [{type:'image',file:'preview/notifications-now.png'},{type:'image',file:'C:/x.png',alt:'x'},{type:'image',file:'a/../b.png',alt:'x'},{type:'image',file:'preview/notifications-proposed.html',alt:'x'},{type:'image',file:'x.png',alt:'x',src:'https://example.com/x.png'}]){
    const d=await example('user-guide');d.sections[0].blocks.push(bad);assert.throws(()=>validate(d),/sections\[0\]\.blocks/);
  }
  await mkdir(join(dir,'docs'));await cp(join(dir,'preview'),join(dir,'docs/preview'),{recursive:true});
  await writeFile(join(dir,'docs/guide.json'),JSON.stringify(doc));await writeFile(join(dir,'set.json'),JSON.stringify({documents:[{source:'docs/guide.json',output:'guide.html'}]}));
  await renderSet(join(dir,'set.json'),join(dir,'out'));assert.match(await readFile(join(dir,'out/guide.html'),'utf8'),/data:image\/png;base64,/);
});

test('diagram change marks are drawn, described in text and valid in every mode',async()=>{
  const d=await example('technical');
  const b={type:'diagram',caption:'Branch',description:'A branch.',nodes:[{id:'start',label:'Start',row:0,column:0},{id:'check',label:'Check',row:1,column:0},{id:'fix',label:'Correct source',row:1,column:1,change:'added'}],edges:[{from:'start',to:'check'},{from:'check',to:'fix',label:'Invalid',change:'removed'}]};
  d.overview=[b];const html=await renderDocument(d);
  assert.match(html,/<g class="diagram-node diagram-added">/);assert.match(html,/class="diagram-change-tag"[^>]*>Added<\/text>/);
  assert.match(html,/class="diagram-edge diagram-removed"[^>]*marker-end="url\(#documancer-diagram-1-arrow-removed\)"/);assert.match(html,/id="documancer-diagram-1-arrow-removed"/);
  assert.match(html,/fix: Correct source \(added\)/);assert.match(html,/Check → Correct source: Invalid \(removed\)/);
  b.nodes[0].change='new';assert.throws(()=>validate(d),/overview\[0\]\.nodes\[0\]\.change/);
});
