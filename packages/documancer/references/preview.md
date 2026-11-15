# Preview mode

Use `mode: "preview"` to show what a ticket would change **before** anything is built, and to collect the reader's response. You write JSON, one screenshot per current screen and one prototype file per proposed screen. The renderer draws the page, the prototype frame, the response controls and the decision block. Do not write layout, theming or submit logic.

Shared fields (`schemaVersion`, `title`, `lead`, `identity`, `overview`, `context`, `brand`, `generatedBy`, `sources`) and content blocks are defined in [data-contract.md](data-contract.md). This file defines everything specific to preview. See `../examples/preview.json` with its files in `../examples/preview/`.

## What the reader gets

The renderer fixes the order:

1. **Title, lead, At a glance, overview.** Put the ticket link in `context`. Use `overview` to restate the request in plain words: what was asked, what you understood, what is out of scope.
2. **The problem**, then **what the request missed** (`findings`).
3. **Impact:** five yes/no answers that appear on every preview.
4. **Questions**, each with options. They come before the views because the views depend on the answers.
5. **Views** in source order: one per screen or backend change. Each leads with the question the reader answers, then what changes, then the evidence.
6. **Work that will be created.**
7. **Your decision:** what is still unanswered, Yes to all remaining, an overall note, and Approve or Send back, and Reject ticket.

Every part is a card. The card heading carries an icon and a label that the renderer picks from the kind of section; you never choose them. Colour says what a card is for: amber is background to read, blue is a choice, green is a decision, grey is information only.

| Card | Icon | Label |
| --- | --- | --- |
| The problem | Exclamation in a circle | Why this ticket exists |
| What the request missed | Magnifier | Read before you decide |
| Impact | Bar chart | At a glance |
| A question | Question mark | Question 1 of 2 |
| `screen` view | Monitor | Screen |
| `examples` view | Lines of text | Rule |
| `data` view | Database | Stored data |
| `access` view | Key | Who can do what |
| `flow` view | Two linked boxes | How it works |
| `contract` view | Braces | Connection to other apps |
| `operations` view | Sun-shaped dial | Rollout |
| Informational view | Letter i in a circle | For information |
| Work that will be created | Ticket stub | If you approve |
| Your decision | Ticked box | Last step |

A view card is laid out the same way every time: the label and title, **You are deciding** with the view's `ask`, **What changes** as a numbered list, the screens, table or diagram, **Stays the same** and **Behind this** folded away, and the answer buttons. Behind this holds how "now" was obtained, the source files, and the technical detail of a `data` or `contract` view.

Each view offers five answers: Yes, build this; Change it; Ask first; Drop it; Later. They are stored as `ok`, `change`, `question`, `drop` and `later`. None is preselected and every answer except Yes needs a note. Each question offers its options plus "None of these", which needs a note. Approve is available only when every view is answered Yes and every question has a choice. With anything else recorded and its notes present, the same button is Send back. Reject ticket needs an overall note.

## Rules for content

- **Lead with the problem in user terms.** `problem.symptom` is the first thing read. The renderer rejects a symptom containing a file path or a code identifier (`camelCase`, `snake_case`, `name()`). Text the product prints may be quoted in backticks, which the renderer shows as code: ``A new Section prints as `Sec. 1. Scope`.``
- **Ask one plain question per view.** `ask` is the largest text on the card and the reader should be able to answer it without reading further: "Should a paused person stop getting comment email?", not "Review the delivery rule changes". Write it so that Yes means build what is shown.
- **Say what changes in the reader's words.** Each entry in `changes` is one thing that will be different, with no code names. Where there is a before and after, give both as `now` and `proposed`. Put what the reader might worry about and is not changing in `unchanged`.
- **Report what the request gets wrong.** If the ticket names a place that does not behave as it says, or misses a second caller, say so in `findings`. Mark each `checked` (you verified it in the code) or `inferred`.
- **Never answer for the reader.** Responses and choices are not accepted in the source. `recommended` sets the option a prototype shows first; it is never the reader's choice.
- **Show screens that look affected and are not.** Add the view with `"informational": true` and only `now`. It gets no response controls and never blocks Approve.
- **Record what you actually know.** `basis` says how "now" was obtained. Do not mark a view `screenshot` when you read the code and drew it.
- **Keep every ID stable across revisions.** A host keeps the reader's earlier Yes on a view whose content did not change, and approved example rows become acceptance criteria.

