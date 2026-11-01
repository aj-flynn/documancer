import { readFileSync } from 'node:fs';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname, relative, isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';
import { diagramHTML } from './diagram.mjs';
import { validate, COMPANY } from './validate.mjs';
import { escapeHTML as esc, fail, expectObject, expectString, expectArray } from './util.mjs';

export { validate };

const assets = new URL('../assets/', import.meta.url);

const IDENTITY_LABELS = {
  id: 'Document',
  version: 'Version',
  date: 'Date',
  source: 'Source identity',
  repositoryRoot: 'Checkout',
  branch: 'Branch',
  commit: 'Commit',
  readiness: 'Readiness',
};
const COMPANION_LABELS = { technical: 'Technical reference', 'user-guide': 'User guide' };
const UAT_RESULTS = ['Passed', 'Failed', 'Skipped', 'Blocked', 'Untested'];

// ---------------------------------------------------------------------------
// Content blocks
// ---------------------------------------------------------------------------

function linkHTML(link, newTab = false) {
  const attributes = newTab ? ' target="_blank" rel="noopener noreferrer"' : '';
  const notice = newTab ? '<span class="sr-only"> (opens in a new tab)</span>' : '';
  return `<a href="${esc(link.href)}"${attributes}>${esc(link.label)}${notice}</a>`;
}

function listHTML(items, ordered = false) {
  const open = ordered ? '<ol class="steps">' : '<ul class="prose-list">';
  const close = ordered ? '</ol>' : '</ul>';
  return `${open}${items.map(item => `<li>${esc(item)}</li>`).join('')}${close}`;
}

function tableHTML(block) {
  const header = block.columns.map(column => `<th scope="col">${esc(column)}</th>`).join('');
  const rows = block.rows.map(row => {
    const cells = row.map((cell, index) => (index === 0 ? `<th scope="row">${esc(cell)}</th>` : `<td>${esc(cell)}</td>`));
    return `<tr>${cells.join('')}</tr>`;
  });
  return [
    `<div class="table-wrap" tabindex="0" role="region" aria-label="${esc(block.caption)}">`,
    `<table><caption>${esc(block.caption)}</caption>`,
    `<thead><tr>${header}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`,
  ].join('');
}

function codeHTML(block) {
  return [
    `<div class="code-example"><div class="code-toolbar"><span>${esc(block.language ?? 'Code')}</span>`,
    '<button class="copy-code" type="button">Copy code</button></div>',
    `<pre tabindex="0"><code>${esc(block.text)}</code></pre></div>`,
  ].join('');
}

// `context.link` renders a link (mode-dependent) and `context.diagram` renders a diagram with a unique ID.
function blocksHTML(blocks, context) {
  return blocks.map(block => {
    switch (block.type) {
      case 'paragraph': return `<p>${esc(block.text)}</p>`;
      case 'heading': return `<h3>${esc(block.text)}</h3>`;
      case 'list': return listHTML(block.items);
      case 'steps': return listHTML(block.items, true);
      case 'code': return codeHTML(block);
      case 'callout': return `<aside class="note"><strong>${esc(block.title)}</strong><p>${esc(block.text)}</p></aside>`;
      case 'details': return `<details><summary>${esc(block.title)}</summary>${blocksHTML(block.blocks, context)}</details>`;
      case 'diagram': return context.diagram(block);
      case 'links': return `<ul class="prose-list">${block.items.map(item => `<li>${context.link(item)}</li>`).join('')}</ul>`;
      case 'table': return tableHTML(block);
    }
  }).join('\n');
}

const sectionHTML = (id, title, body) => `<section id="${esc(id)}"><h2>${esc(title)}</h2>${body}</section>`;

// ---------------------------------------------------------------------------
// UAT sections
// ---------------------------------------------------------------------------

function testCaseHTML(test, index, blocks) {
  const results = UAT_RESULTS.map(result => {
    const checked = result === 'Untested' ? 'checked' : '';
    return `<label><input type="radio" name="test-${index}-result" value="${result}" ${checked}> ${result}</label>`;
  });
  return [
    `<div class="test-case" data-test="${esc(test.id)}" data-title="${esc(test.title)}">`,
    `<p>${esc(test.brief)}</p>`,
    `<h3>Prerequisites</h3>${blocks(test.prerequisites)}`,
    `<h3>Test plan</h3>${listHTML(test.steps, true)}`,
    `<p><strong>Pass when:</strong> ${esc(test.expected)}</p>`,
    `<p><strong>Problem signs:</strong> ${esc(test.problemSigns)}</p>`,
    `<p><strong>Reset or dependencies:</strong> ${esc(test.reset)}</p>`,
    `<p><strong>Agent rehearsal:</strong> ${esc(test.rehearsal)}</p>`,
    `<fieldset><legend>Result for ${esc(test.id)}</legend><div class="result-options">${results.join('')}</div></fieldset>`,
    `<label class="notes-label" for="test-${index}-notes">Notes for ${esc(test.id)}</label>`,
    `<textarea id="test-${index}-notes" rows="3" placeholder="What happened? Include unexpected behavior or anything that prevented the test."></textarea>`,
    '<p class="print-result"></p><pre class="print-notes"></pre></div>',
  ].join('');
}

