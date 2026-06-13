import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { scanSkills, scanAgents, scanMcp, scanPlugins, scanClaudeMd, scanHooks, scanInventory } from '../lib/scan.js';

function tmpRoot() { return fs.mkdtempSync(path.join(os.tmpdir(), 'cc-scan-')); }
function writeSkill(base, name, desc) {
  const d = path.join(base, name);
  fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(d, 'SKILL.md'), `---\nname: ${name}\ndescription: ${desc}\n---\nbody`);
}
function writeAgent(base, name, desc) {
  fs.mkdirSync(base, { recursive: true });
  fs.writeFileSync(path.join(base, name + '.md'), `---\nname: ${name}\ndescription: ${desc}\n---\nbody`);
}

test('scanSkills: активные и отключённые', () => {
  const root = tmpRoot();
  const config = { skillsDir: path.join(root, 'skills'), skillsDisabledDir: path.join(root, 'skills-disabled') };
  writeSkill(config.skillsDir, 'alpha', 'Alpha does things');
  writeSkill(config.skillsDisabledDir, 'beta', 'Beta is off');
  const items = scanSkills(config);
  const byName = Object.fromEntries(items.map(i => [i.name, i]));
  assert.equal(byName.alpha.status, 'active');
  assert.equal(byName.alpha.category, 'skill');
  assert.equal(byName.beta.status, 'disabled');
  assert.ok(byName.alpha.descText.includes('Alpha does things'));
});

test('scanAgents: активные и отключённые', () => {
  const root = tmpRoot();
  const config = { agentsDir: path.join(root, 'agents'), agentsDisabledDir: path.join(root, 'agents-disabled') };
  writeAgent(config.agentsDir, 'arhitektor', 'Designs stuff');
  const items = scanAgents(config);
  assert.equal(items.length, 1);
  assert.equal(items[0].category, 'agent');
  assert.equal(items[0].status, 'active');
  assert.equal(items[0].name, 'arhitektor');
});

test('scanMcp: глобальные активные + отключённые из mcp-disabled', () => {
  const root = tmpRoot();
  const claudeJsonPath = path.join(root, '.claude.json');
  fs.writeFileSync(claudeJsonPath, JSON.stringify({ mcpServers: { pencil: { command: 'x' } }, projects: {} }));
  const mcpDisabledDir = path.join(root, 'mcp-disabled');
  fs.mkdirSync(mcpDisabledDir, { recursive: true });
  fs.writeFileSync(path.join(mcpDisabledDir, 'heygen.json'), '{}');
  fs.writeFileSync(path.join(mcpDisabledDir, 'claude.json.bak'), '{}'); // должен игнорироваться
  const items = scanMcp({ claudeJsonPath, mcpDisabledDir });
  const byName = Object.fromEntries(items.map(i => [i.name, i]));
  assert.equal(byName.pencil.status, 'active');
  assert.equal(byName.heygen.status, 'disabled');
  assert.equal(byName['claude.json'], undefined);
});

test('scanPlugins: из enabledPlugins', () => {
  const root = tmpRoot();
  const settingsPath = path.join(root, 'settings.json');
  fs.writeFileSync(settingsPath, JSON.stringify({ enabledPlugins: { 'a@m': true, 'b@m': false } }));
  const items = scanPlugins({ settingsPath });
  const byName = Object.fromEntries(items.map(i => [i.name, i]));
  assert.equal(byName['a@m'].status, 'active');
  assert.equal(byName['b@m'].status, 'disabled');
});

test('scanClaudeMd: глобальный CLAUDE.md', () => {
  const root = tmpRoot();
  const claudeDir = path.join(root, '.claude');
  fs.mkdirSync(claudeDir, { recursive: true });
  fs.writeFileSync(path.join(claudeDir, 'CLAUDE.md'), 'правила проекта');
  const claudeJsonPath = path.join(root, '.claude.json');
  fs.writeFileSync(claudeJsonPath, JSON.stringify({ projects: {} }));
  const items = scanClaudeMd({ claudeDir, claudeJsonPath });
  assert.equal(items.length, 1);
  assert.equal(items[0].category, 'claudemd');
  assert.ok(items[0].descText.includes('правила проекта'));
});

test('scanHooks: по ключам hooks из settings.json', () => {
  const root = tmpRoot();
  const settingsPath = path.join(root, 'settings.json');
  fs.writeFileSync(settingsPath, JSON.stringify({ hooks: { Stop: [{ hooks: [] }], UserPromptSubmit: [{ hooks: [] }] } }));
  const items = scanHooks({ settingsPath });
  const names = items.map(i => i.name).sort();
  assert.deepEqual(names, ['Stop', 'UserPromptSubmit']);
  assert.equal(items[0].category, 'hook');
});

