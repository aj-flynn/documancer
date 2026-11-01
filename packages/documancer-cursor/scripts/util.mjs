// Small helpers shared by the validator, the diagram builder and the renderer.

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export const escapeHTML = value => String(value).replace(/[&<>"']/g, char => HTML_ESCAPES[char]);

export function fail(path, message) {
  throw new Error(`${path}: ${message}`);
}

export function expectObject(value, allowedKeys, path) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(path, 'expected an object');
  for (const key of Object.keys(value)) {
    if (!allowedKeys.includes(key)) fail(`${path}.${key}`, 'unknown field');
  }
}

export function expectString(value, path, limit) {
  if (typeof value !== 'string' || !value.trim()) fail(path, 'expected a nonempty string');
  if (limit && [...value].length > limit) fail(path, `must not exceed ${limit} characters`);
}

export function expectArray(value, path, { allowEmpty = false } = {}) {
  if (!Array.isArray(value) || (!allowEmpty && !value.length)) {
    fail(path, `expected ${allowEmpty ? 'an' : 'a nonempty'} array`);
  }
}

export function expectStrings(value, path) {
  expectArray(value, path);
  value.forEach((item, index) => expectString(item, `${path}[${index}]`));
}

export function expectHref(value, path) {
  expectString(value, path);
  if (value !== value.trim() || /[\u0000- \u007f\\]/.test(value) || value.startsWith('//')) {
    fail(path, 'unsupported URL');
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) {
    let url;
    try { url = new URL(value); } catch { fail(path, 'invalid URL'); }
    if (!['http:', 'https:', 'mailto:'].includes(url.protocol)) fail(path, 'unsupported URL scheme');
    if (url.username || url.password) fail(path, 'credentials must not be embedded in links');
  } else if (value.split(/[/?#]/)[0].includes(':')) {
    fail(path, 'invalid relative URL');
  }
}