const SETUP_NOTICE = [
  '<aside class="note"><strong>Keep this page open</strong>',
  '<p>Results and notes are held in this tab only. Generate and keep the summary before closing or reloading. ',
  'Agent rehearsal and automated checks do not record human acceptance.</p></aside>',
].join('');

const SUMMARY_SECTION = [
  '<p id="result-counts" aria-live="polite"></p>',
  '<p>Failed or blocked tests need attention. Skipped and untested tests remain unaccepted.</p>',
  '<button class="primary-button" id="generate-summary" type="button">Generate summary</button>',
  '<p id="summary-state" role="status">Generating also copies the summary to your clipboard.</p>',
  '<label class="notes-label" for="summary-text">Generated summary</label>',
  '<textarea id="summary-text" rows="12" readonly placeholder="Your summary will appear here."></textarea>',
  '<pre id="print-summary"></pre>',
].join('');

function evidenceHTML(evidence) {
  const entries = evidence.map(entry => [
    `<div class="evidence-entry"><h3>${esc(entry.title)}</h3>`,
    `<p><strong>${esc(entry.status)}</strong> — ${esc(entry.detail)}</p>`,
    entry.history ? `<p><strong>History:</strong> ${esc(entry.history)}</p>` : '',
    '</div>',
  ].join(''));
  return `<p>Read-only verification; excluded from human acceptance totals.</p>${entries.join('')}`;
}

// Returns the navigation entries and the HTML of every section after the overview.
function bodySections(doc, blocks) {
  const nav = [];
  let body = '';
  const add = (id, title, content) => {
    nav.push([id, title]);
    body += sectionHTML(id, title, content);
  };

  if (doc.mode !== 'uat') {
    for (const section of doc.sections) add(section.id, section.title, blocks(section.blocks));
    return { nav, body };
  }
  add('setup', 'Shared setup', blocks(doc.setup) + SETUP_NOTICE);
  doc.tests.forEach((test, index) => {
    add(test.id, `${test.id} · ${test.title}`, testCaseHTML(test, index, blocks));
  });
  if (doc.evidence?.length) add('evidence', 'Automated evidence', evidenceHTML(doc.evidence));
  add('summary', 'Summary', SUMMARY_SECTION);
  return { nav, body };
}

function overviewHTML(doc, blocks, renderLink) {
  const identity = Object.entries(doc.identity)
    .map(([key, value]) => `<div><dt>${IDENTITY_LABELS[key]}</dt><dd>${esc(value)}</dd></div>`)
    .join('');
  const sources = doc.sources?.length
    ? `<h3>Sources</h3><ul class="prose-list">${doc.sources.map(link => `<li>${renderLink(link)}</li>`).join('')}</ul>`
    : '';
  return [
    `<section id="overview" class="doc-intro"><h1>${esc(doc.title)}</h1>`,
    `<p class="lead">${esc(doc.lead)}</p><dl class="document-identity">${identity}</dl>`,
    `<h2>Overview</h2>${blocks(doc.overview)}${sources}</section>`,
  ].join('');
}

// ---------------------------------------------------------------------------
// Companion links and branding
// ---------------------------------------------------------------------------

const LINK_BASE = new URL('https://document.invalid/');

// Finds the companion a relative link points at, if any. Absolute URLs never match.
function companionFor(link, companions) {
  const target = new URL(link.href, LINK_BASE);
  if (target.origin !== LINK_BASE.origin) return undefined;
  return companions.find(companion => new URL(companion.href, LINK_BASE).pathname === target.pathname);
}

// Technical and user guides never link to UAT; UAT opens companion guides in a new tab so test state survives.
function linkRenderer(doc, companions) {
  return link => {
    const target = companionFor(link, companions);
    if (doc.mode !== 'uat' && target?.mode === 'uat') return esc(link.label);
    return linkHTML(link, doc.mode === 'uat' && ['technical', 'user-guide'].includes(target?.mode));
  };
}

