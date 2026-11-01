// Folder layout and agent profile format for the Claude Code edition.
import { hasFrontmatter } from './installer.mjs';

export const edition = {
  label: 'Claude Code',
  skillParent: '.claude',
  agentParent: '.claude',
  agentExtension: 'md',
  extraEntries: [],
  isValidProfile: (text, name) => hasFrontmatter(text) && text.includes(`name: ${name}`),
};
