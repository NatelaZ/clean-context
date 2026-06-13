import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { scanSkills, scanAgents } from '../lib/scan.js';
import { scanMcp, scanPlugins, scanClaudeMd, scanInventory } from '../lib/scan.js';

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
