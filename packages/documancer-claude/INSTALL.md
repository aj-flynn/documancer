# Install in Claude Code

Requires Node.js 20+ and an existing project. From this extracted package:

```sh
node install.mjs /path/to/project --check
node install.mjs /path/to/project
```

Add `--agents` for four optional subagent profiles. To add them later:

```sh
node scripts/install-agents.mjs /path/to/project
```

The skill goes in `.claude/skills/documancer/`; profiles go in `.claude/agents/`. No global defaults or `settings.json` are changed. `--check` checks conflicts without writing. Existing skills and customized profiles require review; the installer never silently replaces them. Matching profiles may be reused.

For manual installation, copy this entire package into `.claude/skills/documancer/`, keeping the directory name `documancer`. Copy optional profiles from `subagents/` into `.claude/agents/`. Start a fresh session (Claude Code also picks up new profiles automatically unless `.claude/agents/` did not exist when the session began).

To make Documancer available in every project, copy the package into `~/.claude/skills/documancer/` (and profiles into `~/.claude/agents/`) yourself. The installer is project-local on purpose.

For upgrades, back up the installed skill outside skill discovery directories, compare and preserve customizations, remove the old installed folder after review, then reinstall. Merge customized profiles explicitly. To uninstall, remove only the installed `documancer` folder and optional `documancer-*` profiles. Keep authored JSON and HTML in your project documentation folder.
