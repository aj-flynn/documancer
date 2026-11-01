# Source data contract · schemaVersion 1

All content strings are plain text, escaped by the renderer. No Markdown parsing or raw HTML. UTF-8 JSON is the editable source of truth. Unknown properties are rejected so typos do not silently drop content.

Required top-level fields:

- `schemaVersion`: `1`.
- `mode`: `technical`, `user-guide` or `uat`.
- `title`, `lead`: nonempty strings.
- `identity`: object with nonempty `id`, `version`, `date` (valid YYYY-MM-DD) and `source` (code/release identity or explicit uncertainty). Optional strings: `repositoryRoot`, `branch`, `commit`, `readiness`.
- `overview`: nonempty block array. The renderer supplies the Overview heading.

Optional shared fields:

- `brand`: `{ "name": "Publisher", "logo": "none" }`. Name defaults to Flynn Technology LLC; logo is `flynn` or `none`. If name is customized and logo omitted, text branding is used. Explicit `flynn` requires the Flynn company name.
- `related`: optional legacy label overrides (`{ "label", "href" }`) for matching companions in an explicitly generated set. It does not create links to files outside that set. Omit for automatic guide labels. Standalone exports ignore this field for navigation.
- `sources`: array of `{ "label", "href" }` source links. They appear in Overview, keeping Summary last for UAT.

Technical and user-guide modes require `sections`: nonempty array of `{ "id", "title", "blocks" }`. Section IDs are unique lowercase slugs beginning with a letter (`[a-z][a-z0-9-]*`). `overview` is reserved. Do not supply UAT fields in these modes.

UAT requires `setup` (nonempty block array) and `tests` (nonempty array). Do not supply `sections`. Optional `evidence` is an array; omit it if unavailable.

Each UAT test requires:

```json
{
  "id": "UAT-01",
  "title": "Find a topic",
  "brief": "Judge whether the matching topic is easy to locate.",
  "prerequisites": [{ "type": "paragraph", "text": "Use the user guide. Search text: appearance." }],
  "steps": ["Type appearance in Find in this document.", "Choose the matching topic."],
  "expected": "The selected topic is visible.",
  "problemSigns": "A missing match or a link to the wrong section.",
  "reset": "Clear the search field.",
  "rehearsal": "Not rehearsed; the target application was unavailable."
}
```

Test IDs begin with a letter and contain letters, digits or hyphens. IDs must be unique, case-insensitively. Result and notes are intentionally not accepted in source data; new documents always start Untested. Evidence records require `title`, `status` (`passed`, `failed`, `blocked`, `untested`), `detail`; optional `history` is a nonempty string. Include execution date, command/check, tested code/configuration/data and meaningful observations in `detail`.

## Content blocks

| Type | Fields |
| --- | --- |
| `paragraph` | `text` |
| `heading` | `text` (rendered as h3 within a section) |
| `list` | `items`: nonempty array of strings |
| `steps` | `items`: nonempty array of strings |
| `code` | `text`; optional `language` label. Includes a Copy code action. |
| `table` | `caption`, `columns`: nonempty strings; `rows`: nonempty arrays of strings, each matching column count |
| `callout` | `title`, `text` |
| `details` | `title`, `blocks`: nonempty block array |
| `links` | `items`: nonempty `{ "label", "href" }` array |
| `diagram` | `caption`, `description`, `nodes`, `edges`: static SVG generated from the grid below |

### Diagrams

Use diagrams when relationships, branches, sequence or state changes are easier to understand visually. All text is escaped, including SVG labels. No raw SVG, HTML, Mermaid, external images or network resources are accepted. The generated SVG uses the document's embedded font and theme colors, and remains visible without JavaScript. A keyboard-focusable horizontal scroll region preserves the diagram's readable size on narrow screens. With JavaScript and browser dialog support, clicking the SVG, pressing Enter in its scroll region, or selecting Expand diagram opens a full-window modal with scrolling, a Close diagram button and Escape support. Closing restores focus to the opener. No browser fullscreen permission is needed. Without JavaScript or dialog support, the static diagram and text alternative remain usable and expansion buttons stay hidden. A text alternative lists every node and directed relationship; the author supplies the explanatory `description`.

