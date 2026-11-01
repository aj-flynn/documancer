// Structural validation of a Documancer source document. Throws on the first problem.
import { validateDiagram } from './diagram.mjs';
import { fail, expectObject, expectString, expectArray, expectStrings, expectHref } from './util.mjs';

export const COMPANY = 'Flynn Technology LLC';

const MODES = ['technical', 'user-guide', 'uat'];
const EVIDENCE_STATUSES = ['passed', 'failed', 'blocked', 'untested'];
const MAX_BLOCK_DEPTH = 12;

// IDs the renderer itself emits; authored section and test IDs must not collide with them.
const RESERVED_IDS = [
  'overview', 'main', 'document-data', 'font-license', 'doc-search', 'theme-choice', 'theme-status',
  'result-counts', 'generate-summary', 'summary-state', 'summary-text', 'print-summary',
];

const TOP_LEVEL_FIELDS = [
  'schemaVersion', 'mode', 'title', 'lead', 'identity', 'overview', 'brand', 'related', 'sources',
  'sections', 'setup', 'tests', 'evidence',
];
const IDENTITY_FIELDS = ['id', 'version', 'date', 'source', 'repositoryRoot', 'branch', 'commit', 'readiness'];
const TEST_FIELDS = [
  'id', 'title', 'brief', 'prerequisites', 'steps', 'expected', 'problemSigns', 'reset', 'rehearsal',
];

const BLOCK_FIELDS = {
  paragraph: ['text'],
  heading: ['text'],
  list: ['items'],
  steps: ['items'],
  code: ['text', 'language'],
  table: ['caption', 'columns', 'rows'],
  callout: ['title', 'text'],
  details: ['title', 'blocks'],
  links: ['items'],
  diagram: ['caption', 'description', 'nodes', 'edges'],
};

function validateIdentity(identity) {
  expectObject(identity, IDENTITY_FIELDS, 'identity');
  // Required fields first so a missing one is reported before an unrelated bad value.
  for (const key of ['id', 'version', 'date', 'source']) expectString(identity[key], `identity.${key}`);
  for (const [key, value] of Object.entries(identity)) expectString(value, `identity.${key}`);
  const { date } = identity;
  const isRealDate = Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !isRealDate) {
    fail('identity.date', 'expected a valid YYYY-MM-DD date');
  }
}

function validateBrand(brand) {
  expectObject(brand, ['name', 'logo'], 'brand');
  if (brand.name !== undefined) expectString(brand.name, 'brand.name');
  if (brand.logo !== undefined && !['flynn', 'none'].includes(brand.logo)) {
    fail('brand.logo', 'expected flynn or none');
  }
  if (brand.logo === 'flynn' && (brand.name ?? COMPANY) !== COMPANY) {
    fail('brand.logo', 'Flynn wordmark requires the Flynn company name');
  }
}

function validateTable(block, path) {
  expectString(block.caption, `${path}.caption`);
  expectStrings(block.columns, `${path}.columns`);
  expectArray(block.rows, `${path}.rows`);
  block.rows.forEach((row, index) => {
    expectArray(row, `${path}.rows[${index}]`);
    if (row.length !== block.columns.length) fail(`${path}.rows`, 'row width must match columns');
    for (const cell of row) {
      if (typeof cell !== 'string') fail(`${path}.rows`, 'cells must be strings');
    }
  });
}

function validateEvidence(entry, index) {
  const path = `evidence[${index}]`;
  expectObject(entry, ['title', 'status', 'detail', 'history'], path);
  for (const key of ['title', 'detail']) expectString(entry[key], `${path}.${key}`);
  if (!EVIDENCE_STATUSES.includes(entry.status)) fail(`${path}.status`, 'invalid evidence status');
  if (entry.history !== undefined) expectString(entry.history, `${path}.history`);
}

