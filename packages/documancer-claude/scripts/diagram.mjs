// Static diagrams: explicit grid placement, deterministic routing, no browser runtime.
import { escapeHTML, fail, expectObject, expectString } from './util.mjs';

const MAX_NODES = 40;
const MAX_EDGES = 80;
const MAX_GRID_INDEX = 7;
const NODE_LABEL_LIMIT = 180;
const EDGE_LABEL_LIMIT = 48;

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export function validateDiagram(block, path) {
  expectObject(block, ['type', 'caption', 'description', 'nodes', 'edges'], path);
  expectString(block.caption, `${path}.caption`);
  expectString(block.description, `${path}.description`);
  if (!Array.isArray(block.nodes) || !block.nodes.length || block.nodes.length > MAX_NODES) {
    fail(`${path}.nodes`, `expected 1–${MAX_NODES} nodes`);
  }
  if (!Array.isArray(block.edges) || block.edges.length > MAX_EDGES) {
    fail(`${path}.edges`, `expected 0–${MAX_EDGES} edges`);
  }

  const nodeIds = new Set();
  const cells = new Set();
  block.nodes.forEach((node, index) => {
    const nodePath = `${path}.nodes[${index}]`;
    expectObject(node, ['id', 'label', 'row', 'column'], nodePath);
    expectString(node.id, `${nodePath}.id`);
    if (!/^[a-z][a-z0-9-]*$/.test(node.id)) fail(`${nodePath}.id`, 'expected a lowercase slug');
    if (nodeIds.has(node.id)) fail(`${nodePath}.id`, 'duplicate node ID');
    nodeIds.add(node.id);
    expectString(node.label, `${nodePath}.label`, NODE_LABEL_LIMIT);
    for (const key of ['row', 'column']) {
      if (!Number.isInteger(node[key]) || node[key] < 0 || node[key] > MAX_GRID_INDEX) {
        fail(`${nodePath}.${key}`, `expected an integer from 0 to ${MAX_GRID_INDEX}`);
      }
    }
    const cell = `${node.row},${node.column}`;
    if (cells.has(cell)) fail(nodePath, 'two nodes occupy the same grid cell');
    cells.add(cell);
  });

  const directedPairs = new Set();
  block.edges.forEach((edge, index) => {
    const edgePath = `${path}.edges[${index}]`;
    expectObject(edge, ['from', 'to', 'label'], edgePath);
    for (const key of ['from', 'to']) {
      if (!nodeIds.has(edge[key])) fail(`${edgePath}.${key}`, 'unknown node ID');
    }
    if (edge.from === edge.to) {
      fail(edgePath, 'self edges are not supported; describe the repeat in text or use a separate step');
    }
    const pair = `${edge.from}:${edge.to}`;
    if (directedPairs.has(pair)) fail(edgePath, 'duplicate directed edge');
    directedPairs.add(pair);
    if (edge.label !== undefined) expectString(edge.label, `${edgePath}.label`, EDGE_LABEL_LIMIT);
  });
}

// ---------------------------------------------------------------------------
// Text measurement and wrapping (approximate glyph widths, in em-like units)
// ---------------------------------------------------------------------------

const graphemes = new Intl.Segmenter('en', { granularity: 'grapheme' });
const SPACE_WIDTH = 0.58;

