// Preview mode: shows what a ticket would change before it is built, and collects the reader's response.
// The agent writes content only. Layout, the prototype frame, response controls and submit logic live here and in assets/preview*.
import {validateDiagram} from './diagram.mjs';

const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fail = (path, message) => { throw new Error(`${path}: ${message}`); };
const json = value => JSON.stringify(value).replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/&/g,'\\u0026');
const capital = text => text[0].toUpperCase() + text.slice(1);
const oneOf = (value, allowed, path) => { if (!allowed.includes(value)) fail(path, 'expected ' + allowed.join(', ').replace(/, ([^,]*)$/, ' or $1')); };

export const previewFields = ['ticket','problem','findings','impact','questions','views','work','leaveAsIs'];
// The reader's name for each kind of view. The kind also fixes the icon; data and access views carry a flag in the card heading.
const kinds = {screen:'Screen', examples:'Rule', data:'Stored data', access:'Who can do what', flow:'How it works', contract:'Connection to other apps', operations:'Rollout'};
const flags = {data:'Changes stored data', access:'Changes who can do what'};
const kindFields = {screen:['now','proposed'], examples:['columns','rows'], data:['tables','existingRows','diagram'], access:['actors','actions','cells'], flow:['diagram'], contract:['name','consumers','now','proposed'], operations:['blocks']};
const bases = {screenshot:'a screenshot', generated:'generated output', read:'reading the code', inferred:'inference'};
const impactLabels = {storedData:'Changes stored data', access:'Changes who can do what', retainedHistory:'Affects retained history', qaReset:'Needs a QA reset', reversible:'Can be reversed'};
// The answers to a view: the stored value, its mark, the button text and the hint under it.
const answers = [['ok','✓','Yes, build this','No note needed'],['change','Δ','Change it','Say what to change'],['question','?','Ask first','The agent answers you'],['drop','✕','Drop it','Leave this out'],['later','…','Later','Park it for now']];
const tableChanges = ['added','removed','changed','unchanged'];
const itemID = /^[A-Za-z][A-Za-z0-9-]*$/, optionID = /^[A-Za-z0-9][A-Za-z0-9-]*$/;
// IDs the page itself uses in preview mode; authored IDs may not take them.
export const previewReserved = ['problem','findings','impact','work','decision','decision-counts','decision-open','decision-note','decision-primary','decision-reject','ok-remaining'];

