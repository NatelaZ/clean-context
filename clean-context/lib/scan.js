import fs from 'node:fs';
import path from 'node:path';
import { parseFrontmatter } from './frontmatter.js';

function readSkillDir(dir, status, items) {
  if (!dir || !fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    const skillMd = path.join(dir, name, 'SKILL.md');
    if (!fs.existsSync(skillMd)) continue;
    const fm = parseFrontmatter(fs.readFileSync(skillMd, 'utf8'));
    items.push({
      category: 'skill',
      name: fm.name || name,
      status,
      path: path.join(dir, name),
      descText: [fm.name || name, fm.description || ''].join('\n'),
    });
  }
}

export function scanSkills(config) {
  const items = [];
  readSkillDir(config.skillsDir, 'active', items);
  readSkillDir(config.skillsDisabledDir, 'disabled', items);
  return items;
}

export function scanAgents(config) {
  const items = [];
  for (const [dir, status] of [[config.agentsDir, 'active'], [config.agentsDisabledDir, 'disabled']]) {
    if (!dir || !fs.existsSync(dir)) continue;
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith('.md')) continue;
      const p = path.join(dir, file);
      const fm = parseFrontmatter(fs.readFileSync(p, 'utf8'));
      const name = fm.name || file.replace(/\.md$/, '');
      items.push({ category: 'agent', name, status, path: p, descText: [name, fm.description || ''].join('\n') });
    }
  }
  return items;
}

export function scanMcp(config) {
  const items = [];
  let data = {};
  try { data = JSON.parse(fs.readFileSync(config.claudeJsonPath, 'utf8')); } catch {}
  const addServers = (servers, scope) => {
    for (const [name, cfg] of Object.entries(servers || {})) {
      items.push({ category: 'mcp', name, status: 'active', scope, path: config.claudeJsonPath, descText: JSON.stringify(cfg) });
    }
  };
  addServers(data.mcpServers, 'global');
  for (const [proj, pcfg] of Object.entries(data.projects || {})) addServers(pcfg.mcpServers, proj);
  if (config.mcpDisabledDir && fs.existsSync(config.mcpDisabledDir)) {
    for (const file of fs.readdirSync(config.mcpDisabledDir)) {
      if (!file.endsWith('.json') || file.endsWith('.bak.json') || file.includes('.bak')) continue;
      items.push({ category: 'mcp', name: file.replace(/\.json$/, ''), status: 'disabled', path: path.join(config.mcpDisabledDir, file), descText: '' });
    }
  }
  return items;
}

export function scanPlugins(config) {
  const items = [];
  let settings = {};
  try { settings = JSON.parse(fs.readFileSync(config.settingsPath, 'utf8')); } catch {}
  for (const [name, enabled] of Object.entries(settings.enabledPlugins || {})) {
    items.push({ category: 'plugin', name, status: enabled ? 'active' : 'disabled', path: config.settingsPath, descText: '' });
  }
  return items;
}

export function scanClaudeMd(config) {
  const items = [];
  const candidates = new Set();
  if (config.claudeDir) candidates.add(path.join(config.claudeDir, 'CLAUDE.md'));
  try {
    const data = JSON.parse(fs.readFileSync(config.claudeJsonPath, 'utf8'));
    for (const proj of Object.keys(data.projects || {})) candidates.add(path.join(proj, 'CLAUDE.md'));
  } catch {}
  for (const p of candidates) {
    if (!fs.existsSync(p)) continue;
    items.push({ category: 'claudemd', name: p, status: 'active', path: p, descText: fs.readFileSync(p, 'utf8') });
  }
  return items;
}

export function scanHooks(config) {
  const items = [];
  let settings = {};
  try { settings = JSON.parse(fs.readFileSync(config.settingsPath, 'utf8')); } catch {}
  for (const [event, arr] of Object.entries(settings.hooks || {})) {
    items.push({ category: 'hook', name: event, status: 'active', path: config.settingsPath, descText: JSON.stringify(arr) });
  }
  return items;
}

export function scanInventory(config) {
  return [
    ...scanSkills(config),
    ...scanAgents(config),
    ...scanMcp(config),
    ...scanPlugins(config),
    ...scanClaudeMd(config),
    ...scanHooks(config),
  ];
}
