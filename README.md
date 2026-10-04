# Documancer

Documentation skills for **Codex, OpenCode, and Cursor**. Create editable JSON and polished, self-contained HTML that opens offline. Installation and rendering require **Node.js 20+**; no npm dependencies, server, or frontend build is needed.

| Mode | Output |
| --- | --- |
| Technical reference | Architecture, configuration, contracts, integrations, and operations grounded in implementation evidence. |
| User guide | Task instructions with actual interface labels, prerequisites, and recovery steps. |
| Human UAT | Acceptance journeys with steps, expected outcomes, notes, result controls, and a generated summary. |

All modes share the Forest dark and cream light design, embedded fonts, search, and navigation. UAT starts **Untested**. Results and notes are session-only and **lost on reload**; Generate summary produces and copies the current results, with manual selection if clipboard access fails. Automated evidence is separate from human acceptance.

## Install

Download or clone this repository and run the appropriate command from its root. Replace `/path/to/project` with an **existing** project directory; quote paths with spaces. Commands work in PowerShell, macOS, and Linux shells.

### Codex

```sh
node install.mjs codex /path/to/project
```

Installs `.agents/skills/documancer/`. Start a new Codex session in the target project and ask:

```text
Use $documancer to create a technical reference for this project.
```

Includes Codex UI metadata and optional native TOML agents. Profiles preserve the original explicit choices: `gpt-5.6-terra`/high for mapping and review, `gpt-5.6-sol`/xhigh for analysis, and `gpt-5.6-luna`/medium for drafting from verified facts. Check model availability on the destination host before enabling them. See [Codex delegation](packages/documancer/references/delegation.md).

### OpenCode

```sh
node install.mjs opencode /path/to/project
```

Installs `.opencode/skills/documancer/`. Start a new OpenCode session and ask:

```text
Load the documancer skill and create a user guide for this project.
```

The native `skill` tool loads the instructions. Optional Markdown agents inherit the invoking model, avoiding provider-specific model IDs. Mapping, analysis, and review deny edits and shell commands; all profiles deny nested delegation. See [OpenCode delegation](packages/documancer-opencode/references/delegation.md).

### Cursor

```sh
node install.mjs cursor /path/to/project
```

Installs `.cursor/skills/documancer/`. Open a fresh Agent chat and select or type:

```text
/documancer Create a human UAT plan for the account settings workflow.
```

Uses native Agent Skills rather than an always-on rule. `/documancer` applies to one message; Alt+Enter (Option+Enter on macOS) pins it as a Custom Mode. Optional Markdown subagents are Task-tool profiles with `model: inherit`. Their descriptions limit them to an assigned Documancer brief, so Cursor does not treat them as general-purpose agents. Mapping, analysis, and review use `readonly: true`. See [Cursor delegation](packages/documancer-cursor/references/delegation.md).

### Options and maintenance

For any environment, add `--check` to preview without writing, or `--agents` to install four optional specialists:

```sh
node install.mjs cursor /path/to/project --agents --check
node install.mjs cursor /path/to/project --agents
```

| Environment | Skill destination | Optional agent destination |
| --- | --- | --- |
| Codex | `.agents/skills/documancer/` | `.codex/agents/` |
| OpenCode | `.opencode/skills/documancer/` | `.opencode/agents/` |
| Cursor | `.cursor/skills/documancer/` | `.cursor/agents/` |

Agents are `documancer-map`, `documancer-analyze`, `documancer-write`, and `documancer-review`. Use them selectively for substantial discovery or independent drafts, with at most two concurrent documentation agents. Small edits stay with the parent; deterministic rendering needs no agent. The skill works without custom agents.

To add agents later, use the chosen edition's helper:

```sh
node packages/documancer-cursor/scripts/install-agents.mjs /path/to/project
```

Installers preserve project configuration and refuse existing skill folders, legacy `forest-documentation` installations, and conflicting customized profiles. Matching agent files may be reused. For upgrades, back up the old skill **outside discovery directories**, compare customizations, remove the old copy after review, and reinstall. Merge customized agents explicitly. To uninstall, remove only the installed skill and optional `documancer-*` profiles; keep authored JSON and HTML.

