# Changelog

All four editions (Codex, OpenCode, Cursor, Claude Code) share one version number.

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
