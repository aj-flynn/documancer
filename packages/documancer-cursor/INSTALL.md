# Install in Cursor

Requires Node.js 20+ and an existing project. From this extracted package:

```sh
node install.mjs /path/to/project --check
node install.mjs /path/to/project
```

Add `--agents` for four optional native profiles. To add them later:

```sh
node scripts/install-agents.mjs /path/to/project
```

The skill goes in `.cursor/skills/documancer/`; profiles go in `.cursor/agents/`. No global defaults are changed. `--check` checks conflicts without writing. Existing skills, legacy forest-documentation installations and customized profiles require review; the installer never silently replaces them. Matching profiles may be reused.

For manual installation, copy this entire package into `.cursor/skills/documancer/`. Keep the directory name `documancer`. Copy optional profiles from `subagents/` into the agent directory. Start a fresh session.

To upgrade an older install, run the new package's installer with `--upgrade` (add `--agents` if you installed the profiles, and `--check` first to see the plan):

```sh
node install.mjs /path/to/project --upgrade --agents
```

It moves the installed skill to `.cursor/documancer-backups/documancer-<old version>-<time>/`, which no editor reads as a skill, then installs this version. A profile the old version installed is replaced; one you edited stops the upgrade before anything moves, so merge it by hand first. It refuses a newer install, another edition, and a folder that is not Documancer. A copy installed in your home folder upgrades the same way with your home folder as the project root. Authored JSON needs no change unless the changelog says the schema version rose; render it again to pick up the new reader. Delete the backup once you have compared any customizations. To uninstall, remove only the installed `documancer` folder and optional `documancer-*` profiles. Keep authored JSON and HTML in your project documentation folder.

Use one edition per project: other editors also discover `.agents/skills`, so same-name copies may be ambiguous. See the standalone repository README for native editions and shared-editor use.
