# Install in Claude Code

Requires Node.js 20+ and an existing project. From this extracted package:

```sh
node install.mjs /path/to/project --check
node install.mjs /path/to/project
```

Add `--agents` for four optional native profiles. To add them later:

```sh
node scripts/install-agents.mjs /path/to/project
```

The skill goes in `.claude/skills/documancer/`; profiles go in `.claude/agents/`. No global defaults are changed. `--check` checks conflicts without writing. Existing skills and customized profiles require review; the installer never silently replaces them. Matching profiles may be reused.

For manual installation, copy this entire package into `.claude/skills/documancer/`. Keep the directory name `documancer`. Copy optional profiles from `subagents/` into `.claude/agents/`. Start a new Claude Code session.

A personal skill at `~/.claude/skills/documancer/` takes precedence over the project copy of the same name. Remove or rename the personal copy if the project should use its own version. To use Documancer in every project instead, copy this package to `~/.claude/skills/documancer/` yourself; the installer only writes to a project.

For upgrades, back up the installed skill outside skill discovery directories, compare and preserve customizations, remove the old installed folder after review, then reinstall. Merge customized profiles explicitly. To uninstall, remove only the installed `documancer` folder and optional `documancer-*` profiles. Keep authored JSON and HTML in your project documentation folder.

Use one edition per project: Cursor and OpenCode also discover `.claude/skills/`, so same-name copies may be ambiguous. See the standalone repository README for native editions and shared-editor use.
