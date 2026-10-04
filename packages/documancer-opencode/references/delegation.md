# Selective delegation in OpenCode

The four optional Markdown subagents are packaged in `subagents/`. Install them in the destination project's `.opencode/agents/` with `node scripts/install-agents.mjs <project-root>` or use `install.mjs <project-root> --agents` from the extracted ZIP. The skill and renderer work without them.

| Agent | Use |
| --- | --- |
| `documancer-map` | Gather verified implementation facts for one bounded subsystem. |
| `documancer-analyze` | Resolve difficult cross-module behavior, conflicting contracts, or UAT journeys. |
| `documancer-write` | Draft one JSON document from a verified evidence packet and agreed outline. |
| `documancer-review` | Check one substantial draft against its evidence for unsupported claims and acceptance errors. |

The profiles omit a model because OpenCode model IDs depend on the user's configured provider. OpenCode subagents without a model use the invoking primary agent's model. This package therefore makes no cost or reasoning-effort guarantee. A project owner can add supported `provider/model-id` values and provider-specific options to the installed Markdown frontmatter after checking their own OpenCode setup.

Use the smallest useful workflow. A small correction stays with the primary agent. For an unknown feature, map only the relevant subsystem. Resolve material ambiguity before writing. For several requested documents, discover facts once and give each writer a shared evidence packet and an exclusive JSON output path. Add one bounded review when consequential claims or acceptance criteria need an independent check. Do not assign deterministic rendering, validation or file copying to an LLM agent.

Begin with at most two simultaneously active documentation subagents. Partition by meaningful subsystem or source boundary. Subagents must not delegate again. The primary agent owns scope, evidence integration, final JSON and HTML output, and verification. If the OpenCode Task tool or installed profiles are unavailable, complete the bounded work in the primary agent and report the limitation. Do not claim an unavailable profile ran.

Provide each subagent a brief with the request, project rules, assigned boundary, source identity, relevant evidence paths and expected output. Discovery packets should state verified facts with file/line or symbol references, actual UI labels and setup, meaningful failures, and narrow unresolved questions. Static inspection is not proof of a running application. Writers use verified packets and mode references; they do not rediscover the repository. The primary agent renders the intended set once and performs proportionate browser checks on the final HTML.

OpenCode discovers subagents from `.opencode/agents/<name>.md`; the filename is the agent name. A primary agent may invoke them via its Task tool or the user may mention one with `@documancer-map`, subject to permissions. The profiles deny nested `task` calls; read-only roles also deny edits and shell commands. These permissions are OpenCode configuration, not an independent filesystem sandbox. Review project and provider permissions before using them with sensitive data.

Source: [OpenCode agent documentation](https://opencode.ai/docs/agents).
