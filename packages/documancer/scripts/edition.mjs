// Folder layout and agent profile format for the Codex edition.
export const edition = {
  label: 'Codex',
  skillParent: '.agents',
  agentParent: '.codex',
  agentExtension: 'toml',
  extraEntries: ['agents'],
  isValidProfile: (text, name) => text.includes(`name = "${name}"`),
};
