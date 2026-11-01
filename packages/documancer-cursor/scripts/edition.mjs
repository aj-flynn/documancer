// Folder layout and agent profile format for the Cursor edition.
import { hasFrontmatter } from './installer.mjs';

export const edition = {
  label: 'Cursor',
  skillParent: '.cursor',
  agentParent: '.cursor',
  agentExtension: 'md',
  extraEntries: [],
  isValidProfile: (text, name) => hasFrontmatter(text) && text.includes(`name: ${name}`),
};