// The first thing the reader sees must be in user terms: no file paths and no code identifiers.
// Text in backticks is exempt, so a symptom can still quote what the product prints.
export function codeName(text) {
  const plain = text.replace(/`[^`]*`/g, ' ').replace(/\bhttps?:\/\/\S+/g, ' ');
  const pattern = /(?:[\w.-]+[\\/]){2,}[\w.-]+|(?:[\w.-]+[\\/])+[\w-]+\.[A-Za-z]{1,5}\b|\b[\w-]+\.(?:m?[jt]sx?|cjs|py|rb|go|rs|java|cs|sql|json|ya?ml|html?|s?css|md|toml|sh|php)\b|\b[a-z][a-z0-9]*[A-Z][A-Za-z0-9]*\b|\b[A-Za-z0-9]+_[A-Za-z0-9_]+\b|\b\w+\(\)/g;
  for (const match of plain.matchAll(pattern)) if (!/^[\d\\/.-]+$/.test(match[0])) return match[0];
  return null;
}

const attribute = name => new RegExp(`(?<![-\\w])${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'gi');
const values = (html, name) => [...html.matchAll(attribute(name))].map(m => (m[1] ?? m[2] ?? m[3]).trim());

function condition(value, path, questions) {
  const match = typeof value === 'string' && value.match(/^([^=\s]+)=([^=\s]+)$/);
  if (!match) fail(path, 'expected question=option, for example q2=2b');
  const question = questions.find(q => q.id === match[1]);
  if (!question) fail(path, `unknown question ${match[1]}`);
  if (!question.options.some(o => o.id === match[2])) fail(path, `${match[2]} is not an option of ${match[1]}`);
}

export function validatePreview(doc, t) {
  const {object, string, array, strings, blocks, id, file, date} = t;
  const list = (value, path) => { array(value, path, false); return value; };
  const optionalStrings = (value, path) => { if (value !== undefined) list(value, path).forEach((x, i) => string(x, `${path}[${i}]`)); };
  const optionalBlocks = (value, path) => { if (value !== undefined) { list(value, path); if (value.length) blocks(value, path); } };
  const discussion = (value, path) => { if (value !== undefined) list(value, path).forEach((d, i) => { const p = `${path}[${i}]`; object(d, ['from','text'], p); oneOf(d.from, ['founder','agent'], p+'.from'); string(d.text, p+'.text'); }); };
  const local = (value, path, seen, pattern = itemID) => { string(value, path); if (!pattern.test(value)) fail(path, 'invalid ID'); if (seen.has(value.toLowerCase())) fail(path, 'duplicate ID'); seen.add(value.toLowerCase()); };
  const diagram = (value, path) => { if (!value || value.type !== 'diagram') fail(path, 'expected a diagram block'); validateDiagram(value, path); };
  const code = (value, path) => { object(value, ['type','text','language'], path); if (value.type !== 'code') fail(path+'.type', 'expected code'); string(value.text, path+'.text'); if (value.language !== undefined) string(value.language, path+'.language'); };

  object(doc.ticket, ['repository','number','version','origin','kind','builtAt','surfaces'], 'ticket');
  string(doc.ticket.repository, 'ticket.repository');
  if (!/^[\w.-]+\/[\w.-]+$/.test(doc.ticket.repository)) fail('ticket.repository', 'expected owner/name');
  for (const key of ['number','version']) if (!Number.isInteger(doc.ticket[key]) || doc.ticket[key] < 1) fail(`ticket.${key}`, 'expected a positive integer');
  oneOf(doc.ticket.origin, ['agent','founder'], 'ticket.origin');
  string(doc.ticket.kind, 'ticket.kind');
  object(doc.ticket.builtAt, ['commit','date'], 'ticket.builtAt');
  string(doc.ticket.builtAt.commit, 'ticket.builtAt.commit');
  if (!/^[0-9a-f]{7,40}$/i.test(doc.ticket.builtAt.commit)) fail('ticket.builtAt.commit', 'expected a commit hash of 7 to 40 hexadecimal characters');
  date(doc.ticket.builtAt.date, 'ticket.builtAt.date');
  list(doc.ticket.surfaces, 'ticket.surfaces').forEach((x, i) => string(x, `ticket.surfaces[${i}]`));

  object(doc.problem, ['symptom','evidence','impact','source'], 'problem');
  for (const key of ['symptom','impact','source']) string(doc.problem[key], `problem.${key}`);
  const named = codeName(doc.problem.symptom);
  if (named) fail('problem.symptom', `"${named}" looks like a file path or code name; describe the symptom in user terms, or put text the product prints in backticks`);
  blocks(doc.problem.evidence, 'problem.evidence');

  if (doc.findings !== undefined) list(doc.findings, 'findings').forEach((f, i) => { const p = `findings[${i}]`; object(f, ['title','text','basis'], p); string(f.title, p+'.title'); string(f.text, p+'.text'); oneOf(f.basis, ['checked','inferred'], p+'.basis'); });

  object(doc.impact, Object.keys(impactLabels), 'impact');
  for (const key of Object.keys(impactLabels)) {
    const p = `impact.${key}`; object(doc.impact[key], ['answer','note'], p);
    oneOf(doc.impact[key].answer, ['yes','no','unknown'], p+'.answer');
    if (doc.impact[key].note !== undefined || doc.impact[key].answer !== 'no') string(doc.impact[key].note, p+'.note');
  }

  const questions = doc.questions === undefined ? [] : list(doc.questions, 'questions');
  questions.forEach((q, i) => {
    const p = `questions[${i}]`; object(q, ['id','title','blocks','options','recommended','reason','discussion'], p);
    id(q.id, p+'.id', itemID); string(q.title, p+'.title'); optionalBlocks(q.blocks, p+'.blocks');
    array(q.options, p+'.options'); if (q.options.length < 2) fail(p+'.options', 'expected at least two options');
    const seen = new Set(['none']);
    q.options.forEach((o, j) => { const op = `${p}.options[${j}]`; object(o, ['id','label','detail'], op); local(o.id, op+'.id', seen, optionID); string(o.label, op+'.label'); if (o.detail !== undefined) string(o.detail, op+'.detail'); });
    if (!q.options.some(o => o.id === q.recommended)) fail(p+'.recommended', 'expected the ID of one of the options');
    string(q.reason, p+'.reason'); discussion(q.discussion, p+'.discussion');
  });

  array(doc.views, 'views');
  doc.views.forEach((v, i) => {
    const p = `views[${i}]`;
    if (!v || typeof v !== 'object' || Array.isArray(v)) fail(p, 'expected an object');
    oneOf(v.kind, Object.keys(kinds), p+'.kind');
    object(v, ['id','kind','title','ask','basis','informational','files','areas','changes','unchanged','notes','discussion', ...kindFields[v.kind]], p);
    id(v.id, p+'.id', itemID); string(v.title, p+'.title'); oneOf(v.basis, Object.keys(bases), p+'.basis');
    if (v.informational !== undefined && typeof v.informational !== 'boolean') fail(p+'.informational', 'expected true or false');
    optionalStrings(v.files, p+'.files'); optionalStrings(v.areas, p+'.areas'); optionalStrings(v.unchanged, p+'.unchanged');
    // The one question the reader answers on this view. A view that changes nothing asks nothing.
    if (v.informational) { if (v.ask !== undefined) fail(p+'.ask', 'an informational view asks nothing'); } else string(v.ask, p+'.ask'); optionalBlocks(v.notes, p+'.notes'); discussion(v.discussion, p+'.discussion');
    const changeIDs = new Set();
    if (v.changes !== undefined) list(v.changes, p+'.changes').forEach((c, j) => { const cp = `${p}.changes[${j}]`; object(c, ['id','label','detail','now','proposed','when'], cp); local(c.id, cp+'.id', changeIDs); string(c.label, cp+'.label'); if (c.detail !== undefined) string(c.detail, cp+'.detail'); if (c.now !== undefined || c.proposed !== undefined) { string(c.now, cp+'.now'); string(c.proposed, cp+'.proposed'); } if (c.when !== undefined) condition(c.when, cp+'.when', questions); });
    if (v.informational && v.changes?.length) fail(p+'.changes', 'an informational view changes nothing');
    if (!v.informational && !v.changes?.length) fail(p+'.changes', 'a view that needs a decision lists at least one change, in plain language');
    if (v.kind === 'screen') {
      if (v.now !== undefined) { object(v.now, ['image','alt'], p+'.now'); file(v.now.image, p+'.now.image', 'image'); string(v.now.alt, p+'.now.alt'); }
      if (v.informational) {
        if (v.now === undefined) fail(p+'.now', 'an informational screen shows the current screen');
        if (v.proposed !== undefined) fail(p+'.proposed', 'an informational view shows now only');
      } else {
        object(v.proposed, ['prototype','image','alt'], p+'.proposed');
        if ((v.proposed.prototype === undefined) === (v.proposed.image === undefined)) fail(p+'.proposed', 'expected either a prototype or an image');
        if (v.proposed.prototype !== undefined) {
          if (v.proposed.alt !== undefined) fail(p+'.proposed.alt', 'only used with an image');
          file(v.proposed.prototype, p+'.proposed.prototype', 'prototype', {view: v, viewPath: p});
        } else { file(v.proposed.image, p+'.proposed.image', 'image'); string(v.proposed.alt, p+'.proposed.alt'); }
      }
    }
    if (v.kind === 'examples') {
      strings(v.columns, p+'.columns'); array(v.rows, p+'.rows'); const seen = new Set();
      v.rows.forEach((r, j) => {
        const rp = `${p}.rows[${j}]`; object(r, ['id','inputs','now','proposed','changed'], rp); local(r.id, rp+'.id', seen);
        array(r.inputs, rp+'.inputs'); if (r.inputs.length !== v.columns.length) fail(rp+'.inputs', 'expected one input per column');
        r.inputs.forEach(x => { if (typeof x !== 'string') fail(rp+'.inputs', 'inputs must be strings'); });
        string(r.now, rp+'.now'); string(r.proposed, rp+'.proposed');
        if (typeof r.changed !== 'boolean') fail(rp+'.changed', 'expected true or false');
      });
    }
    if (v.kind === 'data') {
      array(v.tables, p+'.tables');
      v.tables.forEach((table, j) => {
        const tp = `${p}.tables[${j}]`; object(table, ['name','change','columns'], tp); string(table.name, tp+'.name'); oneOf(table.change, tableChanges, tp+'.change'); array(table.columns, tp+'.columns');
        table.columns.forEach((c, k) => {
          const cp = `${tp}.columns[${k}]`; object(c, ['name','type','nullable','change','was'], cp); string(c.name, cp+'.name'); string(c.type, cp+'.type');
          if (typeof c.nullable !== 'boolean') fail(cp+'.nullable', 'expected true or false');
          oneOf(c.change, tableChanges, cp+'.change');
          if (c.was !== undefined || c.change === 'changed') string(c.was, cp+'.was');
        });
      });
      string(v.existingRows, p+'.existingRows');
      if (v.diagram !== undefined) diagram(v.diagram, p+'.diagram');
    }
    if (v.kind === 'access') {
      for (const key of ['actors','actions']) { strings(v[key], `${p}.${key}`); if (new Set(v[key]).size !== v[key].length) fail(`${p}.${key}`, 'duplicate entry'); }
      array(v.cells, p+'.cells'); const seen = new Set();
      v.cells.forEach((c, j) => {
        const cp = `${p}.cells[${j}]`; object(c, ['actor','action','now','proposed','condition'], cp);
        if (!v.actors.includes(c.actor)) fail(cp+'.actor', 'unknown actor'); if (!v.actions.includes(c.action)) fail(cp+'.action', 'unknown action');
        const pair = JSON.stringify([c.actor, c.action]); if (seen.has(pair)) fail(cp, 'duplicate cell'); seen.add(pair);
        oneOf(c.now, ['yes','no'], cp+'.now'); oneOf(c.proposed, ['yes','no'], cp+'.proposed');
        if (c.condition !== undefined) string(c.condition, cp+'.condition');
      });
    }
    if (v.kind === 'flow') diagram(v.diagram, p+'.diagram');
    if (v.kind === 'contract') { string(v.name, p+'.name'); strings(v.consumers, p+'.consumers'); if (v.now !== undefined) code(v.now, p+'.now'); code(v.proposed, p+'.proposed'); }
    if (v.kind === 'operations') blocks(v.blocks, p+'.blocks');
  });

  if (doc.work !== undefined) list(doc.work, 'work').forEach((w, i) => { const p = `work[${i}]`; object(w, ['title','outcome','size','touches'], p); string(w.title, p+'.title'); string(w.outcome, p+'.outcome'); oneOf(w.size, ['small','medium','large'], p+'.size'); optionalStrings(w.touches, p+'.touches'); });
  string(doc.leaveAsIs, 'leaveAsIs');
  return ['problem','impact','decision', ...(doc.findings?.length ? ['findings'] : []), ...(doc.work?.length ? ['work'] : []), ...questions.map(q => q.id), ...doc.views.map(v => v.id)];
}

// A prototype is one self-contained HTML file. It is embedded in a sandboxed frame with a policy that blocks every
// network request, so anything it loads must already be inside it. Its change points must match the view's list.
export function checkPrototype(html, {view, viewPath}, doc, path) {
  const outside = (name, value) => fail(path, `${name} "${value.slice(0, 60)}" points outside the prototype file; embed it as a data URI`);
  if (/<meta\b[^>]*http-equiv/i.test(html)) fail(path, 'a prototype must not set http-equiv metadata');
  const element = html.match(/<(base|iframe|frame|object|embed|applet|portal)\b/i);
  if (element) fail(path, `a prototype must not contain a ${element[1].toLowerCase()} element`);
  if (/@import\b/i.test(html)) fail(path, 'a prototype must not use @import; put the styles in the file');
  if (/\blocation\s*(?:\.\s*(?:href|assign|replace)\b|=[^=])/.test(html)) fail(path, 'a prototype must not navigate; show and hide content inside the file instead');
  for (const name of ['src','srcset','poster','action','formaction','background','ping','manifest']) for (const value of values(html, name)) if (value && !/^(data:|#)/i.test(value)) outside(name, value);
  for (const tag of html.matchAll(/<(?:link|image|use|script|feImage)\b[^>]*>/gi)) for (const value of values(tag[0], '(?:xlink:)?href')) if (value && !/^(data:|#)/i.test(value)) outside('href', value);
  for (const match of html.matchAll(/url\(\s*(["']?)([^)"']*)\1\s*\)/gi)) if (match[2].trim() && !/^(data:|#)/i.test(match[2].trim())) outside('url()', match[2].trim());
  const questions = doc.questions ?? [];
  for (const value of values(html, 'data-when')) condition(value, `${path} data-when="${value}"`, questions);
  const marked = new Set(values(html, 'data-change'));
  view.changes.forEach((c, i) => { if (!marked.has(c.id)) fail(`${viewPath}.changes[${i}].id`, `no element in ${view.proposed.prototype} carries data-change="${c.id}"`); });
  for (const value of marked) if (!view.changes.some(c => c.id === value)) fail(path, `data-change="${value}" is not declared in ${viewPath}.changes`);
}

// The questions whose answer alters a view: named by a change's `when` or by data-when in its prototype.
function variesBy(view, html, questions) {
  const named = new Set([...(view.changes ?? []).map(c => c.when).filter(Boolean), ...(html ? values(html, 'data-when') : [])].map(when => when.split('=')[0]));
  return questions.filter(q => named.has(q.id));
}

function frameDocument(html, config, t) {
  const head = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:; font-src data:; media-src data:"><style>${t.frameCSS}</style>`;
  const script = `<script>{const config=${json(config)};${t.frameJS}}</script>`;
  const at = [/<head\b[^>]*>/i, /<html\b[^>]*>/i, /<!doctype[^>]*>/i].map(pattern => html.match(pattern)).find(Boolean);
  const start = at ? at.index + at[0].length : 0;
  const page = (at ? '' : '<!doctype html>') + html.slice(0, start) + head + html.slice(start);
  const end = page.toLowerCase().lastIndexOf('</body');
  return end < 0 ? page + script : page.slice(0, end) + script + page.slice(end);
}

// Earlier responses come from the host at render time, never from the source JSON. Entries for views or
// questions that no longer exist are dropped, since a revision may remove them.
function carriedResponses(doc, state) {
  const given = state?.responses ?? {}, result = {views: {}, questions: {}};
  if (typeof given !== 'object' || Array.isArray(given)) fail('preview.responses', 'expected an object');
  for (const [id, r] of Object.entries(given.views ?? {})) {
    const view = doc.views.find(v => v.id === id); if (!view || view.informational) continue;
    const p = `preview.responses.views.${id}`;
    if (!r || typeof r !== 'object') fail(p, 'expected an object');
    oneOf(r.response, answers.map(x => x[0]), p+'.response');
    if (r.response !== 'ok' && (typeof r.note !== 'string' || !r.note.trim())) fail(p+'.note', 'a response other than ok needs a note');
    result.views[id] = {response: r.response, note: typeof r.note === 'string' ? r.note : '', options: r.options && typeof r.options === 'object' ? r.options : {}, bulk: r.bulk === true};
  }
  for (const [id, r] of Object.entries(given.questions ?? {})) {
    const question = (doc.questions ?? []).find(q => q.id === id); if (!question) continue;
    const p = `preview.responses.questions.${id}`;
    if (!r || typeof r !== 'object') fail(p, 'expected an object');
    if (r.choice !== 'none' && !question.options.some(o => o.id === r.choice)) continue;
    if (r.choice === 'none' && (typeof r.note !== 'string' || !r.note.trim())) fail(p+'.note', 'none of these needs a note');
    result.questions[id] = {choice: r.choice, note: typeof r.note === 'string' ? r.note : ''};
  }
  return result;
}

export function previewState(state) {
  if (state === undefined) return;
  if (!state || typeof state !== 'object' || Array.isArray(state)) fail('preview', 'expected an object');
  for (const key of Object.keys(state)) if (!['responses','submitUrl'].includes(key)) fail(`preview.${key}`, 'unknown option');
  if (state.submitUrl !== undefined) {
    let url; try { url = new URL(state.submitUrl); } catch { fail('preview.submitUrl', 'expected an absolute http or https URL'); }
    if (!['http:','https:'].includes(url.protocol) || url.username || url.password) fail('preview.submitUrl', 'expected an absolute http or https URL without credentials');
  }
}

// t supplies the shared renderer's pieces: blocks(items), image(file, alt, caption) and note(kind, title, text) return HTML,
// files maps a path to its loaded content, frameCSS and frameJS go into every prototype frame.
// Each part is one card: the renderer adds the icon, the heading and the sidebar entry.
export function previewHTML(doc, t) {
  const questions = doc.questions ?? [], carried = carriedResponses(doc, t.state);
  const label = (id, title) => `<span class="test-id">${escape(id)}</span> ${escape(title)}`;
  const inlineCode = text => escape(text).replace(/`([^`]+)`/g, '<code>$1</code>');
  const mark = text => `<em class="change-mark">${escape(text)}</em>`;
  const table = (caption, head, rows) => `<div class="table-wrap" tabindex="0" role="region" aria-label="${escape(caption)}"><table><caption>${escape(caption)}</caption><thead><tr>${head.map(h => `<th scope="col">${escape(h)}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
  const fold = (title, body, cls = '') => `<details class="fold${cls}"><summary>${title}</summary><div class="fold-body">${body}</div></details>`;
  const discussion = items => items?.length ? `<div class="discussion"><h3>Earlier discussion</h3>${items.map(d => `<p class="said"><strong>${d.from === 'founder' ? 'Founder' : 'Agent'}:</strong> ${escape(d.text)}</p>`).join('')}</div>` : '';
  const carriedNote = '<p class="carried">Carried over from your response to an earlier version. Change it if it no longer holds.</p>';
  const whenText = when => { const [q, o] = when.split('='); return `Only with ${q} = ${o}`; };
  const parts = [], data = {ticket: {repository: doc.ticket.repository, number: doc.ticket.number, version: doc.ticket.version}, submitUrl: t.state?.submitUrl ?? null, questions: [], views: []};

  parts.push({group: 'Background', id: 'problem', title: 'The problem', icon: 'problem', tone: 'hold', eyebrow: 'Why this ticket exists', body: `<p class="problem-symptom">${inlineCode(doc.problem.symptom)}</p>${t.blocks(doc.problem.evidence)}<p><strong>Why it matters.</strong> ${escape(doc.problem.impact)}</p>${fold('Where this came from', `<p><span class="origin">${doc.ticket.origin === 'agent' ? 'Raised by an agent' : 'Raised by the founder'}</span> ${escape(doc.problem.source)}</p>`)}`});
  if (doc.findings?.length) parts.push({group: 'Background', id: 'findings', title: 'What the request missed', icon: 'findings', tone: 'hold', eyebrow: 'Read before you decide', body: doc.findings.map(f => `<div class="note note-warning finding" role="note">${t.icons.warning}<div><h3>${escape(f.title)}</h3><p>${escape(f.text)}</p><p class="finding-basis" data-basis="${f.basis}">${f.basis === 'checked' ? 'Checked against the code' : 'Inferred, not checked'}</p></div></div>`).join('')});
  parts.push({group: 'Background', id: 'impact', title: 'Impact', icon: 'impact', tone: 'hold', eyebrow: 'At a glance', body: `<dl class="impact-strip">${Object.entries(impactLabels).map(([key, text]) => { const {answer, note} = doc.impact[key]; const alert = answer === 'unknown' || (key === 'reversible' ? answer === 'no' : answer === 'yes'); return `<div class="${alert ? 'impact-alert' : 'impact-calm'}"><dt>${text}</dt><dd><strong>${capital(answer)}</strong>${note ? ` <span>${escape(note)}</span>` : ''}</dd></div>`; }).join('')}</dl>`});

  questions.forEach((q, i) => {
    const prior = carried.questions[q.id];
    const option = (o, extra = '') => `<label class="choice answer-pick"><input class="sr-only" type="radio" name="question-${i}-choice" value="${escape(o.id)}"${prior?.choice === o.id ? ' checked' : ''}><strong><span class="mark" aria-hidden="true">${o.id === 'none' ? '–' : escape(o.id)}</span><span class="sr-only">${o.id === 'none' ? '' : escape(o.id) + ': '}</span>${escape(o.label)}${extra}</strong>${o.detail ? `<small>${escape(o.detail)}</small>` : ''}</label>`;
    data.questions.push({id: q.id, title: q.title, options: q.options.map(o => ({id: o.id, label: o.label}))});
    parts.push({group: questions.length === 1 ? 'Your choice' : 'Your choices', id: q.id, title: q.title, icon: 'question', tone: 'info', eyebrow: `Question ${i + 1} of ${questions.length} · ${q.id}`, dot: true, cls: ' question', attrs: ` data-question="${escape(q.id)}"`,
      body: `${q.blocks?.length ? t.blocks(q.blocks) : ''}${t.note('tip', `The agent recommends ${q.recommended}`, q.reason)}${discussion(q.discussion)}`,
      foot: `${prior ? carriedNote : ''}<fieldset class="answer"><legend>Your choice for ${escape(q.id)}</legend><div class="answers choice-options">${q.options.map(o => option(o, o.id === q.recommended ? ' <em class="recommended">Recommended</em>' : '')).join('')}${option({id: 'none', label: 'None of these', detail: 'Say what you want instead in the note.'})}</div></fieldset><label class="notes-label" for="question-${i}-note">Note for ${escape(q.id)} <span class="note-rule">Required for None of these.</span></label><textarea id="question-${i}-note" rows="3" placeholder="Anything the agent should know about this choice.">${escape(prior?.note ?? '')}</textarea><p class="response-problem" role="status"></p><p class="print-result"></p><pre class="print-notes"></pre>`});
  });

  const figure = (title, source) => `<div class="screen-side"><h3>${title}</h3>${t.image(source.image, source.alt)}</div>`;
  const changeHTML = c => { const extra = `${c.detail ? `<span class="change-detail">${escape(c.detail)}</span>` : ''}${c.when ? `<span class="change-when">${escape(whenText(c.when))}</span>` : ''}`;
    return c.now !== undefined ? `<li class="change-pair"><div class="change-what"><strong>${escape(c.label)}</strong>${extra}</div><div class="change-state change-now"><b>Now</b>${escape(c.now)}</div><div class="change-arrow" aria-hidden="true">→</div><div class="change-state change-next"><b>Proposed</b>${escape(c.proposed)}</div></li>` : `<li><div class="change-what"><strong>${escape(c.label)}</strong>${extra}</div></li>`; };
  doc.views.forEach((v, i) => {
    const prior = carried.views[v.id], changes = v.changes ?? [];
    let body = '', behind = `<p>Now is from ${bases[v.basis]}.</p>`, varies = [];
    if (changes.length) body += `<h3>What changes · ${changes.length}</h3><ol class="changes">${changes.map(changeHTML).join('')}</ol>`;
    if (v.kind === 'screen') {
      let pair = v.now ? figure('Now', v.now) : v.informational ? '' : '<div class="screen-side"><h3>Now</h3><p>This screen does not exist yet.</p></div>';
      if (v.proposed?.image) pair += figure('Proposed', v.proposed);
      if (v.proposed?.prototype) {
        const html = t.files.get(v.proposed.prototype).text; varies = variesBy(v, html, questions);
        const defaults = Object.fromEntries(varies.map(q => [q.id, carried.questions[q.id] && carried.questions[q.id].choice !== 'none' ? carried.questions[q.id].choice : q.recommended]));
        const switches = varies.map((q, j) => `<fieldset class="proto-switch" data-switch="${escape(q.id)}"><legend>Viewing ${label(q.id, q.title)}</legend><div class="result-options">${q.options.map(o => `<label><input type="radio" name="view-${i}-viewing-${j}" value="${escape(o.id)}"${defaults[q.id] === o.id ? ' checked' : ''}> ${escape(o.id)}<span class="option-name"> · ${escape(o.label)}</span></label>`).join('')}<button type="button" class="proto-choose">Choose this option</button></div><p class="proto-chosen" role="status">Viewing an option does not choose it.</p></fieldset>`).join('');
        pair += `<div class="screen-side"><h3>Proposed</h3><dialog class="proto" open aria-label="Prototype: ${escape(v.title)}"><div class="proto-bar"><div class="proto-title"><span><strong>Prototype</strong> <span class="proto-hint">Not the real app. Links and buttons inside it go nowhere.</span></span><button type="button" class="proto-expand" aria-expanded="false" hidden>Expand</button></div><div class="proto-controls" hidden>${switches}<div class="proto-jumps" role="group" aria-label="Jump to a change"><span class="proto-count"></span>${changes.map(c => `<button type="button" data-jump="${escape(c.id)}">${escape(c.label)}</button>`).join('')}</div></div></div><iframe class="proto-frame" title="Prototype: ${escape(v.title)}" sandbox="allow-scripts" srcdoc="${escape(frameDocument(html, {changes: changes.map(c => ({id: c.id, when: c.when ?? null})), options: defaults}, t))}"></iframe></dialog></div>`;
      }
      body += `<div class="screen-pair">${pair}</div>`;
    }
    if (v.kind === 'examples') body += table(`${v.title}: worked examples`, ['Example', ...v.columns, 'Now', 'Proposed'], v.rows.map(r => `<tr${r.changed ? ' class="row-changed"' : ''}><th scope="row">${escape(r.id)}</th>${r.inputs.map(x => `<td>${escape(x)}</td>`).join('')}<td>${escape(r.now)}</td><td>${escape(r.proposed)}${r.changed ? ' ' + mark('Changed') : ''}</td></tr>`));
    if (v.kind === 'data') {
      body += `<h3>Rows already stored</h3><p>${escape(v.existingRows)}</p>${v.diagram ? t.blocks([v.diagram]) : ''}`;
      behind += v.tables.map(tb => table(`${tb.name}: ${tb.change === 'unchanged' ? 'table stays, columns below' : 'table ' + tb.change}`, ['Column', 'Type', 'Can be empty', 'Change', 'Was'], tb.columns.map(c => `<tr${c.change === 'unchanged' ? '' : ' class="row-changed"'}><th scope="row">${escape(c.name)}</th><td>${escape(c.type)}</td><td>${c.nullable ? 'Yes' : 'No'}</td><td>${c.change === 'unchanged' ? 'Unchanged' : mark(capital(c.change))}</td><td>${escape(c.was ?? '')}</td></tr>`))).join('');
    }
    if (v.kind === 'access') {
      const cell = c => !c ? '<td>Not applicable</td>' : `<td${c.now !== c.proposed ? ' class="cell-changed"' : ''}>${c.now === c.proposed ? capital(c.now) : `${capital(c.now)} → <strong>${capital(c.proposed)}</strong> ${mark(c.proposed === 'yes' ? 'Newly allowed' : 'No longer allowed')}`}${c.condition ? `<span class="cell-condition">${escape(c.condition)}</span>` : ''}</td>`;
      body += table(`${v.title}: who can do what`, ['Who', ...v.actions], v.actors.map(actor => `<tr><th scope="row">${escape(actor)}</th>${v.actions.map(action => cell(v.cells.find(c => c.actor === actor && c.action === action))).join('')}</tr>`));
    }
    if (v.kind === 'flow') body += t.blocks([v.diagram]);
    if (v.kind === 'contract') behind += `<p><strong>${escape(v.name)}</strong> is used by: ${v.consumers.map(escape).join(', ')}.</p><div class="contract-pair"><div><h3>Now</h3>${v.now ? t.blocks([v.now]) : '<p>This does not exist yet.</p>'}</div><div><h3>Proposed</h3>${t.blocks([v.proposed])}</div></div>`;
    if (v.kind === 'operations') body += t.blocks(v.blocks);
    if (v.notes?.length) body += t.blocks(v.notes);
    if (v.unchanged?.length) body += fold(`Stays the same · ${v.unchanged.length}`, `<ul class="prose-list">${v.unchanged.map(x => `<li>${escape(x)}</li>`).join('')}</ul>`);
    if (v.files?.length) behind += `<p>Files behind this view:</p><ul class="prose-list view-files">${v.files.map(f => `<li><code>${escape(f)}</code></li>`).join('')}</ul>`;
    body += fold('Behind this', behind, ' view-behind') + discussion(v.discussion);
    const foot = v.informational ? '' : `${prior ? carriedNote : ''}<fieldset class="answer"><legend>Your answer for ${escape(v.id)}</legend><div class="answers">${answers.map(([value, sign, text, hint]) => `<label class="answer-${value}"><input class="sr-only" type="radio" name="view-${i}-response" value="${value}"${prior?.response === value ? ' checked' : ''}><strong><span class="mark" aria-hidden="true">${sign}</span>${text}</strong><small>${hint}</small></label>`).join('')}</div></fieldset><label class="notes-label" for="view-${i}-note">Note for ${escape(v.id)} <span class="note-rule">Required for every answer except Yes.</span></label><textarea id="view-${i}-note" rows="3" placeholder="What should change, what is your question, or why drop or defer it?">${escape(prior?.note ?? '')}</textarea><p class="response-problem" role="status"></p><p class="print-result"></p><pre class="print-notes"></pre>`;
    data.views.push({id: v.id, title: v.title, informational: v.informational === true, varies: varies.map(q => q.id), ok: prior?.response === 'ok' ? {options: prior.options, bulk: prior.bulk} : null});
    parts.push({group: 'Your decisions', id: v.id, title: v.title, cls: ' view', attrs: ` data-view="${escape(v.id)}"`, body, foot,
      ...(v.informational ? {icon: 'info', tone: 'muted', eyebrow: 'For information · no decision needed'} : {icon: v.kind, tone: 'ok', eyebrow: `${kinds[v.kind]} · ${v.id}`, flag: flags[v.kind], ask: v.ask, askLabel: 'You are deciding', dot: true})});
  });

  if (doc.work?.length) parts.push({group: 'Finish', id: 'work', title: 'Work that will be created', icon: 'work', tone: 'hold', eyebrow: 'If you approve', body: `<p>If you approve, the work is split into these tickets.</p><ol class="work-list">${doc.work.map(w => `<li><strong>${escape(w.title)}</strong><span class="work-size">${capital(w.size)}</span><p>${escape(w.outcome)}</p></li>`).join('')}</ol>`});
  const sends = data.submitUrl ? `sends your response to ticket #${doc.ticket.number}` : 'writes a summary of your response and copies it, ready to paste into the ticket';
  parts.push({group: 'Finish', id: 'decision', title: 'Your decision', icon: 'decision', tone: 'plain', eyebrow: 'Last step', cls: ' card-final', body: `<p id="decision-counts" aria-live="polite"></p><ul id="decision-open" class="prose-list"></ul><button id="ok-remaining" type="button">Yes to all remaining views</button><label class="notes-label" for="decision-note">Overall note <span class="note-rule">Required to reject the ticket.</span></label><textarea id="decision-note" rows="3" placeholder="Anything that applies to the whole ticket."></textarea><div class="decision-actions"><button class="primary-button" id="decision-primary" type="button" aria-describedby="decision-counts">Approve</button><button id="decision-reject" type="button">Reject ticket</button></div><p id="summary-state" role="status">Approve, Send back or Reject ticket ${sends}. Nothing is sent until you choose one.</p>${t.note('remember', 'If nothing is done', doc.leaveAsIs)}<label class="notes-label" for="summary-text">Response summary</label><textarea id="summary-text" rows="12" readonly placeholder="Your response will appear here."></textarea><pre id="print-summary"></pre>`});

  const row = (id, title, status) => `<li><a href="#${escape(id)}">${label(id, title)}</a><span class="test-status" data-item="${escape(id)}">${status}</span></li>`;
  const index = `<ul class="test-index" aria-label="Responses in this preview">${questions.map(q => row(q.id, q.title, 'No choice')).join('')}${doc.views.map(v => row(v.id, v.title, v.informational ? 'For information' : 'No response')).join('')}</ul><p class="test-progress"></p>`;
  const identity = [['Ticket', `${doc.ticket.repository} #${doc.ticket.number}`], ['Preview version', String(doc.ticket.version)], ['Built at', `${doc.ticket.builtAt.commit.slice(0, 12)} (${doc.ticket.builtAt.date})`]];
  return {parts, index, data, identity, answering: [...questions.map(q => q.id), ...doc.views.filter(v => !v.informational).map(v => v.id)]};
}