function relatedLinks(doc, companions) {
  return companions
    .filter(companion => companion.mode !== doc.mode && companion.mode !== 'uat')
    .map(companion => ({
      href: companion.href,
      label: doc.related?.find(link => link.href === companion.href)?.label ?? COMPANION_LABELS[companion.mode],
    }));
}

async function brandHTML(doc, read) {
  const name = doc.brand?.name ?? COMPANY;
  const logo = doc.brand?.logo ?? (name === COMPANY ? 'flynn' : 'none');
  if (logo !== 'flynn') return { name, html: esc(name) };
  const images = await Promise.all(['dark', 'light'].map(async theme => {
    const svg = Buffer.from(await read(`flynn-wordmark-on-${theme}.svg`)).toString('base64');
    return `<img class="brand-${theme}" src="data:image/svg+xml;base64,${svg}" width="204" height="49" alt="${esc(name)}">`;
  }));
  return { name, html: images.join('') };
}

// ---------------------------------------------------------------------------
// Page shell
// ---------------------------------------------------------------------------

const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const GENERATOR = `Documancer ${version}`;

// JSON embedded in a <script>: keep it from closing the tag or opening a comment.
const safeJSON = value => JSON.stringify(value)
  .replace(/</g, '\\u003c')
  .replace(/>/g, '\\u003e')
  .replace(/&/g, '\\u0026');

function sidebarHTML(doc, nav) {
  const links = nav.map(([id, title]) => `<a href="#${esc(id)}">${esc(title)}</a>`).join('');
  return [
    `<aside class="sidebar"><div class="sidebar-inner"><div class="sidebar-scroll"><div class="collection-name">${esc(doc.title)}</div>`,
    '<label class="search-label" for="doc-search">Find in this document</label>',
    '<input id="doc-search" type="search" placeholder="Search topics" autocomplete="off">',
    '<p class="search-feedback" aria-live="polite"></p>',
    `<details class="handbook-menu" open><summary>Browse documentation</summary><nav aria-label="Documentation">${links}</nav></details></div>`,
    '<div class="theme-control"><label for="theme-choice">Appearance</label>',
    '<select id="theme-choice" aria-describedby="theme-status"><option value="system">System</option><option value="dark">Dark</option><option value="light">Light</option></select>',
    '<span id="theme-status" class="sr-only" aria-live="polite"></span></div></div></aside>',
  ].join('');
}

function pageHTML({ doc, brand, related, renderLink, nav, body, css, theme, runtime, license, summaryData }) {
  const relatedNav = related.length
    ? `<nav class="document-links" aria-label="Related documents">${related.map(link => renderLink(link)).join('')}</nav>`
    : '';
  return [
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">`,
    `<meta name="generator" content="${GENERATOR}"><title>${esc(doc.title)} · ${esc(brand.name)}</title>`,
    `<script>${theme}</script><style>${css}</style></head>`,
    '<body class="docs forest forest-handbook"><a class="skip" href="#main">Skip to documentation</a>',
    `<header class="site-header"><a class="brand-link" href="#overview">${brand.html}</a><span class="header-title">Documentation</span>${relatedNav}</header>`,
    `<main id="main" class="doc-layout">${sidebarHTML(doc, nav)}`,
    '<article class="article"><noscript><p>Document content is available. Enable JavaScript for search, appearance controls, copying and UAT summary generation.</p></noscript>',
    `${body}</article></main>`,
    `<footer class="doc-footer"><span>${esc(brand.name)}</span><span>${esc(doc.identity.id)} · ${esc(doc.identity.version)}</span><a href="#overview">Back to overview</a></footer>`,
    '<div class="live-message" role="status" aria-live="polite"></div>',
    `<script type="application/json" id="document-data">${safeJSON(summaryData)}</script>`,
    `<script>${runtime}</script>`,
    `<script type="text/plain" id="font-license">${license.replace(/<\/script/gi, '<\\/script')}</script></body></html>`,
  ].join('');
}