function glyphWidth(char) {
  if (/[MW@%]/.test(char)) return 1;
  if (/[ilI.,'!:;|]/.test(char)) return 0.3;
  if (/[A-Z0-9]/.test(char)) return 0.7;
  if (/[\u0000-\u007f]/.test(char)) return 0.58;
  return 1.2;
}

const splitGraphemes = word => [...graphemes.segment(word)].map(part => part.segment);
const textWidth = chars => chars.reduce((sum, char) => sum + glyphWidth(char), 0);

function wrap(text, maxWidth) {
  const lines = [];
  let line = '';
  let width = 0;
  const breakLine = () => {
    lines.push(line);
    line = '';
    width = 0;
  };
  for (const word of text.trim().split(/\s+/u)) {
    const chars = splitGraphemes(word);
    if (line && width + SPACE_WIDTH + textWidth(chars) > maxWidth) breakLine();
    if (line) {
      line += ' ';
      width += SPACE_WIDTH;
    }
    for (const char of chars) {
      const size = glyphWidth(char);
      if (line && width + size > maxWidth) breakLine();
      line += char;
      width += size;
    }
  }
  if (line) lines.push(line);
  return lines;
}

// ---------------------------------------------------------------------------
// Edge routing
// ---------------------------------------------------------------------------

const TURN_PENALTY = 40;
const SHARED_SEGMENT_PENALTY = 180;
const STEPS = [[1, 0, 'h'], [0, 1, 'v'], [-1, 0, 'h'], [0, -1, 'v']];

const pointKey = (x, y) => `${x},${y}`;
const segmentKey = (a, b) => [pointKey(...a), pointKey(...b)].sort().join(':');

// Routes on alternating node-center / empty-corridor grid lines. Occupied centers are obstacles;
// the corridors leave room for labels and arrowheads. Returns grid coordinates.
function route(start, end, xs, ys, occupied, usedSegments) {
  const queue = [{ point: start, dir: '', cost: 0, path: [start] }];
  const best = new Map();
  while (queue.length) {
    queue.sort((a, b) => b.cost - a.cost);
    const current = queue.pop();
    const [x, y] = current.point;
    if ((best.get(pointKey(x, y) + current.dir) ?? Infinity) < current.cost) continue;
    if (x === end[0] && y === end[1]) return current.path;
    for (const [dx, dy, dir] of STEPS) {
      const next = [x + dx, y + dy];
      const [nx, ny] = next;
      if (nx < 0 || ny < 0 || nx >= xs.length || ny >= ys.length) continue;
      if (occupied.has(pointKey(nx, ny)) && pointKey(nx, ny) !== pointKey(...end)) continue;
      const turns = current.dir && current.dir !== dir ? TURN_PENALTY : 0;
      const crowding = (usedSegments.get(segmentKey(current.point, next)) ?? 0) * SHARED_SEGMENT_PENALTY;
      const cost = current.cost + Math.abs(xs[nx] - xs[x]) + Math.abs(ys[ny] - ys[y]) + turns + crowding;
      const state = pointKey(nx, ny) + dir;
      if (cost >= (best.get(state) ?? Infinity)) continue;
      best.set(state, cost);
      queue.push({ point: next, dir, cost, path: [...current.path, next] });
    }
  }
  throw new Error('Unable to route diagram edge');
}

// Drops points that sit in the middle of a straight run.
function simplify(points) {
  return points.filter((point, index) => {
    if (index === 0 || index === points.length - 1) return true;
    const [before, after] = [points[index - 1], points[index + 1]];
    const straightVertical = before[0] === point[0] && after[0] === point[0];
    const straightHorizontal = before[1] === point[1] && after[1] === point[1];
    return !(straightVertical || straightHorizontal);
  });
}

// ---------------------------------------------------------------------------
// Layout and SVG
// ---------------------------------------------------------------------------

const NODE_WIDTH = 200;
const GAP_X = 144;
const MARGIN = 112;
const MIN_GAP_Y = 112;
const MIN_NODE_HEIGHT = 92;
const NODE_LINE_HEIGHT = 22;
const EDGE_LINE_HEIGHT = 18;
const NODE_WRAP_WIDTH = 9.5;
const EDGE_WRAP_WIDTH = 8;

function textSVG(lines, x, y, lineHeight, cssClass) {
  const spans = lines.map((line, index) => {
    const lineY = y + (index - (lines.length - 1) / 2) * lineHeight;
    return `<tspan x="${x}" y="${lineY}">${escapeHTML(line)}</tspan>`;
  });
  return `<text class="${cssClass}" text-anchor="middle">${spans.join('')}</text>`;
}

// Grid lines alternate: even indexes are corridors between columns, odd indexes run through node centers.
function columnLines(columns) {
  return Array.from({ length: columns * 2 + 1 }, (_, i) => {
    if (i % 2) return MARGIN + NODE_WIDTH / 2 + Math.floor(i / 2) * (NODE_WIDTH + GAP_X);
    if (i === 0) return MARGIN / 2;
    return MARGIN + NODE_WIDTH + GAP_X / 2 + (i / 2 - 1) * (NODE_WIDTH + GAP_X);
  });
}

function rowLines(tops, heights, gapY) {
  return Array.from({ length: tops.length * 2 + 1 }, (_, i) => {
    if (i % 2) return tops[Math.floor(i / 2)] + heights[Math.floor(i / 2)] / 2;
    if (i === 0) return MARGIN / 2;
    return tops[i / 2 - 1] + heights[i / 2 - 1] + gapY / 2;
  });
}

function edgeLabelSVG(label, points, width) {
  const segments = points.slice(1).map((point, index) => ({
    a: points[index],
    b: point,
    length: Math.abs(point[0] - points[index][0]) + Math.abs(point[1] - points[index][1]),
  }));
  const { a, b } = segments.sort((first, second) => second.length - first.length)[0];
  const lines = wrap(label, EDGE_WRAP_WIDTH);
  const boxHeight = lines.length * EDGE_LINE_HEIGHT + 12;
  const textPixels = Math.max(...lines.map(line => splitGraphemes(line).reduce((sum, char) => sum + glyphWidth(char) * 14, 0)));
  const boxWidth = Math.ceil(textPixels) + 20;
  const x = Math.max(boxWidth / 2 + 2, Math.min(width - boxWidth / 2 - 2, (a[0] + b[0]) / 2));
  const y = (a[1] + b[1]) / 2;
  const background = `<rect class="diagram-label-bg" x="${x - boxWidth / 2}" y="${y - boxHeight / 2}" width="${boxWidth}" height="${boxHeight}" rx="4"/>`;
  return `<g>${background}${textSVG(lines, x, y + 5, EDGE_LINE_HEIGHT, 'diagram-edge-label')}</g>`;
}

function textAlternative(block, nodes, nodesById) {
  const nodeItems = nodes.map(node => `<li>${escapeHTML(node.id)}: ${escapeHTML(node.label)}</li>`);
  const edgeItems = block.edges.map(edge => {
    const label = edge.label ? `: ${escapeHTML(edge.label)}` : '';
    return `<li>${escapeHTML(nodesById.get(edge.from).label)} → ${escapeHTML(nodesById.get(edge.to).label)}${label}</li>`;
  });
  return [
    '<details class="diagram-text"><summary>Text description</summary>',
    `<p>${escapeHTML(block.description)}</p>`,
    `<ul class="prose-list">${nodeItems.join('')}${edgeItems.join('')}</ul></details>`,
  ].join('');
}

export function diagramHTML(block, id) {
  const gapY = Math.max(
    MIN_GAP_Y,
    ...block.edges.map(edge => (edge.label ? wrap(edge.label, EDGE_WRAP_WIDTH).length * EDGE_LINE_HEIGHT + 48 : 0)),
  );
  const nodes = block.nodes.map(node => ({ ...node, lines: wrap(node.label, NODE_WRAP_WIDTH) }));
  const nodesById = new Map(nodes.map(node => [node.id, node]));
  const columns = Math.max(...nodes.map(node => node.column)) + 1;
  const rows = Math.max(...nodes.map(node => node.row)) + 1;

  const heights = Array.from({ length: rows }, (_, row) => Math.max(
    MIN_NODE_HEIGHT,
    ...nodes.filter(node => node.row === row).map(node => node.lines.length * NODE_LINE_HEIGHT + 36),
  ));
  const tops = [];
  let bottom = MARGIN;
  for (const height of heights) {
    tops.push(bottom);
    bottom += height + gapY;
  }
  const xs = columnLines(columns);
  const ys = rowLines(tops, heights, gapY);
  const width = MARGIN * 2 + columns * NODE_WIDTH + (columns - 1) * GAP_X;
  const height = bottom - gapY + MARGIN;

  const gridPoint = node => [node.column * 2 + 1, node.row * 2 + 1];
  const occupied = new Set(nodes.map(node => pointKey(...gridPoint(node))));
  const usedSegments = new Map();
  const edgePaths = [];
  const edgeLabels = [];

  for (const edge of block.edges) {
    const from = nodesById.get(edge.from);
    const to = nodesById.get(edge.to);
    const grid = route(gridPoint(from), gridPoint(to), xs, ys, occupied, usedSegments);
    for (let i = 1; i < grid.length; i++) {
      const key = segmentKey(grid[i - 1], grid[i]);
      usedSegments.set(key, (usedSegments.get(key) ?? 0) + 1);
    }
    const points = simplify(grid.map(([x, y]) => [xs[x], ys[y]]));
    // Pull both ends from the node center out to the node border.
    for (const [index, neighbor, node] of [[0, 1, from], [points.length - 1, points.length - 2, to]]) {
      const point = points[index];
      const next = points[neighbor];
      if (point[0] === next[0]) point[1] += Math.sign(next[1] - point[1]) * heights[node.row] / 2;
      else point[0] += Math.sign(next[0] - point[0]) * NODE_WIDTH / 2;
    }
    const d = `M ${points.map(point => point.join(' ')).join(' L ')}`;
    edgePaths.push(`<path class="diagram-edge" d="${d}" marker-end="url(#${id}-arrow)"/>`);
    if (edge.label) edgeLabels.push(edgeLabelSVG(edge.label, points, width));
  }

  const nodeShapes = nodes.map(node => {
    const centerX = xs[node.column * 2 + 1];
    const rect = `<rect x="${centerX - NODE_WIDTH / 2}" y="${tops[node.row]}" width="${NODE_WIDTH}" height="${heights[node.row]}" rx="10"/>`;
    return `<g class="diagram-node">${rect}${textSVG(node.lines, centerX, ys[node.row * 2 + 1] + 6, NODE_LINE_HEIGHT, 'diagram-node-label')}</g>`;
  });

  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" class="diagram-svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="${id}-title ${id}-desc">`,
    `<title id="${id}-title">${escapeHTML(block.caption)}</title>`,
    `<desc id="${id}-desc">${escapeHTML(block.description)}</desc>`,
    `<defs><marker id="${id}-arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="9" markerHeight="9" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" class="diagram-arrow"/></marker></defs>`,
    edgePaths.join(''),
    nodeShapes.join(''),
    edgeLabels.join(''),
    '</svg>',
  ].join('');

  return [
    `<figure class="diagram"><figcaption><span>${escapeHTML(block.caption)}</span>`,
    '<button class="diagram-expand" type="button" aria-haspopup="dialog" hidden>Expand diagram</button></figcaption>',
    '<p class="diagram-hint">Scroll horizontally if needed. A text description follows the diagram.</p>',
    `<div class="diagram-scroll" tabindex="0" role="region" aria-label="${escapeHTML(block.caption)}">${svg}</div>`,
    `${textAlternative(block, nodes, nodesById)}</figure>`,
  ].join('');
}
