# Selective delegation

This skill requests delegation only when it reduces repeated discovery, isolates substantial context, or lets independent work proceed. A small edit or a document whose facts are already in the parent context stays in the parent. Do not run every role as a pipeline. Rendering, schema validation, file copying and summarizing recorded UAT results are deterministic scripts/UI actions, not LLM-agent jobs.

## Defined roles

| Agent | Model | Reasoning | Use |
| --- | --- | --- | --- |
| `documancer-map` | `gpt-5.6-terra` | `high` | Evidence discovery for one relevant subsystem |
| `documancer-analyze` | `gpt-5.6-sol` | `xhigh` | Cross-module contracts, ambiguity, complex state/permission behavior or UAT journey design |
| `documancer-write` | `gpt-5.6-luna` | `medium` | One JSON draft from verified facts and an agreed outline |
| `documancer-review` | `gpt-5.6-terra` | `high` | Bounded accuracy review of a substantial or consequential draft |

The writer does not independently reason through a large codebase. Discovery uses high reasoning; difficult interpretation uses Sol at extra-high. Source ambiguity goes to analysis before writing. If a scope already clearly involves complex permissions, concurrency, migrations or cross-service semantics, route directly to analysis rather than paying for a predictable failed cheaper pass. Repo size alone calls for partitioning, not maximum reasoning on every file.

These are design choices based on the documented roles and host model availability, not a measured dollar-saving guarantee. No automatic max/ultra setting or paid retry loop is configured. Higher reasoning costs more tokens/time. If one bounded analysis leaves a material contradiction, the parent resolves it, explicitly chooses a supported stronger profile, or reports the missing information. Never launch repeated blind retries.

## Choose the smallest useful workflow

- Small correction, existing evidence, one short guide: parent performs it; no subagents.
- Unknown feature in a large repo: map the relevant subsystem, then parent writes or assigns a writer if there is useful independent work to do.
- Several requested document types: discover facts once. Parent freezes a shared evidence packet and outline; writers may draft distinct JSON files from it. Do not have each writer reread the codebase.
- Complex contracts or UAT: analyze the specific hard questions, then write from the resolved outline. Use one independent accuracy review when it materially checks new complex claims or acceptance criteria; a typo fix does not justify a reviewer.

Initially allow at most **two simultaneously active documentation subagents**. This is a skill orchestration limit, not a global Codex setting. Partition by meaningful subsystem or source boundary, not one agent per file. Schedule further bounded partitions only when the requested coverage requires them. Agents do not recursively delegate. The parent retains decisions and integration and does not repeat the same exploration in parallel.

## Context and handoff

Prefer a fresh child context. Supply the request, relevant repository constraints, assigned boundary, absolute skill/reference paths, source identity, known evidence and expected output. If the spawn API exposes history controls, use `fork_turns="none"` with a complete bounded brief instead of copying the whole conversation. Respect the actual tool's schema; do not invent parameters.

Each discovery packet should contain:

1. Scope and code identity, including relevant uncommitted changes.
2. Facts with file/line or symbol references, and what observations support them.
3. UI labels, roles, data/setup and failures relevant to the requested audience.
4. Uncertainties and the next specific question, rather than a raw code dump.

Store packets as task artifacts when reuse across writers is useful. A packet is reusable only for the same relevant source/configuration/data; recheck changed facts without rediscovering unaffected modules. Keep large evidence on disk and pass paths. Do not pad to an arbitrary token budget; the role output limits are prose targets, not hard runtime token caps. The parent must not treat omitted or uncertain details as verified.

For a writer, supply one mode, approved outline and one exclusive JSON path. It never writes HTML, shared assets or set manifests. Parent integrates the requested documents and renders the intended distribution set once. Technical/user guides never link to UAT; UAT companion links open separately. Run deterministic checks and proportional browser verification once on the final artifacts; rerun only what a subsequent correction invalidates.

## Invoke installed roles

The TOML definitions live in `../subagents/` in this package. Install them into the destination project's `.codex/agents/` using `scripts/install-agents.mjs`; placing them beside `agents/openai.yaml` does not register them. That YAML describes the skill's UI, not a subagent.

When the available spawn tool supports selecting a named custom agent, select the role by its exact `name`. Example task brief:

> Use documancer-map for the request-review subsystem only. Determine the entry route, reviewer permissions and allowed completion transitions. Read the supplied repository guidance and evidence paths. Return verified facts, source pointers and unresolved questions; do not edit files or prepare data. Target a compact evidence packet. The parent will inspect the existing guide while you trace the implementation.

If the harness has no named-agent selector but supports explicit model/effort spawning, read the chosen TOML and include its `developer_instructions` in the bounded task prompt, with the exact model and effort supplied separately. Use no history fork when supported. A prompt cannot enforce the TOML sandbox; inherit the host permissions and report this limitation instead of claiming a read-only sandbox was applied. If custom agents or a configured model are unavailable, do the bounded work in the parent and disclose that the planned lower-cost delegation was unavailable; never silently substitute the expensive parent model for a supposed cheaper agent.

Custom agent files pin both model and effort; a named profile's file can override an explicit spawn value. To change an installed role, change both fields deliberately and verify they are supported on that host. Do not assume a request for higher effort overrides its TOML or changes context capacity. This package does not modify account defaults, enable global delegation, or change approval policy.

## Basis and limits

Reviewed September 20, 2026: [OpenAI subagent guidance](https://learn.chatgpt.com/docs/agent-configuration/subagents). It documents standalone TOML definitions under project `.codex/agents/`, named model/effort settings, compact subagent summaries and token overhead. Exact Sol/Terra/Luna IDs and the selected efforts were verified against this host's Codex model catalog; the guidance's general flagship examples do not establish exact pricing or availability on another account. Recheck model availability before adopting on a different host. These instructions do not claim that higher reasoning alone can cover an arbitrarily large repository.
