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