## Top-level fields

```json
{
  "schemaVersion": 2,
  "mode": "preview",
  "title": "Print new Sections without a heading",
  "lead": "One sentence: the decision this preview asks for.",
  "identity": { "id": "LEGIMANCER-540-PREVIEW", "version": "2", "date": "2026-11-15", "source": "main ec0f6c8c" },
  "context": { "summary": "…", "links": [{ "kind": "Ticket", "label": "#540", "href": "https://…" }] },
  "ticket": { },
  "overview": [ ],
  "problem": { },
  "findings": [ ],
  "impact": { },
  "questions": [ ],
  "views": [ ],
  "work": [ ],
  "leaveAsIs": "What stays true if nothing is done."
}
```

Required: `ticket`, `overview`, `problem`, `impact`, `views` (at least one), `leaveAsIs`. Optional: `findings`, `questions`, `work`. Not accepted in this mode: `sections`, `setup`, `tests`, `evidence`, `related`. A preview cannot be part of a set.

### `ticket`

```json
{
  "repository": "aj-flynn/Legimancer",
  "number": 540,
  "version": 2,
  "origin": "agent",
  "kind": "change",
  "builtAt": { "commit": "ec0f6c8c", "date": "2026-11-15" },
  "surfaces": ["bill-preview", "public-proposal"]
}
```

All fields are required. `repository` is `owner/name`. `number` and `version` are positive integers; `version` is this preview's revision, starts at 1, and is separate from `identity.version`. Both are written into every response, because a host refuses a response to an older preview. `origin` is `agent` or `founder` and is shown beside the problem. `kind` is a nonempty string. `builtAt.commit` is 7 to 40 hexadecimal characters and is shown in the footer with `builtAt.date` (YYYY-MM-DD). `surfaces` is an array of strings and may be empty.

### `problem`

```json
{
  "symptom": "A new Section prints as `Sec. 1. Scope`. Indiana bills print `Sec. 1.`",
  "evidence": [{ "type": "paragraph", "text": "…" }],
  "impact": "Who is affected and what happens if it is left.",
  "source": "Filed by an agent during the regression run after #319."
}
```

All four are required. `symptom`, `impact` and `source` are strings written for someone who does not read code. `evidence` is a nonempty block array and may hold `image` blocks.

### `findings`

Array of `{ "title", "text", "basis" }`; `basis` is `checked` or `inferred`.

### `impact`

```json
{
  "storedData": { "answer": "no" },
  "access": { "answer": "no" },
  "retainedHistory": { "answer": "yes", "note": "Published bills keep their old line." },
  "qaReset": { "answer": "no" },
  "reversible": { "answer": "yes", "note": "Revert the one commit." }
}
```

All five keys are required. `answer` is `yes`, `no` or `unknown`. `note` is required unless the answer is `no`. They mean: does stored data change, does who-can-do-what change, is retained history affected, does QA need a reset, can the change be reversed.

### `questions`

```json
{
  "id": "q2",
  "title": "Where does the author's heading go?",
  "blocks": [ ],
  "options": [
    { "id": "2a", "label": "No heading shown", "detail": "…" },
    { "id": "2b", "label": "Heading as a label beside the SECTION title", "detail": "…" }
  ],
  "recommended": "2b",
  "reason": "Why you recommend it.",
  "discussion": [{ "from": "founder", "text": "…" }, { "from": "agent", "text": "…" }]
}
```

`id`, `title`, `options`, `recommended` and `reason` are required. Question IDs begin with a letter and contain letters, digits or hyphens; they share one namespace with view IDs. At least two options; option IDs contain letters, digits or hyphens, are unique within the question, and may not be `none`. `detail` is optional. `recommended` must be the ID of one option. Do not add a "none of these" option: the renderer adds it. `blocks` is an optional block array. `discussion` holds the reader's earlier questions and your answers; `from` is `founder` or `agent`.

### `views`

