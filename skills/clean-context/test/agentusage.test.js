import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tallyAgents, addAgentUsage } from '../lib/agentusage.js';

const DAY = 86_400_000;
const NOW = 1781346971761;

test('tallyAgents: счёт по агентам и lastUsedAt = макс mtime', () => {
  const files = [
    { mtime: NOW - 10 * DAY, text: '..."subagent_type":"arhitektor"...\n..."subagent_type":"strateg"...' },
    { mtime: NOW - 2 * DAY, text: '..."subagent_type":"arhitektor"...' },
  ];
  const t = tallyAgents(files);
  assert.equal(t.arhitektor.usageCount, 2);
  assert.equal(t.arhitektor.lastUsedAt, NOW - 2 * DAY);
  assert.equal(t.strateg.usageCount, 1);
});

test('tallyAgents: нет вызовов -> пустой объект', () => {
  assert.deepEqual(Object.keys(tallyAgents([{ mtime: NOW, text: 'no agents here' }])), []);
});

test('addAgentUsage: найденный агент получает count + daysSinceUse', () => {
  const items = [{ category: 'agent', name: 'arhitektor' }];
  const usage = { arhitektor: { usageCount: 3, lastUsedAt: NOW - 5 * DAY } };
  const [it] = addAgentUsage(items, usage, NOW);
  assert.equal(it.usageCount, 3);
  assert.equal(it.daysSinceUse, 5);
});

test('addAgentUsage: не найденный агент -> usageCount 0, daysSinceUse null', () => {
  const [it] = addAgentUsage([{ category: 'agent', name: 'kb-ingest' }], {}, NOW);
  assert.equal(it.usageCount, 0);
  assert.equal(it.lastUsedAt, null);
  assert.equal(it.daysSinceUse, null);
});

test('addAgentUsage: не-агенты не трогаются', () => {
  const [it] = addAgentUsage([{ category: 'skill', name: 'x', usageCount: 9 }], {}, NOW);
  assert.equal(it.usageCount, 9);
});