```json
{
  "type": "diagram",
  "caption": "Document generation",
  "description": "Source JSON is validated before HTML is written. Invalid input must be corrected before trying again.",
  "nodes": [
    { "id": "source", "label": "Editable JSON", "row": 0, "column": 0 },
    { "id": "validate", "label": "Validate source", "row": 1, "column": 0 },
    { "id": "html", "label": "Self-contained HTML", "row": 2, "column": 0 },
    { "id": "fix", "label": "Correct source", "row": 1, "column": 1 }
  ],
  "edges": [
    { "from": "source", "to": "validate" },
    { "from": "validate", "to": "html", "label": "Valid" },
    { "from": "validate", "to": "fix", "label": "Invalid" },
    { "from": "fix", "to": "source", "label": "Retry" }
  ]
}
```

Each diagram has 1–40 nodes and 0–80 directed edges. Each node requires a unique lowercase-slug `id`, a nonempty `label` of at most 180 Unicode code points, and integer `row`/`column` positions from 0 to 7. Positions start at the top left; two nodes cannot occupy one cell. IDs are local to the diagram. Each edge requires existing `from`/`to` node IDs and an optional nonempty `label` of at most 48 code points. Duplicate directed edges and self edges are rejected; reverse edges and cycles between different nodes are supported. Unknown fields are rejected.

Place related nodes in neighboring cells. The renderer sizes rows for wrapped labels and routes orthogonal arrows around occupied boxes. It does not infer a chronology, decision, or relationship from grid placement: author every intended arrow explicitly, and label decision branches. Edge crossings or shared segments are possible in dense diagrams; inspect the export and rearrange or split diagrams when ambiguous. Use short labels and explain details in the description or nearby prose. This is a box-and-arrow vocabulary, not UML or a sequence-diagram grammar.

Diagrams work anywhere blocks are accepted, including nested details and UAT prerequisites. Verify the final HTML in both themes and at narrow widths: readable labels, correct arrow directions, no clipping or ambiguous overlaps, keyboard scrolling, and no page-wide horizontal overflow. Successful CLI rendering alone is not visual verification.

Links support HTTPS, HTTP, mailto, fragment anchors and relative document paths. Protocol-relative URLs, backslashes, control characters and other schemes are rejected. Local fragment links must reference a generated section ID; cross-document fragments are the author's responsibility. The renderer never fetches linked resources.

The CLI validates required fields, object keys, dates, modes, URL schemes, table widths and ID uniqueness. It cannot verify product claims, source freshness or remote link reachability. No generated timestamp enters the document build, so the same source and package produce the same HTML. UAT summaries receive their own generation time when the user clicks Generate summary.

## Generating a document set

Use `node scripts/render.mjs --set set.json output-directory`. The manifest has one `documents` array; each entry has `source` (JSON path relative to the manifest) and `output` (relative HTML path within the output directory). Include at most one document of each mode. See `../examples/set.json`. All sources are validated and rendered before output is written. Duplicate outputs, duplicate modes and traversal paths are rejected.

Header links come only from the current set, regardless of stale files in the destination. Technical and user guides link only to each other; UAT is excluded. UAT links to either guide open in a new tab with `noopener noreferrer` and an accessible new-tab announcement. Known companion links in body blocks and sources follow the same UAT policy. Do not author links to other UAT files in public documentation. Single-document CLI rendering has no companion navigation.

This is a build-time distribution boundary, not a runtime file probe. If the distribution subset changes, render that subset again; existing HTML cannot detect a guide deleted or withheld after generation. Source links and ordinary content links are still authored links, not availability-checked companion navigation.
