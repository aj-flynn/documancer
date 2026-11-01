# Documancer for Claude Code

Create technical references, user guides and human UAT plans as editable JSON and self-contained offline HTML. All editions share the Forest dark/cream light design, renderer, examples and mode references.

Requires Node.js 20+. No dependencies or build step are needed.

```sh
node install.mjs /path/to/project --check
node install.mjs /path/to/project --agents
```

Run from this package directory; the target project must exist. Omit `--agents` for the skill alone. Installation creates `.claude/skills/documancer/` and refuses an existing skill or customized agent conflict. Start a fresh Claude Code session afterward. Claude loads the skill when your request matches its description, or you can invoke it directly:

> /documancer Create a user guide for this project, with editable JSON beside the HTML.

Read [INSTALL.md](INSTALL.md), [USAGE.md](USAGE.md), and [SKILL.md](SKILL.md) for installation, authoring and the agent workflow. Optional roles are in [references/delegation.md](references/delegation.md).

Font attribution remains in `assets/OFL.txt` and embedded exports. Set `brand.name` to your actual publisher.
