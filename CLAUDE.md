# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

This repository is the source of the Documancer skill, not a project that uses it. Node.js 20+ only: no npm dependencies, build step, or linter; do not add any.

- `packages/documancer/` is the Codex edition and the canonical source of everything shared. Edit shared files only there, then run `npm run sync`. `scripts/sync-shared.mjs` lists what is shared; `npm test` fails if the copies drift.
- Files not in that list (`SKILL.md`, package docs, `references/delegation.md`, installers, `subagents/`) are per-edition. A change that applies to every editor must be made by hand in every edition.
- A new top-level file or script in an edition must be added to both that edition's `install.mjs` entry list and its `package.json` `files`, or it will not ship.
- `references/data-contract.md` is the document schema. A change to what the renderer accepts needs matching changes there, in `examples/`, and in `render.test.mjs`.
- The sync check compares bytes and `.gitattributes` forces LF, so keep line endings intact when editing on Windows.
- The workspace and all four packages share one version number; bump them together with `packageVersion` in `render.mjs` (a test compares them) and record the change in `CHANGELOG.md`.
- `schemaVersion` in `render.mjs` is the only document schema the renderer accepts. Raise it for a breaking change to the JSON, and update the examples and the upgrade notes at the end of `data-contract.md`.