export async function renderDocument(input, { companions = [] } = {}) {
  const doc = validate(input);
  const related = relatedLinks(doc, companions);
  const renderLink = linkRenderer(doc, companions);

  // Pick a diagram ID prefix that no authored section or test ID can collide with.
  let diagramPrefix = 'documancer-diagram';
  const authoredIds = (doc.mode === 'uat' ? doc.tests : doc.sections).map(item => item.id);
  while (authoredIds.some(id => id.toLowerCase().startsWith(`${diagramPrefix}-`))) diagramPrefix += '-x';
  let diagramCount = 0;
  const blocks = items => blocksHTML(items, {
    link: renderLink,
    diagram: block => diagramHTML(block, `${diagramPrefix}-${++diagramCount}`),
  });

  const read = name => readFile(new URL(name, assets), 'utf8');
  const [tokens, base, forest, forms, theme, runtime, font, license] = await Promise.all([
    read('tokens.css'), read('base.css'), read('forest.css'), read('document.css'),
    read('theme.js'), read('document.js'),
    readFile(new URL('source-sans-3-variable.woff2', assets)),
    read('OFL.txt'),
  ]);
  const fontURL = `url("data:font/woff2;base64,${font.toString('base64')}")`;
  const css = tokens.replace('url("fonts/source-sans-3-variable.woff2")', fontURL)
    + base.replace(/@import[^;]+;/g, '') + forest + forms;

  const brand = await brandHTML(doc, read);
  const { nav: sectionNav, body: sections } = bodySections(doc, blocks);
  const identity = Object.entries(doc.identity).map(([key, value]) => `${IDENTITY_LABELS[key]}: ${value}`).join('\n');

  return pageHTML({
    doc,
    brand,
    related,
    renderLink,
    nav: [['overview', 'Overview'], ...sectionNav],
    body: overviewHTML(doc, blocks, renderLink) + sections,
    css,
    theme,
    runtime,
    license,
    summaryData: { title: doc.title, identity, evidence: doc.evidence ?? [] },
  });
}

// ---------------------------------------------------------------------------
// Sets and CLI
// ---------------------------------------------------------------------------

const stripBOM = text => text.replace(/^﻿/, '');
const readJSON = async path => JSON.parse(stripBOM(await readFile(path, 'utf8')));
const sameFile = (a, b) => a.toLowerCase() === b.toLowerCase();

function validateOutputPath(output, path) {
  const invalid = isAbsolute(output)
    || output.includes('\\')
    || output.split('/').some(part => part === '..' || part === '.' || !part)
    || !output.endsWith('.html')
    || /[?#:%]/.test(output);
  if (invalid) fail(path, 'expected a relative HTML path without traversal or URL delimiters');
}

// A set is the publication boundary: only its members become companion links.
export async function renderSet(manifestPath, outputDirectory) {
  const manifestFile = resolve(manifestPath);
  const outputRoot = resolve(outputDirectory);
  const manifest = await readJSON(manifestFile);
  expectObject(manifest, ['documents'], 'set');
  expectArray(manifest.documents, 'set.documents');

  const outputs = new Set();
  const modes = new Set();
  const entries = [];
  for (const [index, entry] of manifest.documents.entries()) {
    const path = `set.documents[${index}]`;
    expectObject(entry, ['source', 'output'], path);
    expectString(entry.source, `${path}.source`);
    expectString(entry.output, `${path}.output`);
    validateOutputPath(entry.output, `${path}.output`);
    if (outputs.has(entry.output.toLowerCase())) fail(`${path}.output`, 'duplicate output');
    outputs.add(entry.output.toLowerCase());
    const input = resolve(dirname(manifestFile), entry.source);
    const output = resolve(outputRoot, entry.output);
    if (sameFile(input, output)) fail(`${path}.output`, 'cannot overwrite input');
    const doc = validate(await readJSON(input));
    if (modes.has(doc.mode)) fail(`${path}.source`, 'a set supports one document per mode');
    modes.add(doc.mode);
    entries.push({ doc, output });
  }

  const hrefBetween = (from, to) => relative(dirname(from), to)
    .replaceAll('\\', '/').split('/').map(encodeURIComponent).join('/');
  const generated = await Promise.all(entries.map(async entry => {
    const companions = entries
      .filter(other => other !== entry)
      .map(other => ({ mode: other.doc.mode, href: hrefBetween(entry.output, other.output) }));
    return { output: entry.output, html: await renderDocument(entry.doc, { companions }) };
  }));
  for (const { output, html } of generated) {
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, html, 'utf8');
  }
  return generated.map(({ output }) => output);
}

async function main(args) {
  if (args[0] === '--set') {
    if (args.length !== 3) throw new Error('Usage: node render.mjs --set <set.json> <output-directory>');
    for (const output of await renderSet(args[1], args[2])) console.log(`Rendered ${output}`);
    return;
  }
  if (args.length !== 2) {
    throw new Error('Usage: node render.mjs <source.json> <output.html> OR --set <set.json> <output-directory>');
  }
  const input = resolve(args[0]);
  const output = resolve(args[1]);
  if (sameFile(input, output)) throw new Error('Input and output paths must differ');
  if (!output.toLowerCase().endsWith('.html')) throw new Error('Output must have an .html extension');
  const html = await renderDocument(await readJSON(input));
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, html, 'utf8');
  console.log(`Rendered ${output}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