test('scanInventory: объединяет категории без падения на пустых путях', () => {
  const root = tmpRoot();
  const items = scanInventory({
    skillsDir: path.join(root, 'nope-skills'),
    claudeDir: path.join(root, '.claude'),
    claudeJsonPath: path.join(root, 'missing.json'),
    settingsPath: path.join(root, 'missing-settings.json'),
  });
  assert.ok(Array.isArray(items));
});

test('scanInventory: на заполненных фикстурах возвращает все категории', () => {
  const root = tmpRoot();
  const skillsDir = path.join(root, 'skills');
  writeSkill(skillsDir, 'alpha', 'Alpha');
  const agentsDir = path.join(root, 'agents');
  writeAgent(agentsDir, 'ag', 'Agent');
  const claudeDir = path.join(root, '.claude');
  fs.mkdirSync(claudeDir, { recursive: true });
  fs.writeFileSync(path.join(claudeDir, 'CLAUDE.md'), 'rules');
  const claudeJsonPath = path.join(root, '.claude.json');
  fs.writeFileSync(claudeJsonPath, JSON.stringify({ mcpServers: { pencil: {} }, projects: {} }));
  const settingsPath = path.join(root, 'settings.json');
  fs.writeFileSync(settingsPath, JSON.stringify({ enabledPlugins: { 'p@m': true }, hooks: { Stop: [{}] } }));
  const items = scanInventory({ skillsDir, agentsDir, claudeDir, claudeJsonPath, settingsPath });
  const cats = new Set(items.map(i => i.category));
  for (const c of ['skill', 'agent', 'mcp', 'plugin', 'claudemd', 'hook']) assert.ok(cats.has(c), `missing category ${c}`);
});

test('scanPlugins приписывает активному плагину вес скилов из кеша', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-plug-'));
  const settingsPath = path.join(dir, 'settings.json');
  fs.writeFileSync(settingsPath, JSON.stringify({
    enabledPlugins: { 'demo@mkt': true, 'off@mkt': false },
  }));
  const cache = path.join(dir, 'cache');
  const mkSkill = (root, sub, name, desc) => {
    const d = path.join(root, 'skills', sub);
    fs.mkdirSync(d, { recursive: true });
    fs.writeFileSync(path.join(d, 'SKILL.md'), `---\nname: ${name}\ndescription: ${desc}\n---\nbody`);
  };
  mkSkill(path.join(cache, 'mkt', 'demo', '1.0.0'), 'alpha', 'alpha', 'Alpha does things');
  mkSkill(path.join(cache, 'mkt', 'demo', '1.0.0'), 'beta', 'beta', 'Beta does things');
  mkSkill(path.join(cache, 'mkt', 'off', '1.0.0'), 'gamma', 'gamma', 'Gamma does things');

  const items = scanPlugins({ settingsPath, pluginsCacheDir: cache });
  const demo = items.find((i) => i.name === 'demo@mkt');
  const off = items.find((i) => i.name === 'off@mkt');
  assert.ok(demo.descText.includes('Alpha does things'));
  assert.ok(demo.descText.includes('Beta does things'));
  assert.equal(off.descText, '');
});

test('scanPlugins дедуплицирует скилы между версиями кеша', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-plug2-'));
  const settingsPath = path.join(dir, 'settings.json');
  fs.writeFileSync(settingsPath, JSON.stringify({ enabledPlugins: { 'demo@mkt': true } }));
  const cache = path.join(dir, 'cache');
  const mkSkill = (root, sub, name, desc) => {
    const d = path.join(root, 'skills', sub);
    fs.mkdirSync(d, { recursive: true });
    fs.writeFileSync(path.join(d, 'SKILL.md'), `---\nname: ${name}\ndescription: ${desc}\n---\nbody`);
  };
  mkSkill(path.join(cache, 'mkt', 'demo', 'aaa'), 'alpha', 'alpha', 'Alpha unique text');
  mkSkill(path.join(cache, 'mkt', 'demo', '2.0.0'), 'alpha', 'alpha', 'Alpha unique text');
  const items = scanPlugins({ settingsPath, pluginsCacheDir: cache });
  const demo = items.find((i) => i.name === 'demo@mkt');
  const occurrences = demo.descText.split('Alpha unique text').length - 1;
  assert.equal(occurrences, 1);
});

test('scanPlugins не падает, если кеша плагина нет', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-plug3-'));
  const settingsPath = path.join(dir, 'settings.json');
  fs.writeFileSync(settingsPath, JSON.stringify({ enabledPlugins: { 'ghost@mkt': true } }));
  const items = scanPlugins({ settingsPath, pluginsCacheDir: path.join(dir, 'nope') });
  const ghost = items.find((i) => i.name === 'ghost@mkt');
  assert.equal(ghost.descText, '');
});
