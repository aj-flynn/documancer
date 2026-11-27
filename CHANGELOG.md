# Changelog

All four editions (Codex, OpenCode, Cursor, Claude Code) share one version number.

## 1.9.0 (2026-11-27)

`schemaVersion` stays 2 and existing documents need no change. Everything below is optional or relaxes a rule.

### Changed

- **No size limit on files beside the source.** The 1 MB limit per image or prototype and the 6 MB limit per document are gone, in `--check` and in rendering. Every other check on these files stays: the type, that the file is inside the source folder, `alt` text and the prototype rules.

### Added

- **Review previews.** A preview whose `ticket.kind` is `review` collects answers to independent findings, such as the places a usability tester hesitated. Each view is answered on its own; the decision block has one button, Finish review, and no Reject ticket, and the response's `decision` is `reviewed`. `impact` is optional in a review and `work` is not accepted. See "A review" in `references/preview.md` and `examples/review.json`.
- **`cost` on a view**: what the current behaviour costs the user, shown under the ask as What this costs the user. It is checked for code names like `problem.symptom`.
- **Wording-only screen views.** A `screen` view may leave out `proposed` when only wording changes: it shows the current screenshot, and each change gives its now and proposed text.

## 1.8.0 (2026-11-27)

`schemaVersion` stays 2 and existing documents need no change; render them again to get the new routing. Diagram nodes may now leave out `row` and `column`, and the renderer lays the diagram out. A diagram with one box that has more edges than its sides have room for may now be rejected; the error names the edge, and the fix is to give that node fewer edges or split the diagram.

### Changed

- **The renderer lays out diagrams.** Leave out `row` and `column` on every node and the renderer places the nodes with a layered layout, the method of Graphviz `dot`: loops are set aside so the remaining arrows all point one way, each node goes in the layer after the nodes that point to it, each layer is ordered to cut crossings, and nodes line up with the nodes they connect to. It tries a few arrangements and keeps the one with the fewest crossings, then the smallest area. Every edge is drawn. Placing nodes by hand still works, and the technical example now uses automatic layout.
- **Every diagram edge has a line of its own.** Edges used to merge into shared lines, so a reader could not tell which box an arrow came from. Now no two edges share any stretch of line, each edge leaves and enters a box at its own point on the box's side, and where two edges cross the horizontal one hops over the vertical one, so a crossing no longer looks like a junction. Gaps between boxes hold several parallel tracks to make room.
- **Crowded gaps are widened.** When some edge cannot get lines of its own, the renderer widens the gaps between boxes and routes again, up to three times. A diagram that still cannot be drawn is rejected with the path of the edge, instead of being drawn ambiguously.
- **Rows and columns go up to 15**, up from 7.
- **Edge labels avoid other edges, boxes and labels.** A label goes on its line or just beside it; when there is no such place, the gaps are widened as for a crowded edge, so labels on two arrows running close together no longer cover each other.
- **Arrowheads are slightly smaller** so neighbouring arrows into one box stay apart.

### Added

- **Optional diagram `direction`**, `down` or `right`. Without it, the renderer tries both and keeps the one with fewer crossings, then the one that needs less sideways scrolling in the text column, then top to bottom. With hand placement it sets the flow that warnings check against.
- **Guidance on splitting a diagram** in `references/data-contract.md` and every edition's `SKILL.md`: when to split, how to cut by consumer, layer, path or subsystem without losing an edge, and when to use a table instead.
- **Diagram layout rules** in `references/data-contract.md`, pointed to from every mode reference and every edition's `SKILL.md`: prefer automatic layout, choose a table for many-to-many relationships, keep one direction of flow, keep connected nodes adjacent, stay within about 12 nodes, 1.5 edges per node and 5 edges per node, split a dense diagram rather than leaving edges out, and connect every node.
- **Diagram warnings.** `render.mjs`, `render.mjs --check` and `--set` print a warning to standard error, with the diagram's path, for edge crossings, an arrow against the flow that does not close a loop, more than 12 nodes, more than 1.5 edges per node, a node with more than 5 edges (unless the diagram is about that node), or a node with no edges. Warnings do not stop the render. `diagramWarnings` and `documentDiagramWarnings` are exported from `render.mjs`.

## 1.7.0 (2026-11-15)

No breaking change: `schemaVersion` stays 2. Render existing documents again to get the new print layout.

### Changed

