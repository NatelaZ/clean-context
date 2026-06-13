import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { scanSkills, scanAgents } from '../lib/scan.js';

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
