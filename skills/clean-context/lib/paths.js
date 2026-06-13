import os from 'node:os';
import path from 'node:path';

export function defaultConfig(home = os.homedir()) {
  const claude = path.join(home, '.claude');
  return {
    home,
    claudeDir: claude,
    skillsDir: path.join(claude, 'skills'),
    skillsDisabledDir: path.join(claude, 'skills-disabled'),
    agentsDir: path.join(claude, 'agents'),
    agentsDisabledDir: path.join(claude, 'agents-disabled'),
    mcpDisabledDir: path.join(claude, 'mcp-disabled'),
    settingsPath: path.join(claude, 'settings.json'),
    claudeJsonPath: path.join(home, '.claude.json'),
    projectsDir: path.join(claude, 'projects'),
    pluginsCacheDir: path.join(claude, 'plugins', 'cache'),
    staleDays: 30,
  };
}