Fields every view has:

```json
{
  "id": "s1",
  "kind": "screen",
  "title": "Workspace Bill preview",
  "ask": "Should the first section show its heading beside the title?",
  "basis": "screenshot",
  "informational": false,
  "files": ["packages/drafting/src/bill-lead-in.ts"],
  "areas": [],
  "changes": [
    { "id": "c1", "label": "The heading of the first section", "now": "Not shown", "proposed": "Shown beside the title", "when": "q2=2b" },
    { "id": "c2", "label": "A new line under the title", "detail": "It names the Act being amended." }
  ],
  "unchanged": ["Later sections keep their headings."],
  "notes": [ ],
  "discussion": [ ]
}
```

`id`, `kind`, `title` and `basis` are required. `ask` and at least one entry in `changes` are required unless the view is informational.

- `kind`: `screen`, `examples`, `data`, `access`, `flow`, `contract` or `operations`. It selects the layout and the fields below.
- `ask`: the one question the reader answers on this view, as a sentence. Not allowed on an informational view.
- `basis`: how "now" was obtained: `screenshot`, `generated`, `read` (from code) or `inferred`. Shown under Behind this.
- `informational`: `true` for a view that changes nothing. It may have no `ask` and no `changes`.
- `files`: source files behind the view, shown folded away.
- `areas`: guarded areas the view reaches, such as `schema` or `authorization`.
- `changes`: what will be different, in plain language, each `{ "id", "label", "detail", "now", "proposed", "when" }`. `id` and `label` are required and IDs are unique within the view. `label` names the thing that changes. `now` and `proposed` are optional and come as a pair: give both when there is a before and after, and the card shows them side by side. `detail` is an optional second line. `when` is optional and limits the change to one option, written `question=option`. On a screen with a prototype, each ID must also mark an element in the prototype.
- `unchanged`: optional array of sentences, shown folded under Stays the same.
- `notes`: optional block array of free prose shown after the evidence.
- `discussion`: as for questions.

Kind-specific fields:

| Kind | Fields |
| --- | --- |
| `screen` | `now`: `{ "image", "alt" }`. `proposed`: `{ "prototype" }` or, for a small change, `{ "image", "alt" }`. `now` may be omitted for a screen that does not exist yet. An informational screen has `now` and no `proposed`. |
| `examples` | `columns`: names of the inputs. `rows`: `[{ "id", "inputs", "now", "proposed", "changed" }]` with one input string per column, `now` and `proposed` as strings, `changed` as true or false. Row IDs are unique within the view. |
| `data` | `tables`: `[{ "name", "change", "columns": [{ "name", "type", "nullable", "change", "was" }] }]`. `change` is `added`, `removed`, `changed` or `unchanged`; `nullable` is true or false; `was` is required when a column is `changed`. `existingRows`: what happens to rows already stored. Optional `diagram`. |
| `access` | `actors` and `actions`: arrays of names. `cells`: `[{ "actor", "action", "now", "proposed", "condition" }]` with `now` and `proposed` as `yes` or `no` and an optional `condition`. A pair with no cell is shown as not applicable. |
| `flow` | `diagram`: a diagram block whose nodes and edges may carry `change` (see the data contract). |
| `contract` | `name`, `consumers` (array of names), `proposed` and optional `now`, each a `code` block: `{ "type": "code", "text", "language" }`. |
| `operations` | `blocks`: a nonempty block array. |

A backend-only preview has no screen views.

### `work`

Array of `{ "title", "outcome", "size", "touches" }`. `size` is `small`, `medium` or `large`. `touches` is an optional array of guarded areas.

### Fields that are recorded and not displayed

These exist for the host that reads the JSON. Fill them in accurately; an unknown field is still rejected.

| Field | Purpose |
| --- | --- |
| `ticket.surfaces` | The host's per-surface limit on unaccepted work. |
| `ticket.kind`, `ticket.repository` (shown only in the footer and summary) | Routing, and building the response. |
| `views[].areas`, `work[].touches` | Stopping work that reaches a guarded area the preview never showed. |
| `views[].kind` | Checked against the views an application requires. Picks the card's icon and label. |
| `views[].changes[].id`, `.when` | Jump links and option switching. |
| `questions[].options[].id`, examples `rows[].id` | Recording a choice; turning approved examples into criteria. |
| `identity.source` | Included in the summary. |

