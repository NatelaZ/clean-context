import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { applyDisable } from '../lib/apply.js';
import { restoreAll } from '../lib/restore.js';

function setup() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-apply-'));
  const config = {
    skillsDir: path.join(root, 'skills'),
    skillsDisabledDir: path.join(root, 'skills-disabled'),
    agentsDir: path.join(root, 'agents'),
    agentsDisabledDir: path.join(root, 'agents-disabled'),
    settingsPath: path.join(root, 'settings.json'),
  };
  fs.mkdirSync(path.join(config.skillsDir, 'alpha'), { recursive: true });
  fs.writeFileSync(path.join(config.skillsDir, 'alpha', 'SKILL.md'), 'x');
  fs.writeFileSync(config.settingsPath, JSON.stringify({ enabledPlugins: { 'p@m': true } }, null, 2));
  return { root, config, log: path.join(root, 'ops.jsonl') };
}

test('переносит скил в disabled и откатывает обратно', () => {
  const { config, log } = setup();
  const sel = [{ category: 'skill', name: 'alpha', path: path.join(config.skillsDir, 'alpha') }];
  applyDisable(sel, config, log);
  assert.ok(!fs.existsSync(path.join(config.skillsDir, 'alpha')));
  assert.ok(fs.existsSync(path.join(config.skillsDisabledDir, 'alpha')));
  restoreAll(log, config);
  assert.ok(fs.existsSync(path.join(config.skillsDir, 'alpha')));
  assert.ok(!fs.existsSync(path.join(config.skillsDisabledDir, 'alpha')));
});

test('переключает плагин в false и откатывает', () => {
  const { config, log } = setup();
  applyDisable([{ category: 'plugin', name: 'p@m', path: config.settingsPath }], config, log);
  let s = JSON.parse(fs.readFileSync(config.settingsPath, 'utf8'));
  assert.equal(s.enabledPlugins['p@m'], false);
  restoreAll(log, config);
  s = JSON.parse(fs.readFileSync(config.settingsPath, 'utf8'));
  assert.equal(s.enabledPlugins['p@m'], true);
});

test('лог очищается после restoreAll', () => {
  const { config, log } = setup();
  applyDisable([{ category: 'skill', name: 'alpha', path: path.join(config.skillsDir, 'alpha') }], config, log);
  restoreAll(log, config);
  assert.equal(fs.readFileSync(log, 'utf8').trim(), '');
});
