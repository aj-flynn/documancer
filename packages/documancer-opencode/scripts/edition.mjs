// Folder layout and agent profile format for the OpenCode edition.
import { hasFrontmatter } from './installer.mjs';

export const edition = {
  label: 'OpenCode',
  skillParent: '.opencode',
  agentParent: '.opencode',
  agentExtension: 'md',
  extraEntries: [],
  isValidProfile: (text, name) => hasFrontmatter(text) && text.includes('mode: subagent'),
};