Two things are deliberately **not** in the JSON: a content hash per view, which the renderer computes (`viewHashes`), and the reader's responses, which the host supplies when it renders.

## Files beside the source

Paths are relative to the folder holding the source JSON, use forward slashes, and may not leave that folder. Each file may be at most 1 MB, and all files in one document at most 6 MB.

- **Images** (`now.image`, `proposed.image`, and `image` blocks): PNG, JPEG or WebP, with required `alt` text that says what the screen shows.
- **Prototypes** (`proposed.prototype`): one `.html` file per view.

## Writing a prototype

A prototype is one self-contained HTML file that looks like the real screen. The renderer embeds it in a sandboxed frame with no network access and adds the option switch, change markers, jump links and Expand itself. Write the markup and styles only.

- **Mark every changed element** with `data-change="<id>"`, using the IDs in the view's `changes`. The renderer fails when a declared change has no element, and when an element carries an undeclared ID.
- **One file covers every option.** Mark an element that belongs to one option with `data-when="q2=2a"`. It is shown only while that option is being viewed. Do not write one file per combination.
- **Nothing outside the file.** Styles and scripts are inline; images and fonts are `data:` URIs. The renderer rejects `src`, `srcset`, `url()`, stylesheet links, `@import`, `iframe`, `object`, `embed`, `base`, `http-equiv` metadata and navigation by script. Ordinary `<a href>` links are allowed and do nothing when clicked.
- **Keep it small.** Include only the styles the screen needs, not the application's whole stylesheet.
- Your own inline script may make tabs or toggles work. Do not script the change markers, the option switch or scrolling.

## Checking and rendering

```sh
node scripts/render.mjs --check preview.json
node scripts/render.mjs preview.json preview.html
```

`--check` validates the JSON and every file it refers to without writing anything, and exits non-zero with the path of the field at fault. Fix the source and check again until it passes.

Then open the HTML and verify, in both themes and at phone width: the problem reads without code names; every prototype shows each option and each jump link lands on its change; Expand fills the window and Escape returns; each view's question can be answered without reading further; an answer other than Yes asks for its note; the decision block lists what is unanswered. Check the print layout: prototypes are replaced by their change list and responses print as text.

Responses live in the tab only and are lost on reload. Tell the reader to choose an action and keep the summary before closing.

## For a host that renders previews

`render.mjs` exports:

- `checkDocument(doc, { baseDirectory })`: validate with files, without rendering.
- `renderDocument(doc, { baseDirectory, preview: { responses, submitUrl } })`. `responses` is `{ "views": { id: { "response", "note", "options", "bulk" } }, "questions": { id: { "choice", "note" } } }` from an earlier version; they are pre-filled and marked as carried over. Entries for views or questions that no longer exist are ignored. `submitUrl` is an absolute http(s) address.
- `viewHashes(doc, { baseDirectory })`: one SHA-256 per view ID, from the view's fields and the bytes of its files. `discussion` is excluded, so answering a question does not change the hash.

With `submitUrl`, choosing Approve, Send back or Reject ticket sends one `POST` with `Content-Type: application/json`; a page opened from a file needs the host to answer the CORS preflight. Without it, or when sending fails, the same click writes a text summary ending in the same JSON and copies it. The response:

```json
{
  "ticket": 540,
  "version": 2,
  "decision": "send-back",
  "okRemaining": false,
  "views": {
    "s1": { "response": "ok", "options": { "q2": "2b" } },
    "s2": { "response": "change", "note": "…" }
  },
  "questions": { "q2": { "choice": "2b" } },
  "note": ""
}
```

`decision` is `approve`, `send-back` or `reject`. A view the reader did not respond to is absent. `options` records the option in force for each question the view varies by. A view marked by Yes to all remaining carries `"bulk": true`, and `okRemaining` is then true. A question's `choice` is an option ID or `none`. A Yes (`ok`) is withdrawn on the page if the reader later chooses a different option from the one the view was answered with.
