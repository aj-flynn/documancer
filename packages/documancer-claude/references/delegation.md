# Selective delegation in Claude Code

The four optional Markdown subagents are packaged in `subagents/`. Install them in the destination project's `.claude/agents/` with `node scripts/install-agents.mjs <project-root>` or use `install.mjs <project-root> --agents` from the extracted package. The skill and renderer work without them.

Claude Code offers every file in `.claude/agents/` to all sessions in that project, including sessions that never load this skill. The descriptions therefore limit each role to a brief assigned by the Documancer parent. They intentionally omit "use proactively."

| Agent | Model | Tools | Use |
| --- | --- | --- | --- |
| `documancer-map` | `sonnet` | Read, Grep, Glob | Gather verified implementation facts for one bounded subsystem. |
| `documancer-analyze` | `inherit` | Read, Grep, Glob | Resolve difficult cross-module behavior, conflicting contracts, or UAT journeys. |
| `documancer-write` | `sonnet` | Read, Grep, Glob, Write, Edit | Draft one JSON document from a verified evidence packet and agreed outline. |
| `documancer-review` | `sonnet` | Read, Grep, Glob | Check one substantial draft against its evidence for unsupported claims and acceptance errors. |

## Models

Discovery, drafting from verified facts, and bounded review run on the `sonnet` alias. Analysis inherits the session model, because it handles the questions a cheaper pass would get wrong. Aliases resolve to whatever that tier currently is on the account, so the profiles carry no dated model IDs. These are design choices, not a measured cost guarantee.

A project owner may change `model` on an installed copy to `haiku`, `sonnet`, `opus`, `fable`, a full model ID, or `inherit`, and may add `effort` (`low` to `max`). A `model` passed on the Agent call overrides the profile. The `CLAUDE_CODE_SUBAGENT_MODEL` setting applies only to a profile with no `model` line. If a material contradiction survives one bounded analysis, the parent resolves it or reports the missing information. Never launch repeated blind retries.

## Launch a role

Use the Agent tool with `subagent_type` set to `documancer-map`, `documancer-analyze`, `documancer-write`, or `documancer-review`. A user can also ask for a role by name or mention it as `@agent-documancer-map`.

A subagent starts from a clean context. It loads the project's CLAUDE.md, but it does not see this skill or the parent conversation. Put the whole brief in the Agent prompt: request, project rules, assigned boundary, source identity, relevant evidence paths, and expected output. Give absolute paths to the mode reference and `data-contract.md` when the role must read them. The read-only roles have no shell, so the parent supplies the revision and working-tree state.

## Choose the smallest useful workflow

- A small correction, or a document whose facts are already in context, stays with the parent.
- For an unknown feature, map only the relevant subsystem. Do not also run the built-in Explore agent on that scope: `documancer-map` returns a citation packet, Explore returns a general search summary.
- Resolve material ambiguity with `documancer-analyze` before writing.
- For several requested documents, discover facts once and give each writer the shared evidence packet and an exclusive JSON output path.
- Add one bounded review when consequential claims or acceptance criteria need an independent check.
- Rendering, validation, and file copying are deterministic. Keep them on the parent, along with the browser check of the final HTML.

## Run tasks together

Start every Documancer task whose inputs are ready by sending its Agent calls in one message. Hold a task until the packet, outline, or draft it requires exists.

- Read-only tasks with separate boundaries go together: one `documancer-map` or `documancer-analyze` per requested subsystem, never one per file.
- Writers go together only when each has its own JSON path, one writer per document.
- A review starts after its draft exists; reviews of different drafts can run together.

Each result returns to the parent's context, so ask for compact packets. Integrate the results before widening the scope. Do not add agents to speed up work inside a single boundary.

## Limits

The `tools` list is an enforced allowlist. Mapping, analysis, and review cannot edit files, run commands, load skills, or launch other agents. The writer can additionally create and edit files; it is not path-restricted and may edit only its assigned JSON path. No role has the Agent tool, so none can delegate again.

The parent owns scope, evidence integration, final JSON and HTML, and verification. If the Agent tool or an installed profile is unavailable, do the bounded work in the parent and report that limitation. Do not claim an unavailable profile ran.

Discovery packets state verified facts with file, line, or symbol references, actual UI labels and setup, meaningful failures, and narrow unresolved questions. Static inspection is not proof that the application was run. Writers use the verified packet and mode reference; they do not rediscover the repository. The parent renders the intended set once.

Source: [Claude Code subagents](https://code.claude.com/docs/en/sub-agents) and [Claude Code skills](https://code.claude.com/docs/en/skills).
