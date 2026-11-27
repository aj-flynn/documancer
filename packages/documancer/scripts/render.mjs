import {readFile, writeFile, mkdir, realpath} from 'node:fs/promises';
import {resolve, dirname, relative, isAbsolute} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {validateDiagram, diagramHTML, documentDiagramWarnings} from './diagram.mjs';
export {diagramWarnings, documentDiagramWarnings} from './diagram.mjs';
import {validatePreview, previewHTML, previewState, checkPrototype, previewFields, previewReserved} from './preview.mjs';

const assets = new URL('../assets/', import.meta.url);
const company = 'Flynn Technology LLC';
// The JSON and the renderer move together: a document must declare exactly this schema version.
export const schemaVersion = 2;
export const packageVersion = '1.8.0';
const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
// A CSS string: every character that could end it or start an escape is written as a code point.
const cssString = value => '"'+String(value).replace(/[^A-Za-z0-9 ]/gu, char => '\\'+char.codePointAt(0).toString(16)+' ')+'"';
const fail = (path, message) => { throw new Error(`${path}: ${message}`); };
function object(value, keys, path) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(path, 'expected an object');
  for (const key of Object.keys(value)) if (!keys.includes(key)) fail(`${path}.${key}`, 'unknown field');
}
function string(value, path) { if (typeof value !== 'string' || !value.trim()) fail(path, 'expected a nonempty string'); }
function array(value, path, nonempty = true) { if (!Array.isArray(value) || (nonempty && !value.length)) fail(path, 'expected '+(nonempty?'a nonempty':'an')+' array'); }
function strings(value, path) { array(value,path);value.forEach((v,i)=>string(v,`${path}[${i}]`)); }
function href(value, path) {
  string(value,path);
  if (value !== value.trim() || /[\u0000-\u0020\u007f\\]/.test(value) || value.startsWith('//')) fail(path,'unsupported URL');
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) {
    let url; try { url = new URL(value); } catch { fail(path,'invalid URL'); }
    if (!['http:','https:','mailto:'].includes(url.protocol)) fail(path,'unsupported URL scheme');
    if (url.username || url.password) fail(path,'credentials must not be embedded in links');
  } else if (value.split(/[/?#]/)[0].includes(':')) fail(path,'invalid relative URL');
}
function date(value, path) { if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0,10)!==value) fail(path,'expected a valid YYYY-MM-DD date'); }
// Files beside the source: embedded at render time, never fetched. Each has a size limit, and so does their total.
const fileKinds = {image:{extensions:['png','jpg','jpeg','webp'],expected:'a PNG, JPEG or WebP file',limit:1024*1024}, prototype:{extensions:['html'],expected:'an HTML file',limit:1024*1024}};
const totalFileLimit = 6*1024*1024;
export function validate(doc) { inspect(doc); return doc; }
// Validates the document and returns the files it refers to, which need the source folder to check.
function inspect(doc) {
  object(doc,['schemaVersion','mode','title','lead','identity','overview','brand','context','generatedBy','related','sources','sections','setup','tests','evidence',...previewFields],'document');
  if (doc.schemaVersion !== schemaVersion) fail('schemaVersion', Number.isInteger(doc.schemaVersion) && doc.schemaVersion < schemaVersion ? `this document uses schemaVersion ${doc.schemaVersion}; update it to the current data contract and set schemaVersion to ${schemaVersion}` : `expected ${schemaVersion}`);
  if (!['technical','user-guide','uat','preview'].includes(doc.mode)) fail('mode','expected technical, user-guide, uat or preview');
  for (const key of ['title','lead']) string(doc[key],key);
  object(doc.identity,['id','version','date','source','repositoryRoot','branch','commit','readiness'],'identity');
  for (const key of ['id','version','date','source']) string(doc.identity[key],`identity.${key}`);
  for (const [key,value] of Object.entries(doc.identity)) string(value,`identity.${key}`);
  date(doc.identity.date,'identity.date');
  const ids=new Set(['overview','main','document-content','document-data','font-license','doc-search','theme-choice','theme-status','result-counts','generate-summary','summary-state','summary-text','print-summary']);const links=[],files=[];
  function file(value,path,kind,extra={}) {
    string(value,path);
    if(isAbsolute(value)||value.startsWith('/')||/[\\:?#%*"<>|]/.test(value)||value.split('/').some(x=>x==='..'||x==='.'||!x))fail(path,'expected a relative path inside the source folder, with forward slashes');
    if(!value.includes('.')||!fileKinds[kind].extensions.includes(value.split('.').pop().toLowerCase()))fail(path,'expected '+fileKinds[kind].expected);
    files.push({path:value,kind,at:path,...extra});
  }
  function id(value,path,pattern) {string(value,path);if(!pattern.test(value))fail(path,'invalid ID');if(ids.has(value.toLowerCase()))fail(path,'duplicate or reserved ID');ids.add(value.toLowerCase());}
  function link(value,path) {object(value,['label','href'],path);string(value.label,path+'.label');href(value.href,path+'.href');links.push(value.href);}
  function blocks(value,path,depth=0) {
    array(value,path);if(depth>12)fail(path,'block nesting exceeds 12 levels');
    value.forEach((b,i)=>{
      const p=`${path}[${i}]`;if(!b || typeof b!=='object')fail(p,'expected a block');
      const fields={paragraph:['text'],heading:['text'],list:['items'],steps:['items'],code:['text','language'],table:['caption','columns','rows'],callout:['title','text'],details:['title','blocks'],links:['items'],diagram:['caption','description','direction','nodes','edges'],image:['file','alt','caption']}[b.type];
      if(!fields)fail(p+'.type','unsupported block type');object(b,['type',...fields],p);
      if(b.type==='image'){file(b.file,p+'.file','image');string(b.alt,p+'.alt');if(b.caption!==undefined)string(b.caption,p+'.caption');}
      if(['paragraph','heading','code','callout'].includes(b.type))string(b.text,p+'.text');
      if(['callout','details'].includes(b.type))string(b.title,p+'.title');
      if(b.type==='code'&&b.language!==undefined)string(b.language,p+'.language');
      if(['list','steps'].includes(b.type))strings(b.items,p+'.items');
      if(b.type==='links'){array(b.items,p+'.items');b.items.forEach((x,j)=>link(x,`${p}.items[${j}]`));}
      if(b.type==='details')blocks(b.blocks,p+'.blocks',depth+1);
      if(b.type==='diagram')validateDiagram(b,p);
      if(b.type==='table'){string(b.caption,p+'.caption');strings(b.columns,p+'.columns');array(b.rows,p+'.rows');b.rows.forEach((row,j)=>{array(row,`${p}.rows[${j}]`);if(row.length!==b.columns.length)fail(p+'.rows','row width must match columns');row.forEach(v=>{if(typeof v!=='string')fail(p+'.rows','cells must be strings');});});}
    });
  }
  if(doc.brand!==undefined){object(doc.brand,['name','logo'],'brand');if(doc.brand.name!==undefined)string(doc.brand.name,'brand.name');if(doc.brand.logo!==undefined&&!['flynn','none'].includes(doc.brand.logo))fail('brand.logo','expected flynn or none');if(doc.brand.logo==='flynn'&&(doc.brand.name??company)!==company)fail('brand.logo','Flynn wordmark requires the Flynn company name');}
  if(doc.generatedBy!==undefined){
    object(doc.generatedBy,['agent','model'],'generatedBy');
    if(doc.generatedBy.agent===undefined&&doc.generatedBy.model===undefined)fail('generatedBy','expected an agent, a model or both');
    for(const key of ['agent','model'])if(doc.generatedBy[key]!==undefined)string(doc.generatedBy[key],`generatedBy.${key}`);
  }
  if(doc.context!==undefined){
    object(doc.context,['summary','links'],'context');
    if(doc.context.summary===undefined&&doc.context.links===undefined)fail('context','expected a summary, links or both');
    if(doc.context.summary!==undefined){string(doc.context.summary,'context.summary');if(doc.context.summary.length>280)fail('context.summary','expected at most 280 characters');}
    if(doc.context.links!==undefined){array(doc.context.links,'context.links');doc.context.links.forEach((l,i)=>{const p=`context.links[${i}]`;object(l,['kind','label','href'],p);string(l.kind,p+'.kind');string(l.label,p+'.label');href(l.href,p+'.href');links.push(l.href);});}
  }
  for(const key of ['related','sources'])if(doc[key]!==undefined){array(doc[key],key,false);doc[key].forEach((v,i)=>link(v,`${key}[${i}]`));}
  blocks(doc.overview,'overview');
  let previewTargets;
  if(doc.mode!=='preview')for(const key of previewFields)if(doc[key]!==undefined)fail(key,'only supported in preview mode');
  if(doc.mode==='preview'){
    for(const key of ['sections','setup','tests','evidence','related'])if(doc[key]!==undefined)fail(key,'not supported in preview mode');
    for(const reserved of previewReserved)ids.add(reserved);
    for(const [key,prefix] of [['views','view'],['questions','question']])if(Array.isArray(doc[key]))doc[key].forEach((_,i)=>ids.add(`${prefix}-${i}-note`));
    previewTargets=validatePreview(doc,{object,string,array,strings,blocks,id,file,date});
  }else if(doc.mode==='uat'){
    if(doc.sections!==undefined)fail('sections','not supported in UAT mode');
    for(const reserved of ['setup','evidence','summary'])ids.add(reserved);
    blocks(doc.setup,'setup');array(doc.tests,'tests');doc.tests.forEach((_,i)=>ids.add('test-'+i+'-notes'));
    doc.tests.forEach((t,i)=>{const p=`tests[${i}]`;object(t,['id','title','brief','prerequisites','steps','expected','problemSigns','reset','rehearsal'],p);id(t.id,p+'.id',/^[A-Za-z][A-Za-z0-9-]*$/);for(const k of ['title','brief','expected','problemSigns','reset','rehearsal'])string(t[k],p+'.'+k);blocks(t.prerequisites,p+'.prerequisites');strings(t.steps,p+'.steps');});
    if(doc.evidence!==undefined){array(doc.evidence,'evidence',false);doc.evidence.forEach((e,i)=>{const p=`evidence[${i}]`;object(e,['title','status','detail','history'],p);for(const k of ['title','detail'])string(e[k],p+'.'+k);if(!['passed','failed','blocked','untested'].includes(e.status))fail(p+'.status','invalid evidence status');if(e.history!==undefined)string(e.history,p+'.history');});}
  }else{
    for(const key of ['setup','tests','evidence'])if(doc[key]!==undefined)fail(key,'only supported in UAT mode');
    array(doc.sections,'sections');doc.sections.forEach((s,i)=>{const p=`sections[${i}]`;object(s,['id','title','blocks'],p);id(s.id,p+'.id',/^[a-z][a-z0-9-]*$/);string(s.title,p+'.title');blocks(s.blocks,p+'.blocks');});
  }
  const targets=new Set(['overview',...(previewTargets??(doc.mode==='uat'?['setup','summary',...(doc.evidence?.length?['evidence']:[]),...doc.tests.map(t=>t.id)]:doc.sections.map(s=>s.id)))]);
  for(const url of links)if(url.startsWith('#')){let target;try{target=decodeURIComponent(url.slice(1));}catch{fail('link','invalid encoded anchor');}if(!targets.has(target))fail('link',`unknown anchor ${url}`);}
  return {files};
}
const imageType=bytes=>bytes.subarray(0,8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]))?'png':bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff?'jpeg':bytes.subarray(0,4).toString('latin1')==='RIFF'&&bytes.subarray(8,12).toString('latin1')==='WEBP'?'webp':null;
// Reads every referenced file from the source folder, refusing anything outside it, oversized or not what its name says.
async function loadFiles(doc,entries,baseDirectory){
  const loaded=new Map();if(!entries.length)return loaded;
  if(!baseDirectory)fail(entries[0].at,'this document refers to a file beside its source; render it from the source file or pass baseDirectory');
  const root=await realpath(resolve(baseDirectory));let total=0;
  for(const entry of entries){
    if(!loaded.has(entry.path)){
      let target;try{target=await realpath(resolve(root,entry.path));}catch{fail(entry.at,`file not found: ${entry.path}`);}
      const inside=relative(root,target);if(!inside||inside.startsWith('..')||isAbsolute(inside))fail(entry.at,'the file is outside the source folder');
      const bytes=await readFile(target),kind=fileKinds[entry.kind];
      if(bytes.length>kind.limit)fail(entry.at,`${entry.path} is ${Math.ceil(bytes.length/1024)} KB; the limit for one ${entry.kind} is ${kind.limit/1024} KB`);
      total+=bytes.length;if(total>totalFileLimit)fail(entry.at,`the files in this document exceed ${totalFileLimit/1024/1024} MB in total`);
      const item={bytes};
      if(entry.kind==='image'){
        item.type=imageType(bytes);const extension=entry.path.split('.').pop().toLowerCase().replace('jpg','jpeg');
        if(item.type!==extension)fail(entry.at,`${entry.path} is not a valid ${extension.toUpperCase()} image`);
        if(item.type==='png'&&bytes.length>24){item.width=bytes.readUInt32BE(16);item.height=bytes.readUInt32BE(20);}
      }else item.text=bytes.toString('utf8').replace(/^﻿/,'');
      loaded.set(entry.path,item);
    }
    if(entry.kind==='prototype')checkPrototype(loaded.get(entry.path).text,entry,doc,entry.at);
  }
  return loaded;
}
// Validates a document together with the files it refers to, without rendering it.
export async function checkDocument(input,{baseDirectory}={}){const {files}=inspect(input);await loadFiles(input,files,baseDirectory);return input;}
// One hash per preview view, from its content and the bytes of its files. A host compares hashes across preview
// versions to keep a response on a view that did not change. The discussion is left out: it records the conversation, not the proposal.
export async function viewHashes(input,{baseDirectory}={}){
  const {files}=inspect(input);if(input.mode!=='preview')fail('mode','view hashes exist only for preview documents');
  const loaded=await loadFiles(input,files,baseDirectory);
  const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
  return Object.fromEntries(input.views.map((view,i)=>{
    const {discussion,...content}=view,hash=createHash('sha256').update(JSON.stringify(canonical(content)));
    for(const path of [...new Set(files.filter(f=>f.at.startsWith(`views[${i}].`)).map(f=>f.path))].sort())hash.update('\0'+path+'\0').update(loaded.get(path).bytes);
    return [view.id,hash.digest('hex')];
  }));
}

