# Changelog

All four editions (Codex, OpenCode, Cursor, Claude Code) share one version number.

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
