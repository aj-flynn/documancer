---
name: documancer
description: Create or update self-contained HTML technical references, user guides, interactive human UAT plans, and ticket previews from editable JSON. Use when the user asks for Documancer, a technical reference, a user guide, a human acceptance plan, a preview of what a ticket would change before it is built, or offline HTML product documentation. Do not use for README files, other markdown docs, code comments, or automated test suites.
compatibility: Claude Code with Node.js 20+
---

# Documancer

Create a source JSON document and a self-contained HTML export with the bundled renderer. Reuse this design for all four modes; do not recreate the layout per document or require this skill's original repository at runtime.

Choose only the reference needed for the requested work:

- **Technical** — architecture, configuration, contracts, integrations or operations: [technical.md](references/technical.md).
- **User guide** — task instructions for people using a product: [user-guide.md](references/user-guide.md).
- **UAT** — human acceptance journeys, results and notes: [uat.md](references/uat.md).
- **Preview** — what a ticket would change, shown before it is built, with questions, views and response controls: [preview.md](references/preview.md). A **review** is a preview of independent findings, such as usability observations, answered one view at a time: see "A review" in the same file.

For multiple requested audiences, create separate documents with the same source identity and render them as an explicit set. Technical and user guides must never link to UAT, including in body content or sources. UAT links to either companion guide open in a new tab so test results remain intact. Match scope to the request; do not generate all three merely because they are available. A preview is a working document for one ticket: render it on its own, never in a set.

## Claude Code integration

This skill's directory is `${CLAUDE_SKILL_DIR}`. Resolve every bundled file from it. Run the renderer from the project, so relative source and output paths land in the project:

```sh
node "${CLAUDE_SKILL_DIR}/scripts/render.mjs" <source.json> <output.html>
node "${CLAUDE_SKILL_DIR}/scripts/render.mjs" --set <set.json> <output-directory>
```

Search and read the implementation with Read, Grep and Glob. Check the exported HTML with a browser tool when the session has one (Claude in Chrome or the desktop app's built-in browser): both themes, narrow-screen reflow, navigation, links, and the relevant controls. If no browser tool can open the file, report that only renderer validation ran.

## Keep work proportional

For substantial independent discovery, a large unfamiliar codebase, or separate requested document drafts, launch the optional subagents in [delegation.md](references/delegation.md) with the Agent tool when they are installed. Start every ready task in one message, and hold a task until the packet, outline, or draft it needs exists. Use subagent types `documancer-map`, `documancer-analyze`, `documancer-write`, and `documancer-review` only for the cases that file describes. A small edit stays in this agent. Do not also run the built-in Explore agent over the same scope, and do not send rendering or file copying to a subagent.

## Create the document

Include structured `diagram` blocks when they clarify code relationships, process branches, sequence or state changes better than prose alone. Use verified behavior, label simplifications, and supply a caption and a useful text description. Follow the diagram contract in `data-contract.md`; the bundled renderer generates theme-aware SVG directly in the HTML without external assets or diagram scripts. Keep diagrams focused; use prose or multiple diagrams for dense systems, and a table for many-to-many relationships such as project references. Leave out node `row` and `column` so the renderer lays the diagram out, and set `direction` to `right` for a long chain; place nodes by hand only when the reading order matters more than short arrows, and then follow the layout rules in `data-contract.md`. Keep to about 12 nodes and 5 edges per node, and connect every node. When a diagram warns about crossings, size or density, split it by the rules in `data-contract.md` ("Splitting a diagram"): cut by consumer, layer, path or subsystem, make sure every edge still appears in some part, name each part's slice in its caption, and use a table when no split works. Never leave real edges out to make a diagram fit. Treat every diagram warning from `render.mjs` or `--check` as something to fix, or say why it is acceptable. In the final HTML, check labels, arrows and contrast in both themes and at narrow widths. Horizontal scrolling is acceptable and should preserve readable labels; verify that the diagram scrolls without widening the page. Also check click-to-expand, the full-window view, keyboard scrolling, Close diagram and Escape returning focus to the opener.

1. Use the requested outcome, existing repository guidance, relevant implementation, actual interface labels and available evidence. Record the tested/documented version and distinguish verified behavior, uncertainty and illustrative material. Do not invent product behavior, accounts, credentials, fixtures or verification results.
2. Read [the data contract](references/data-contract.md). Author JSON using the applicable example in `examples/` as a structural guide, replacing its illustrative content. Keep editable JSON next to the output in the project's existing documentation location. Use plain text blocks; the renderer escapes them. Do not insert raw HTML or modify the renderer to accommodate ordinary content. Two things come from files beside the source JSON instead: an `image` block embeds a local screenshot, and a preview screen embeds one prototype HTML file in a sandboxed frame. Never put HTML in a JSON string. Check a source without rendering it with `node <skill-directory>/scripts/render.mjs --check <source.json>`.
3. For companion guides, list only the documents being delivered in a set manifest (see `examples/set.json`) and render with the `--set` command above. Navigation is derived from that set, not from files left over in the output folder. Regenerate the intended subset before distribution; do not remove a linked guide after export. For a standalone document, use the single-document command. The renderer rejects invalid JSON with the path of the offending field: fix the source and render again until it passes. Node.js 20+ is required; no npm install, server, build framework or network resources are needed.
4. Open the resulting file and verify both themes, narrow-screen reflow, navigation, links and relevant controls. For UAT, exercise notes before selection, result changes and Generate summary, including denied clipboard access when practical. For a preview, exercise the option switch and Choose this option, the jump links, Expand and Escape, a response without its required note, Yes to all remaining, and each of the three decision actions; check print too. Report real checks and limitations; successful rendering is not browser verification or human acceptance.

The shared renderer embeds styles, scripts, Source Sans 3, its license and the configured wordmark. Set `brand.name` to the actual document publisher; the bundled Flynn wordmark is the default only for Flynn Technology LLC. Another publisher gets a text identity unless explicitly configured otherwise. Preserve brand truth; never attribute another project's work to Flynn merely because the template came from Flynn.

The reader retains a saved appearance choice when browser storage permits. UAT results and notes are **not saved on reload**; keep this visible in the document. Generate summary creates current plain-text results and copies them in the same action. Never add a separate copy-summary button. Nothing is ever submitted without an explicit click: a preview sends its response only when the host that rendered it supplied a destination and the reader chooses Approve, Send back or Reject ticket; otherwise the same click writes a summary to copy. Preview responses are **not saved on reload** either.

Return the HTML link, editable source link and concise readiness or verification limitations. Generating documentation does not authorize publication or replacement of another project's skills.
