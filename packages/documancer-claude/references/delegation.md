# Selective delegation in Claude Code

The four optional Markdown subagents are packaged in `subagents/`. Install them in the destination project's `.claude/agents/` with `node scripts/install-agents.mjs <project-root>`, or use `install.mjs <project-root> --agents` from the extracted package. The skill and renderer work without them. Claude Code watches that directory, so new profiles are normally picked up within seconds. Restart if `.claude/agents/` did not exist when the session started.

Claude Code lists every file in `.claude/agents/` as a delegation target for the main agent, including in sessions that never load this skill. The descriptions therefore limit each role to a brief assigned by the Documancer parent. They intentionally omit "use proactively."

| Agent | Tools | Use |
| --- | --- | --- |
| `documancer-map` | Read, Glob, Grep | Gather verified implementation facts for one bounded subsystem. |
| `documancer-analyze` | Read, Glob, Grep | Resolve difficult cross-module behavior, conflicting contracts, or UAT journeys. |
| `documancer-write` | Read, Write, Edit, Glob, Grep | Draft one JSON document from a verified evidence packet and agreed outline. |
| `documancer-review` | Read, Glob, Grep | Check one substantial draft against its evidence for unsupported claims and acceptance errors. |

The profiles set `model: inherit`, so each run uses the parent's model. There is no cost or reasoning-effort guarantee. A project owner may set `model` (for example `sonnet`) on an installed copy after weighing quality against cost. Mapping, analysis, and review have no Write, Edit or Bash tools, so they cannot change files or run commands. That also means they cannot run `git` for revision identity; the parent supplies it in the brief. The writer is not path-sandboxed and may edit only its assigned JSON path.

Claude Code allows subagents to spawn subagents by default, but each profile lists an explicit `tools` allowlist without the Agent tool, so none of these roles can delegate further. Do not add Agent to an installed copy. The parent still owns the boundary.

Subagents start from a clean context: they do not see this skill or the parent conversation. Put the brief in the Agent tool prompt: request, project rules, assigned boundary, source identity, relevant evidence paths, and expected output. Include the mode-reference and data-contract paths when the role must read them. A user can also request a role by name, for example "use documancer-map on the billing module."

Use the smallest useful workflow. A small correction stays with the primary agent. For an unknown feature, map only the relevant subsystem. Do not also run the built-in Explore agent on that same scope. `documancer-map` returns a citation packet; Explore returns a general search summary. Resolve material ambiguity before writing. For several requested documents, discover facts once and give each writer a shared evidence packet and an exclusive JSON output path. Add one bounded review when consequential claims or acceptance criteria need an independent check. Keep deterministic rendering, validation, and file copying on the parent. The parent checks the final HTML with an available browser tool.

Start every Documancer task whose inputs are ready in one message so they run concurrently. Hold a task until the packet, outline, or draft it requires exists. Read-only tasks with separate boundaries go together: one `documancer-map` or `documancer-analyze` per requested subsystem, never one per file. Writers go together only when each has its own JSON path, one writer per document. A review starts after its draft exists; reviews of different drafts can run together. Integrate the results before widening the scope. Do not add agents to speed up work inside a single boundary. The primary agent owns scope, evidence integration, final JSON and HTML, and verification. If an installed profile is unavailable, do the bounded work in the primary agent and report that limitation. Do not claim an unavailable profile ran.

Discovery packets state verified facts with file, line, or symbol references, actual UI labels and setup, meaningful failures, and narrow unresolved questions. Static inspection is not proof that the application was run. Writers use the verified packet and mode reference; they do not rediscover the repository. The primary agent renders the intended set once.

Source: [Claude Code subagents](https://code.claude.com/docs/en/sub-agents) and [Claude Code skills](https://code.claude.com/docs/en/skills).