- **Print is one document, whatever the appearance.** Printing from Dark or either Cyberpunk appearance used to leave black page margins; every appearance now produces the same pages. The print colours and type scale are set in one place, and the theme script no longer sets an inline colour scheme that could outrank them.
- **Print is laid out the same on any paper.** Rules for window widths now apply to screens only, so paper never picks up the phone layout.
- **Print type and spacing.** Body text prints near 9.5pt across the full column, sections are separated by a rule with their icon and heading, the question a section asks prints as a marked block, and callouts, pass rules, step numbers and recorded answers are outlined instead of filled.
- **Page breaks.** A section heading, its question, a sub-heading or a caption stays with what follows it; a recorded answer is never split and names its test or view ("UAT-03 result: Passed"), so it reads correctly at the top of a page; steps, callouts, tables, short lists, changes and figures are not split.
- **Running footer.** Each sheet carries the document title and "Page n of N". In Chrome and Edge this replaces the browser's own date and address header.
- **Document details in print** sit beside the wordmark at the top of the first page. On screen they stay in the footer.
- **Diagrams are more compact**, on screen and in print: less empty margin, and rows sit closer unless an edge label needs the room. In print a diagram is drawn at figure size, so it rarely has to move to the next page and leave a gap.
- **Code blocks in print** keep their language label and wrap long lines. A preview's now and proposed contracts print side by side.
- **A preview's prototype prints** as the screen it opens on, beside the screenshot of now, in place of a note saying it could not be printed. Screenshots print centred at figure size. The decision prints what still needs an answer, and a generated summary prints without its data block.

### Added

- **`--upgrade`** on every installer. It builds the new version beside the backups, moves the installed skill to `documancer-backups/` next to the skills folder, puts the new one in its place, and with `--agents` replaces the profiles the old version installed. A profile edited by hand, a newer install, another edition or a folder that is not Documancer stops it before anything moves.

## 1.6.0 (2026-11-15)

No breaking change: `schemaVersion` stays 2. Existing documents need no edits and render in the new card layout.

### Added

- **Preview mode** (`mode: "preview"`): shows what a ticket would change before it is built and collects the reader's response. The page leads with the problem and what the request missed, then an impact strip, questions with options, one view per screen or backend change, the work that will be created, and a decision block with Approve, Send back and Reject ticket. Each view leads with one question (`ask`), then a numbered list of what changes in plain language, with before and after side by side where there is one. The contract is in `references/preview.md`; `examples/preview.json` shows every view kind.
- **Seven view kinds:** `screen`, `examples`, `data`, `access`, `flow`, `contract` and `operations`. A screen shows a screenshot of now and either a clickable prototype or an image of what is proposed.
- **Prototypes** are one HTML file beside the source, embedded in a sandboxed frame that blocks every network request. The renderer supplies the option switch, numbered change markers, jump links and Expand. It rejects a prototype that refers outside itself, and one whose `data-change` marks do not match the view's list of changes.
- **Responses:** Yes, Change, Ask first, Drop or Later per view (stored as `ok`, `change`, `question`, `drop`, `later`), with a note required for everything except Yes; one choice per question, plus "None of these". Nothing is preselected. Viewing an option does not choose it, and a Yes is withdrawn if the reader then chooses a different option. "Yes to all remaining" is recorded as a bulk answer.
- **Card layout in every mode.** Each section after the introduction is a card with an icon, a label and a colour that say what it is for: amber is background, blue is a choice, green is something to do or decide, grey is information only. The renderer picks all three from the content; the JSON does not change. A guide section is labelled by what it holds (steps, a diagram, code, a table, folded detail). A UAT test leads with what the tester is judging and ends with large result buttons. Callouts become icon rows, coloured as a warning, a tip or a reminder from the words in their title.
- **Sidebar and detail panel** match the cards: sections are grouped, each with its icon, and a dot fills in as a test or view is answered. The panel shows a progress meter and a colour key. Below the width where the panel fits, a bar under the header keeps the count and a link to each answer in view.
- **Two more appearances:** Cyberpunk '80s (neon on violet-black, square corners, grid and scanlines) and Cyberpunk modern (black with acid yellow, cut corners, condensed type). They are chosen in Appearance, never by the system setting, and do not affect print.
- **`image` block** in every mode: a local PNG, JPEG or WebP embedded in the page, with required alt text, a 1 MB limit per file and 6 MB per document. Images open in the full-window dialog that diagrams use.
- **`change` on diagram nodes and edges** (`added`, `removed`, `changed`), in every mode.
- **`render.mjs --check <source.json>`** validates a source and its files without rendering, and exits non-zero with the path of the field at fault.
- **Host interface:** `renderDocument` accepts `baseDirectory` and, for a preview, `preview: { responses, submitUrl }` to pre-fill earlier responses and to send the response on an explicit click. `checkDocument` and `viewHashes` are exported; a view's hash covers its fields and the bytes of its files.