**Multiple editors on one project:** install one edition. All three discover `.agents/skills/`, so a single Codex installation provides the shared authoring workflow. Its Codex agents only run in Codex; other editors can work in the parent. For native agents in another editor, install only that edition's agent profiles and direct the parent to those roles. Avoid multiple same-name skills in native and shared discovery directories.

For manual installation, copy an entire edition package into its skill destination, naming the folder `documancer`. Each package includes its own `install.mjs` and all resources, so it can be transferred independently. Automated installation is project-local; no global settings are changed.

## Use

Tell the agent the audience, mode, feature scope, source material, version, publisher, and output location. Request only the documents needed. Example prompts (invoke the skill using the syntax above):

```text
Create a technical reference for the import pipeline at this revision.
Trace configuration, failure recovery, and data contracts. Save JSON and HTML in docs/imports/.

Create a user guide for account settings using actual interface labels.
Separate verified behavior from anything you could not run.

Create a human UAT plan for onboarding with prerequisites, observable pass
conditions, reset steps, and rehearsal limitations. Do not claim tests have passed.

Update the existing JSON and HTML after the permission changes. Preserve the
document identity and regenerate only the companion documents being delivered.
```

The agent reads the relevant mode reference, gathers evidence, writes JSON, renders HTML, and checks the result where tools permit. The handoff includes HTML, editable JSON, and actual verification limits. Rendering validates structure, not product correctness or human acceptance.

Set `brand.name` to the actual publisher. The Flynn Technology LLC wordmark is only for Flynn documents; other publishers get text branding by default. Replace illustrative example content before delivery.

### Render directly

Try the bundled examples:

```sh
npm run examples
```

Open the HTML files under `dist/examples/` in a browser. Every edition includes the same renderer:

```sh
node packages/documancer/scripts/render.mjs source.json output.html
node packages/documancer/scripts/render.mjs --set set.json output-directory
```

Use the [JSON examples](packages/documancer/examples) and [data contract](packages/documancer/references/data-contract.md). Paths are relative to the invoking working directory; assets resolve from the renderer itself. Keep editable JSON beside the HTML.

Set manifests explicitly list the documents being delivered. Technical and user guides can link to each other but never to UAT. UAT opens companion guides separately to preserve test state. Standalone exports have no companion navigation. Regenerate a smaller set before distribution; deleting a linked HTML file leaves stale navigation.

## Repository maintenance

| Location | Purpose |
| --- | --- |
| `packages/documancer/` | Codex edition and canonical shared renderer, assets, examples, mode references, and renderer tests. |
| `packages/documancer-opencode/` | OpenCode-specific skill, installer, and agent guidance. |
| `packages/documancer-cursor/` | Cursor-specific skill, installer, and agent guidance. |
| `install.mjs` | Cross-platform environment selector. |
| `scripts/` | Shared-resource synchronization and installer integration tests. |

Edit shared resources in `packages/documancer/`, then synchronize. Edit environment-specific entrypoints, delegation references, profiles, installers, and package docs in their respective editions.

```sh
npm run sync
npm run check
npm test
```

No dependency installation is necessary. To build a local transfer archive, use `npm pack ./packages/documancer` (or the OpenCode/Cursor package path), extract it, then run its `install.mjs`. Packages are private; this does not publish them.

Extracted from Flynn Technology's Documancer 1.3.0 and OpenCode 1.1.0 packages on October 4, 2026; maintained here as 1.4.0. The original checkout was retained. Source Sans 3 licensing remains in each edition's `assets/OFL.txt` and generated HTML.

Installation formats checked against official [Codex skills](https://learn.chatgpt.com/docs/build-skills), [Codex subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents), [OpenCode skills](https://opencode.ai/docs/skills/), [OpenCode agents](https://opencode.ai/docs/agents/), [Cursor skills](https://cursor.com/docs/skills), and [Cursor subagents](https://cursor.com/docs/subagents) documentation on October 4, 2026. Agent and model availability depends on the installed client and account.
