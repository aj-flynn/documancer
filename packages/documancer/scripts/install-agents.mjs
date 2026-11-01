// Installs only the namespaced agent profiles. No project or global configuration is modified.
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { AGENT_NAMES, installAgents as install } from './installer.mjs';
import { edition } from './edition.mjs';

export const agentNames = AGENT_NAMES;
export const installAgents = (projectRoot, options) => install(edition, projectRoot, options);

async function main(args) {
  const check = args[0] === '--check';
  if (check) args.shift();
  if (args.length !== 1 || args[0].startsWith('--')) {
    throw new Error('Usage: node install-agents.mjs [--check] <existing-project-root>');
  }
  console.log(JSON.stringify(await installAgents(args[0], { check }), null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
