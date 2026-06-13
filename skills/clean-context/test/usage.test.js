import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { addUsage, loadUsage } from '../lib/usage.js';

const NOW = 1781346971761;
const DAY = 86400000;

test('джойнит usage скила по точному имени', () => {
  const usage = { skillUsage: { foo: { usageCount: 3, lastUsedAt: NOW - 5 * DAY } }, pluginUsage: {} };
  const [it] = addUsage([{ category: 'skill', name: 'foo' }], usage, NOW);
  assert.equal(it.usageCount, 3);
  assert.equal(it.daysSinceUse, 5);
});

test('джойнит plugin-скил по суффиксу name', () => {
  const usage = { skillUsage: { 'superpowers:brainstorming': { usageCount: 75, lastUsedAt: NOW } }, pluginUsage: {} };
  const [it] = addUsage([{ category: 'skill', name: 'brainstorming' }], usage, NOW);
  assert.equal(it.usageCount, 75);
});

test('неизвестный скил -> usageCount null', () => {
  const [it] = addUsage([{ category: 'skill', name: 'zzz' }], { skillUsage: {}, pluginUsage: {} }, NOW);
  assert.equal(it.usageCount, null);
  assert.equal(it.daysSinceUse, null);
});

test('плагин берёт usage из pluginUsage', () => {
  const usage = { skillUsage: {}, pluginUsage: { 'ralph-loop@m': { usageCount: 880, lastUsedAt: NOW } } };
  const [it] = addUsage([{ category: 'plugin', name: 'ralph-loop@m' }], usage, NOW);
  assert.equal(it.usageCount, 880);
});

test('loadUsage: читает skillUsage/pluginUsage', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-usage-'));
  const p = path.join(root, '.claude.json');
  fs.writeFileSync(p, JSON.stringify({ skillUsage: { a: { usageCount: 1 } }, pluginUsage: { 'b@m': { usageCount: 2 } } }));
  const u = loadUsage(p);
  assert.equal(u.skillUsage.a.usageCount, 1);
  assert.equal(u.pluginUsage['b@m'].usageCount, 2);
});
test('loadUsage: отсутствующий файл -> пустые объекты', () => {
  assert.deepEqual(loadUsage('/no/such/file-xyz.json'), { skillUsage: {}, pluginUsage: {} });
});
