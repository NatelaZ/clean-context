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
      if (!file.endsWith('.md') || file.startsWith('.')) continue;
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
      // scope ('global' | <project path>) is an intentional extra field for reporting;
      // downstream stages preserve it via spread and never iterate Item keys.
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

// Собирает name+description всех скилов плагина из кеша, дедуп по имени папки скила
// (в кеше может лежать несколько версий — не задваиваем вес).
function pluginSkillsDescText(cacheDir, marketplace, plugin) {
  if (!cacheDir) return '';
  const pluginDir = path.join(cacheDir, marketplace, plugin);
  let versions = [];
  try { versions = fs.readdirSync(pluginDir, { withFileTypes: true }); } catch { return ''; }
  const bySkill = new Map(); // имя скила -> descText
  for (const v of versions) {
    if (!v.isDirectory()) continue;
    const skillsDir = path.join(pluginDir, v.name, 'skills');
    let skillDirs = [];
    try { skillDirs = fs.readdirSync(skillsDir, { withFileTypes: true }); } catch { continue; }
    for (const s of skillDirs) {
      if (!s.isDirectory() || bySkill.has(s.name)) continue;
      const skillMd = path.join(skillsDir, s.name, 'SKILL.md');
      let raw;
      try { raw = fs.readFileSync(skillMd, 'utf8'); } catch { continue; }
      const fm = parseFrontmatter(raw);
      bySkill.set(s.name, [fm.name || s.name, fm.description || ''].join('\n'));
    }
  }
  return [...bySkill.values()].join('\n');
}

export function scanPlugins(config) {
  const items = [];
  let settings = {};
  try { settings = JSON.parse(fs.readFileSync(config.settingsPath, 'utf8')); } catch {}
  for (const [name, enabled] of Object.entries(settings.enabledPlugins || {})) {
    const status = enabled ? 'active' : 'disabled';
    // Вес — только активным: отключённый плагин не грузится (стартовая плата = 0),
    // и это держит total согласованным с реальным /context.
    let descText = '';
    if (enabled) {
      const at = name.lastIndexOf('@');
      if (at > 0) {
        const plugin = name.slice(0, at);
        const marketplace = name.slice(at + 1);
        descText = pluginSkillsDescText(config.pluginsCacheDir, marketplace, plugin);
      }
    }
    items.push({ category: 'plugin', name, status, path: config.settingsPath, descText });
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