export function validate(doc) {
  expectObject(doc, TOP_LEVEL_FIELDS, 'document');
  if (doc.schemaVersion !== 1) fail('schemaVersion', 'expected 1');
  if (!MODES.includes(doc.mode)) fail('mode', 'expected technical, user-guide or uat');
  for (const key of ['title', 'lead']) expectString(doc[key], key);
  validateIdentity(doc.identity);

  const usedIds = new Set(RESERVED_IDS);
  const links = [];

  function claimId(value, path, pattern) {
    expectString(value, path);
    if (!pattern.test(value)) fail(path, 'invalid ID');
    if (usedIds.has(value.toLowerCase())) fail(path, 'duplicate or reserved ID');
    usedIds.add(value.toLowerCase());
  }

  function validateLink(value, path) {
    expectObject(value, ['label', 'href'], path);
    expectString(value.label, `${path}.label`);
    expectHref(value.href, `${path}.href`);
    links.push(value.href);
  }

  function validateLinks(items, path, options) {
    expectArray(items, path, options);
    items.forEach((item, index) => validateLink(item, `${path}[${index}]`));
  }

  function validateBlock(block, path, depth) {
    if (!block || typeof block !== 'object') fail(path, 'expected a block');
    if (!Object.hasOwn(BLOCK_FIELDS, block.type)) fail(`${path}.type`, 'unsupported block type');
    expectObject(block, ['type', ...BLOCK_FIELDS[block.type]], path);
    switch (block.type) {
      case 'paragraph':
      case 'heading':
        expectString(block.text, `${path}.text`);
        break;
      case 'code':
        expectString(block.text, `${path}.text`);
        if (block.language !== undefined) expectString(block.language, `${path}.language`);
        break;
      case 'callout':
        expectString(block.text, `${path}.text`);
        expectString(block.title, `${path}.title`);
        break;
      case 'list':
      case 'steps':
        expectStrings(block.items, `${path}.items`);
        break;
      case 'links':
        validateLinks(block.items, `${path}.items`);
        break;
      case 'details':
        expectString(block.title, `${path}.title`);
        validateBlocks(block.blocks, `${path}.blocks`, depth + 1);
        break;
      case 'diagram':
        validateDiagram(block, path);
        break;
      case 'table':
        validateTable(block, path);
        break;
    }
  }

  function validateBlocks(blocks, path, depth = 0) {
    expectArray(blocks, path);
    if (depth > MAX_BLOCK_DEPTH) fail(path, `block nesting exceeds ${MAX_BLOCK_DEPTH} levels`);
    blocks.forEach((block, index) => validateBlock(block, `${path}[${index}]`, depth));
  }

  function validateTest(test, index) {
    const path = `tests[${index}]`;
    expectObject(test, TEST_FIELDS, path);
    claimId(test.id, `${path}.id`, /^[A-Za-z][A-Za-z0-9-]*$/);
    for (const key of ['title', 'brief', 'expected', 'problemSigns', 'reset', 'rehearsal']) {
      expectString(test[key], `${path}.${key}`);
    }
    validateBlocks(test.prerequisites, `${path}.prerequisites`);
    expectStrings(test.steps, `${path}.steps`);
  }

  function validateSection(section, index) {
    const path = `sections[${index}]`;
    expectObject(section, ['id', 'title', 'blocks'], path);
    claimId(section.id, `${path}.id`, /^[a-z][a-z0-9-]*$/);
    expectString(section.title, `${path}.title`);
    validateBlocks(section.blocks, `${path}.blocks`);
  }

  if (doc.brand !== undefined) validateBrand(doc.brand);
  for (const key of ['related', 'sources']) {
    if (doc[key] !== undefined) validateLinks(doc[key], key, { allowEmpty: true });
  }
  validateBlocks(doc.overview, 'overview');

  if (doc.mode === 'uat') {
    if (doc.sections !== undefined) fail('sections', 'not supported in UAT mode');
    for (const reserved of ['setup', 'evidence', 'summary']) usedIds.add(reserved);
    validateBlocks(doc.setup, 'setup');
    expectArray(doc.tests, 'tests');
    doc.tests.forEach((_, index) => usedIds.add(`test-${index}-notes`));
    doc.tests.forEach(validateTest);
    if (doc.evidence !== undefined) {
      expectArray(doc.evidence, 'evidence', { allowEmpty: true });
      doc.evidence.forEach(validateEvidence);
    }
  } else {
    for (const key of ['setup', 'tests', 'evidence']) {
      if (doc[key] !== undefined) fail(key, 'only supported in UAT mode');
    }
    expectArray(doc.sections, 'sections');
    doc.sections.forEach(validateSection);
  }

  const anchorTargets = new Set(['overview']);
  if (doc.mode === 'uat') {
    for (const target of ['setup', 'summary']) anchorTargets.add(target);
    if (doc.evidence?.length) anchorTargets.add('evidence');
    for (const test of doc.tests) anchorTargets.add(test.id);
  } else {
    for (const section of doc.sections) anchorTargets.add(section.id);
  }
  for (const url of links.filter(link => link.startsWith('#'))) {
    let target;
    try { target = decodeURIComponent(url.slice(1)); } catch { fail('link', 'invalid encoded anchor'); }
    if (!anchorTargets.has(target)) fail('link', `unknown anchor ${url}`);
  }
  return doc;
}