### Changed

- **Expand** for a diagram or image now sits on the item, at its top right corner, instead of in the caption row.
- **Light appearance:** cards are lighter than the page, and the main button is green with light text.
- **UAT wording on the page:** Prerequisites is now "Before you start", Test plan is "Do this", and Problem signs is a warning row. Reset and agent rehearsal are folded under one heading. The JSON fields are unchanged.
- **Sets** resolve each document's files from that document's own folder, and refuse a preview.
- **Skill text** in all four editions describes the fourth mode and restates the submit rule: nothing is sent without an explicit click.

## 1.5.0 (2026-11-15)

### Breaking

- **Schema version 2.** Documents must declare `schemaVersion: 2`; the renderer rejects any other value and says how to update. No field was removed or renamed. The data contract ends with the steps for bringing a version 1 document forward.
- **Reserved section ID.** `document-content` can no longer be used as a section ID.

### Added

- **Claude Code edition** in `packages/documancer-claude/`, installed with `node install.mjs claude <project>`. The skill runs the renderer through `${CLAUDE_SKILL_DIR}`. Its four optional agents have enforced tool allowlists; mapping, drafting and review use the `sonnet` alias and analysis inherits the session model.
- **`context` field** (optional): a summary of up to 280 characters, a list of links with free-text kinds such as Ticket or Pull request, or both. Shown as "At a glance".
- **`generatedBy` field** (optional): the agent and model that wrote the document, shown in the footer and included in the UAT summary.
- **Detail panel** on screens at least 1280px wide, holding At a glance, live UAT results with a link to the summary, and an "On this page" outline for guides. A guide with nothing to show has no panel.
- **UAT test list** in the intro, showing each test's current result and how many tests have one.
- **Fixed header** on desktop that shows the document title once the page heading has scrolled away.
- **`CLAUDE.md`** with guidance for working in this repository.

### Changed

- **Faster to the content.** The header and intro are shorter and the overview follows the lead with no heading.
- **Document details moved to the footer**, which is now one narrow bar. Source identity is no longer displayed there; it remains in the JSON and the UAT summary.
- **UAT criteria** (pass when, problem signs, reset, rehearsal) are a ruled list, and test IDs are a small label beside the title.
- **Wide layout** fills the window with three columns instead of a centered 880px article.
- **Sidebar highlight** switches when a section reaches the upper third of the window and marks the last section at the end of the page.
- **Print** is one clean column: screen-only controls, expand markers, tab-related notes and diagram text alternatives are removed; web links print their address; diagrams keep their natural size and fit a page; blocks are not split across pages.
- **One stylesheet.** `tokens.css`, `base.css` and `forest.css` are folded into a single organized `document.css`.
- **Codex agents** use the current model IDs (`gpt-6.1-terra`, `gpt-6.1-sol`, `gpt-6-luna`).
- **Skill descriptions** for Codex and OpenCode now say when to use the skill and when not to.
- **Generated pages** are stamped with the package version.

### Fixed

- **Print:** the "Skip to documentation" link no longer repeats on every page, and diagrams are no longer enlarged past a page, which left pages mostly blank.
- **Print colors** apply correctly when the saved theme is light, and code blocks print as dark text on white.
- **Code blocks inside collapsible sections** no longer get a light background in the light theme.
- **Skip link** jumps to the document content instead of landing before the sidebar.
- **Accessibility:** the sidebar is a labelled landmark, callouts are notes instead of unnamed page regions, and code regions and their copy buttons are named.
- **Codex agents:** removed `sandbox_mode` from agent files, where it has no effect; the delegation reference now says read-only is by instruction and how to enforce it on the parent session.
- **OpenCode:** the delegation reference reflects the subagent tool and explains why the profiles keep the version 1 permission format.

## 1.4.0

- 2026-10-19: structured SVG diagrams rendered from JSON nodes and edges, with a full-window view.
- 2026-10-04: Cursor edition scoped to documentation work, launching ready tasks together.
- 2026-10-04: Codex and OpenCode editions, the shared renderer, and the installers.
- 2026-10-04: extracted from Flynn Technology's Documancer 1.3.0 and OpenCode 1.1.0 packages.