// One icon per kind of section, drawn here so a document needs no icon library. The renderer picks the icon; a document never names one.
const icon=d=>`<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${d}</svg>`;
export const icons={
  problem:icon('<circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 16.5v.5"/>'),
  findings:icon('<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>'),
  impact:icon('<path d="M4 19V9M10 19V5M16 19v-7M21 19H3"/>'),
  question:icon('<path d="M9 9a3 3 0 1 1 4.5 2.6c-.9.6-1.5 1.2-1.5 2.4M12 17.5v.5"/><circle cx="12" cy="12" r="9"/>'),
  screen:icon('<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>'),
  examples:icon('<path d="M4 6h16M4 12h16M4 18h10"/>'),
  data:icon('<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3"/>'),
  access:icon('<circle cx="8" cy="14" r="4"/><path d="M11 11l9-9M16 6l3 3M14 8l2 2"/>'),
  flow:icon('<rect x="3" y="3" width="7" height="6" rx="1"/><rect x="14" y="15" width="7" height="6" rx="1"/><path d="M6.5 9v5a2 2 0 0 0 2 2H14"/>'),
  contract:icon('<path d="M8 4c-2 0-3 1-3 3v2c0 1.5-1 3-2 3 1 0 2 1.5 2 3v2c0 2 1 3 3 3M16 4c2 0 3 1 3 3v2c0 1.5 1 3 2 3-1 0-2 1.5-2 3v2c0 2-1 3-3 3"/>'),
  operations:icon('<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>'),
  info:icon('<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>'),
  work:icon('<path d="M4 7h16v4a2 2 0 0 0 0 4v4H4v-4a2 2 0 0 0 0-4z"/><path d="M14 7v12" stroke-dasharray="2 3"/>'),
  decision:icon('<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 12.5l3 3 5-6"/>'),
  remember:icon('<path d="M7 3h10v18l-5-4-5 4z"/>'),
  warning:icon('<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.5"/>'),
  tip:icon('<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>'),
  steps:icon('<path d="M10 6h10M10 12h10M10 18h10"/><path d="M3.5 5.5l1.5-1v4M3.5 12.5c0-1.5 2.5-1.5 2.5 0 0 1-2.5 1.5-2.5 3h2.5"/>'),
  table:icon('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M3 15h18M9 4v16"/>'),
  page:icon('<path d="M6 3h8l5 5v13H6z"/><path d="M14 3v5h5M9 13h7M9 17h7"/>'),
  help:icon('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.5"/><path d="M5.6 5.6l3.9 3.9M14.5 14.5l3.9 3.9M18.4 5.6l-3.9 3.9M9.5 14.5l-3.9 3.9"/>'),
  test:icon('<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3"/><path d="M7.5 15h9"/>'),
  setup:icon('<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>'),
};
// A callout is a row with an icon. Its kind comes from the words in its title: a warning, a tip, or something to keep in mind.
const calloutKind=title=>/warn|caution|danger|important|never|do not|don't|must not/i.test(title)?'warning':/\b(tip|hint|shortcut)/i.test(title)?'tip':'remember';
const noteHTML=(kind,title,text,extra='')=>`<div class="note note-${kind}${extra}" role="note">${icons[kind]}<div><strong>${escape(title)}</strong><p>${escape(text)}</p></div></div>`;
// A guide section gets its icon and label from what it contains.
const sectionKind=blocks=>{const has=type=>blocks.some(b=>b.type===type);return has('steps')?['steps','Step by step','ok']:has('diagram')?['flow','How it fits together','plain']:has('code')?['contract','Configuration and code','plain']:has('table')?['table','Reference','plain']:has('details')?['help','Help and detail','info']:['page','Read this','plain'];};
const linkHTML=(l,newTab=false)=>`<a href="${escape(l.href)}"${newTab?' target="_blank" rel="noopener noreferrer"':''}>${escape(l.label)}${newTab?'<span class="sr-only"> (opens in a new tab)</span>':''}</a>`;
const listHTML=(items,ordered=false)=>`<${ordered?'ol class="steps"':'ul class="prose-list"'}>${items.map(x=>`<li>${escape(x)}</li>`).join('')}</${ordered?'ol':'ul'}>`;
function blockHTML(blocks,renderLink=linkHTML,renderDiagram,renderImage){return blocks.map(b=>{
  switch(b.type){
    case 'paragraph':return `<p>${escape(b.text)}</p>`;
    case 'heading':return `<h3>${escape(b.text)}</h3>`;
    case 'list':case 'steps':return listHTML(b.items,b.type==='steps');
    case 'code':return `<div class="code-example"><div class="code-toolbar"><span>${escape(b.language??'Code')}</span><button class="copy-code" type="button" aria-label="Copy code: ${escape(b.language??'Code')} example">Copy code</button></div><pre tabindex="0" role="region" aria-label="${escape(b.language??'Code')} example"><code>${escape(b.text)}</code></pre></div>`;
    case 'callout':return noteHTML(calloutKind(b.title),b.title,b.text);
    case 'details':return `<details class="fold"><summary>${escape(b.title)}</summary><div class="fold-body">${blockHTML(b.blocks,renderLink,renderDiagram,renderImage)}</div></details>`;
    case 'diagram':return renderDiagram(b);
    case 'image':return renderImage(b.file,b.alt,b.caption);
    case 'links':return `<ul class="prose-list">${b.items.map(l=>`<li>${renderLink(l)}</li>`).join('')}</ul>`;
    case 'table':return `<div class="table-wrap" tabindex="0" role="region" aria-label="${escape(b.caption)}"><table><caption>${escape(b.caption)}</caption><thead><tr>${b.columns.map(c=>`<th scope="col">${escape(c)}</th>`).join('')}</tr></thead><tbody>${b.rows.map(row=>`<tr>${row.map((c,i)=>i===0?`<th scope="row">${escape(c)}</th>`:`<td>${escape(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  }
}).join('\n');}
// Every section after the introduction is a card: an icon and label that say what kind of section it is, the one thing
// the reader is asked (when there is one), the content, and the answer controls in the foot.
const card=({id,title,icon:name,tone='plain',eyebrow,flag,ask,askLabel,body,foot,attrs='',cls=''})=>`<section id="${escape(id)}" class="card tone-${tone}${cls}"${attrs}><header class="card-head"><span class="card-icon">${icons[name]}</span><div class="card-title"><p class="eyebrow">${escape(eyebrow)}</p><h2>${escape(title)}</h2></div>${flag?`<span class="card-flag">${escape(flag)}</span>`:''}</header>${ask?`<div class="card-ask"><p class="eyebrow">${escape(askLabel)}</p><p>${escape(ask)}</p></div>`:''}<div class="card-body">${body}</div>${foot?`<div class="card-foot">${foot}</div>`:''}</section>`;
const uatResults=[['Passed','✓','It did what it should'],['Failed','✕','It did not'],['Skipped','↷','Chose not to run it'],['Blocked','!','Could not run it'],['Untested','○','Not judged yet']];
const colourKeys={
  technical:[['ok','steps','Step by step: something you do'],['plain','page','Reference: something to read'],['info','help','Help and extra detail']],
  uat:[['hold','setup','Background: read, nothing to record'],['ok','test','A test: you record a result'],['plain','decision','The summary to send back']],
  preview:[['hold','problem','Background: read, nothing to answer'],['info','question','A choice only you can make'],['ok','screen','A decision on one change'],['muted','info','For information only']],
};
const identityLabels={id:'Document',version:'Version',date:'Date',source:'Source identity',repositoryRoot:'Checkout',branch:'Branch',commit:'Commit',readiness:'Readiness'};
export async function renderDocument(input,{companions=[],baseDirectory,preview}={}){
  const {files:fileList}=inspect(input),doc=input;
  if(preview!==undefined&&doc.mode!=='preview')fail('preview','only used with a preview document');
  previewState(preview);
  const files=await loadFiles(doc,fileList,baseDirectory);
  const allowed=companions.filter(c=>c.mode!==doc.mode && c.mode!=='uat');
  const related=allowed.map(c=>({href:c.href,label:doc.related?.find(l=>l.href===c.href)?.label??({'technical':'Technical reference','user-guide':'User guide'}[c.mode])}));
  const destination=l=>companions.find(c=>new URL(l.href,'https://document.invalid/').pathname===new URL(c.href,'https://document.invalid/').pathname && new URL(l.href,'https://document.invalid/').origin==='https://document.invalid');
  const renderLink=l=>{const target=destination(l);if(doc.mode!=='uat'&&target?.mode==='uat')return escape(l.label);return linkHTML(l,doc.mode==='uat'&&['technical','user-guide'].includes(target?.mode));};
  let diagramIndex=0,diagramPrefix='documancer-diagram';
  const authoredIDs=(doc.mode==='preview'?[...(doc.questions??[]),...doc.views]:doc.mode==='uat'?doc.tests:doc.sections).map(item=>item.id);
  while(authoredIDs.some(id=>id.toLowerCase().startsWith(diagramPrefix+'-')))diagramPrefix+='-x';
  // An image is embedded whole. With scripts it can be opened in the same full-window dialog as a diagram.
  const image=(path,alt,caption)=>{const f=files.get(path);return `<figure class="image">${caption?`<figcaption><span>${escape(caption)}</span></figcaption>`:''}<div class="expand-wrap"><button class="image-expand expand-button" type="button" aria-haspopup="dialog" hidden>Expand<span class="sr-only"> image</span></button><img src="data:image/${f.type};base64,${f.bytes.toString('base64')}" alt="${escape(alt)}"${f.width?` width="${f.width}" height="${f.height}"`:''}></div></figure>`;};
  const blocks=items=>blockHTML(items,renderLink,b=>diagramHTML(b,`${diagramPrefix}-${++diagramIndex}`),image);
  const read=name=>readFile(new URL(name,assets),'utf8');
  const [styles,theme,runtime,font,license]=await Promise.all([read('document.css'),read('theme.js'),read('document.js'),readFile(new URL('source-sans-3-variable.woff2',assets)),read('OFL.txt')]);
  const page=doc.mode==='preview'?previewHTML(doc,{blocks,image,files,icons,note:noteHTML,state:preview,frameCSS:await read('preview-frame.css'),frameJS:await read('preview-frame.js')}):null;
  const pageRuntime=page?await read('preview.js'):'';
  const css=styles.replace('url("fonts/source-sans-3-variable.woff2")',`url("data:font/woff2;base64,${font.toString('base64')}")`);
  const brandName=doc.brand?.name??company;const showLogo=(doc.brand?.logo??(brandName===company?'flynn':'none'))==='flynn';
  let brand=escape(brandName);
  if(showLogo){const logos=await Promise.all(['dark','light'].map(async mode=>`<img class="brand-${mode}" src="data:image/svg+xml;base64,${Buffer.from(await read(`flynn-wordmark-on-${mode}.svg`)).toString('base64')}" width="204" height="49" alt="${escape(brandName)}">`));brand=logos.join('');}
  const generatedBy=doc.generatedBy?[doc.generatedBy.agent,doc.generatedBy.model].filter(Boolean).join(', '):'';
  const identityLines=[...Object.entries(doc.identity).map(([k,v])=>`${identityLabels[k]}: ${v}`),...(page?.identity??[]).map(([k,v])=>`${k}: ${v}`),...(generatedBy?[`Generated by: ${generatedBy}`]:[])].join('\n');
  // The intro leads with what the reader acts on. On wide screens the context and the UAT test list move to the detail rail; identity sits in the footer.
  const testLabel=t=>`<span class="test-id">${escape(t.id)}</span> ${escape(t.title)}`;
  const testIndex=doc.mode==='uat'?`<ul class="test-index" aria-label="Tests in this plan">${doc.tests.map(t=>`<li><a href="#${escape(t.id)}">${testLabel(t)}</a><span class="test-status">Untested</span></li>`).join('')}</ul><p class="test-progress"></p>`:page?.index??'';
  const contextLink=l=>{const target=destination(l);if(doc.mode!=='uat'&&target?.mode==='uat')return escape(l.label);return linkHTML(l,/^https?:/i.test(l.href)||(doc.mode==='uat'&&['technical','user-guide'].includes(target?.mode)));};
  const contextBody=doc.context?`${doc.context.summary?`<p class="context-summary">${escape(doc.context.summary)}</p>`:''}${doc.context.links?.length?`<ul class="context-links">${doc.context.links.map(l=>`<li><span>${escape(l.kind)}</span> ${contextLink(l)}</li>`).join('')}</ul>`:''}`:'';
  // The details are written twice: in the footer, which a screen shows, and in the header, which only print shows.
  const identityHTML=`<dl class="document-identity">${Object.entries(doc.identity).filter(([k])=>k!=='source').map(([k,v])=>`<div><dt>${identityLabels[k]}</dt><dd>${escape(v)}</dd></div>`).join('')}${(page?.identity??[]).map(([k,v])=>`<div><dt>${k}</dt><dd>${escape(v)}</dd></div>`).join('')}${generatedBy?`<div><dt>Generated by</dt><dd>${escape(generatedBy)}</dd></div>`:''}</dl>`;
  const colourKey=`<section class="rail-key"><h2>Colours in this document</h2><ul>${colourKeys[doc.mode==='user-guide'?'technical':doc.mode].map(([tone,name,text])=>`<li class="tone-${tone}">${icons[name]}<span>${text}</span></li>`).join('')}</ul></section>`;
  const answers=doc.mode==='uat'?{title:'Results',target:'summary',go:'Go to summary',items:doc.tests.map(t=>t.id),waiting:'No test has a result yet.'}:page?{title:'Your responses',target:'decision',go:'Go to your decision',items:page.answering,waiting:'Nothing is answered yet.'}:null;
  const rail=`<aside class="detail-rail" aria-label="Document details">${contextBody?`<section><h2>At a glance</h2>${contextBody}</section>`:''}${answers?`<section><h2>${answers.title}</h2><div class="meter" aria-hidden="true"><i></i></div>${testIndex}<a class="rail-button" href="#${answers.target}">${answers.go}</a></section>`:'<section class="section-outline" hidden><h2>On this page</h2><ol></ol></section>'}${colourKey}</aside>`;
  // Below the width where the detail rail fits, a thin bar keeps the count and a link to each answer in view.
  const answerBar=answers?`<nav class="answer-bar screen-only" aria-label="${answers.title}"><span class="answer-count">${answers.waiting}</span><span class="answer-dots">${answers.items.map(id=>`<a href="#${escape(id)}" data-dot="${escape(id)}">${escape(id)}</a>`).join('')}</span><a class="answer-go" href="#${answers.target}">${answers.go.replace('Go to ','').replace(/^./,c=>c.toUpperCase())}</a></nav>`:'';
  let body=`<section id="overview" class="doc-intro"><h1>${escape(doc.title)}</h1><p class="lead">${escape(doc.lead)}</p>${contextBody?`<div class="context-box"><h2>At a glance</h2>${contextBody}</div>`:''}${blocks(doc.overview)}${testIndex}${doc.sources?.length?'<h3>Sources</h3><ul class="prose-list">'+doc.sources.map(l=>`<li>${renderLink(l)}</li>`).join('')+'</ul>':''}</section>`;
  const nav=[{id:'overview',title:'Overview',icon:'page',tone:'plain'}];
  const add=(group,part)=>{nav.push({...part,group});body+=card(part);};
  if(doc.mode==='uat'){
    add('Background',{id:'setup',title:'Shared setup',icon:'setup',tone:'hold',eyebrow:'Before you start',body:blocks(doc.setup)+noteHTML('remember','Keep this page open','Results and notes are held in this tab only. Generate and keep the summary before closing or reloading. Agent rehearsal and automated checks do not record human acceptance.',' screen-only')});
    for(const [index,t] of doc.tests.entries())add('Tests',{id:t.id,title:t.title,icon:'test',tone:'ok',eyebrow:`Test · ${t.id}`,ask:t.brief,askLabel:'You are judging',dot:true,cls:' test-case',attrs:` data-test="${escape(t.id)}" data-title="${escape(t.title)}"`,
      body:`<h3>Before you start</h3>${blocks(t.prerequisites)}<h3>Do this</h3>${listHTML(t.steps,true)}<div class="pass-when"><b>Pass when</b>${escape(t.expected)}</div>${noteHTML('warning','Signs of a problem',t.problemSigns)}<details class="fold"><summary>Reset, and how this was rehearsed</summary><div class="fold-body"><p><strong>Reset or dependencies.</strong> ${escape(t.reset)}</p><p><strong>Agent rehearsal.</strong> ${escape(t.rehearsal)}</p></div></details>`,
      foot:`<fieldset class="answer"><legend>Result for ${escape(t.id)}</legend><div class="answers">${uatResults.map(([s,mark,hint])=>`<label class="answer-${s.toLowerCase()}"><input class="sr-only" type="radio" name="test-${index}-result" value="${s}" ${s==='Untested'?'checked':''}><strong><span class="mark" aria-hidden="true">${mark}</span>${s}</strong><small>${hint}</small></label>`).join('')}</div></fieldset><label class="notes-label" for="test-${index}-notes">Notes for ${escape(t.id)}</label><textarea id="test-${index}-notes" rows="3" placeholder="What happened? Include unexpected behavior or anything that prevented the test."></textarea><p class="print-result"></p><pre class="print-notes"></pre>`});
    if(doc.evidence?.length)add('Finish',{id:'evidence',title:'Automated evidence',icon:'findings',tone:'muted',eyebrow:'Read only · not human acceptance',body:'<p>Read-only verification; excluded from human acceptance totals.</p>'+doc.evidence.map(e=>`<div class="evidence-entry"><h3>${escape(e.title)}</h3><p><strong>${escape(e.status)}</strong> — ${escape(e.detail)}</p>${e.history?'<p><strong>History:</strong> '+escape(e.history)+'</p>':''}</div>`).join('')});
    add('Finish',{id:'summary',title:'Summary',icon:'decision',tone:'plain',eyebrow:'Last step',cls:' card-final',body:'<p id="result-counts" aria-live="polite"></p><p>Failed or blocked tests need attention. Skipped and untested tests remain unaccepted.</p><button class="primary-button" id="generate-summary" type="button">Generate summary</button><p id="summary-state" role="status">Generating also copies the summary to your clipboard.</p><label class="notes-label" for="summary-text">Generated summary</label><textarea id="summary-text" rows="12" readonly placeholder="Your summary will appear here."></textarea><pre id="print-summary"></pre>'});
  }else if(page)for(const part of page.parts)add(part.group,part);
  else for(const s of doc.sections){const [name,eyebrow,tone]=sectionKind(s.blocks);add('Contents',{id:s.id,title:s.title,icon:name,tone,eyebrow,body:blocks(s.blocks)});}
  let navGroup;const navHTML=nav.map(n=>`${n.group&&n.group!==navGroup?`<p class="nav-group">${escape(navGroup=n.group)}</p>`:''}<a href="#${escape(n.id)}" class="tone-${n.tone}"><span class="nav-icon">${icons[n.icon]}</span><span class="nav-text">${escape(n.title)}</span>${n.dot?`<span class="dot" data-dot="${escape(n.id)}"></span>`:''}</a>`).join('');
  const summaryData={title:doc.title,identity:identityLines,evidence:doc.evidence??[],...(page?{preview:page.data}:{})};
  const safeJSON=JSON.stringify(summaryData).replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/&/g,'\\u0026');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="generator" content="Documancer ${packageVersion}"><title>${escape(doc.title)} · ${escape(brandName)}</title><script>${theme}</script><style>${css}@page{@bottom-left{content:${cssString(doc.title)}}}</style></head><body><a class="skip" href="#document-content">Skip to documentation</a><header class="site-header"><a class="brand-link" href="#overview">${brand}</a><span class="header-doc-title" aria-hidden="true">${escape(doc.title)}</span>${related.length?'<nav class="document-links" aria-label="Related documents">'+related.map(l=>renderLink(l)).join('')+'</nav>':''}${identityHTML}</header><main id="main" class="doc-layout"><aside class="sidebar" aria-label="Document navigation"><div class="sidebar-inner"><div class="sidebar-scroll"><label class="search-label" for="doc-search">Find in this document</label><input id="doc-search" type="search" placeholder="Search topics" autocomplete="off"><p class="search-feedback" aria-live="polite"></p><details class="handbook-menu" open><summary>Browse documentation</summary><nav aria-label="Documentation">${navHTML}</nav></details></div><div class="theme-control"><label for="theme-choice">Appearance</label><select id="theme-choice" aria-describedby="theme-status"><option value="system">System</option><option value="dark">Dark</option><option value="light">Light</option><option value="cyber">Cyberpunk '80s</option><option value="neo">Cyberpunk modern</option></select><span id="theme-status" class="sr-only" aria-live="polite"></span></div></div></aside><article class="article" id="document-content" tabindex="-1"><noscript><p>Document content is available. Enable JavaScript for search, appearance controls, copying, prototypes, and UAT or preview responses.</p></noscript>${answerBar}${body}</article>${rail}</main><footer class="doc-footer"><span>${escape(brandName)}</span>${identityHTML}<a href="#overview">Back to overview</a></footer><div class="live-message" role="status" aria-live="polite"></div><script type="application/json" id="document-data">${safeJSON}</script><script>${runtime}</script>${pageRuntime?`<script>${pageRuntime}</script>`:''}<script type="text/plain" id="font-license">${license.replace(/<\/script/gi,'<\\/script')}</script></body></html>`;
}

// A set is the publication boundary: only its members become companion links.
export async function renderSet(manifestPath,outputDirectory,{warn}={}){
  const manifestFile=resolve(manifestPath),outputRoot=resolve(outputDirectory);
  const manifest=JSON.parse((await readFile(manifestFile,'utf8')).replace(/^\uFEFF/,''));
  object(manifest,['documents'],'set');array(manifest.documents,'set.documents');
  const outputs=new Set(),modes=new Set();const entries=[];
  for(const [i,entry] of manifest.documents.entries()){
    const p='set.documents['+i+']';object(entry,['source','output'],p);string(entry.source,p+'.source');string(entry.output,p+'.output');
    if(isAbsolute(entry.output)||entry.output.includes('\\')||entry.output.split('/').some(x=>x==='..'||x==='.'||!x)||!entry.output.endsWith('.html')||/[?#:%]/.test(entry.output))fail(p+'.output','expected a relative HTML path without traversal or URL delimiters');
    const key=entry.output.toLowerCase();if(outputs.has(key))fail(p+'.output','duplicate output');outputs.add(key);
    const input=resolve(dirname(manifestFile),entry.source),output=resolve(outputRoot,entry.output);
    if(input.toLowerCase()===output.toLowerCase())fail(p+'.output','cannot overwrite input');
    const doc=validate(JSON.parse((await readFile(input,'utf8')).replace(/^\uFEFF/,'')));
    if(doc.mode==='preview')fail(p+'.source','a preview is a working document and cannot be part of a set; render it on its own');
    if(modes.has(doc.mode))fail(p+'.source','a set supports one document per mode');modes.add(doc.mode);
    if(warn)for(const w of documentDiagramWarnings(doc))warn(`${entry.source}: ${w}`);
    entries.push({doc,output,baseDirectory:dirname(input)});
  }
  const generated=await Promise.all(entries.map(async entry=>({output:entry.output,html:await renderDocument(entry.doc,{baseDirectory:entry.baseDirectory,companions:entries.filter(e=>e!==entry).map(e=>({mode:e.doc.mode,href:relative(dirname(entry.output),e.output).replaceAll('\\','/').split('/').map(encodeURIComponent).join('/')}))})})));
  for(const entry of generated){await mkdir(dirname(entry.output),{recursive:true});await writeFile(entry.output,entry.html,'utf8');}
  return generated.map(e=>e.output);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  // Diagram warnings go to stderr and do not fail the command.
  const warning=message=>console.error('Warning: '+message);
  try{
    if(process.argv[2]==='--set'){
      if(process.argv.length!==5)throw new Error('Usage: node render.mjs --set <set.json> <output-directory>');
      for(const output of await renderSet(process.argv[3],process.argv[4],{warn:warning}))console.log('Rendered '+output);
    }else if(process.argv[2]==='--check'){
      if(process.argv.length!==4)throw new Error('Usage: node render.mjs --check <source.json>');
      const input=resolve(process.argv[3]);
      const doc=await checkDocument(JSON.parse((await readFile(input,'utf8')).replace(/^\uFEFF/,'')),{baseDirectory:dirname(input)});console.log('Valid '+input);documentDiagramWarnings(doc).forEach(warning);
    }else{
      if(process.argv.length!==4)throw new Error('Usage: node render.mjs <source.json> <output.html> OR --set <set.json> <output-directory> OR --check <source.json>');
      const input=resolve(process.argv[2]),output=resolve(process.argv[3]);
      if(input.toLowerCase()===output.toLowerCase())throw new Error('Input and output paths must differ');
      if(!output.toLowerCase().endsWith('.html'))throw new Error('Output must have an .html extension');
      const doc=JSON.parse((await readFile(input,'utf8')).replace(/^\uFEFF/,''));
      const html=await renderDocument(doc,{baseDirectory:dirname(input)});await mkdir(dirname(output),{recursive:true});await writeFile(output,html,'utf8');console.log('Rendered '+output);documentDiagramWarnings(doc).forEach(warning);
    }
  }catch(error){console.error(error.message);process.exitCode=1;}
}
