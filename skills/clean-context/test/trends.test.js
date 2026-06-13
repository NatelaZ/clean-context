import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildSnapshot, shouldAppend, diffSnapshots, renderTrends, recordSnapshot, loadHistory } from '../lib/trends.js';

const DAY = 86_400_000;
const NOW = 1781346971761;

test('buildSnapshot: total, byCategory, items map', () => {
  const s = buildSnapshot([
    { category: 'skill', name: 'a', estTokens: 10 },
    { category: 'skill', name: 'b', estTokens: 5 },
    { category: 'agent', name: 'c', estTokens: 20 },
  ], NOW);
  assert.equal(s.total, 35);
  assert.equal(s.byCategory.skill, 15);
  assert.equal(s.items['agent/c'], 20);
  assert.equal(s.at, NOW);
});

test('shouldAppend: пустая история -> true', () => {
  assert.equal(shouldAppend([], buildSnapshot([], NOW)), true);
});
test('shouldAppend: тот же снимок в окне -> false', () => {
  const snap = buildSnapshot([{ category: 'skill', name: 'a', estTokens: 10 }], NOW);
  assert.equal(shouldAppend([snap], buildSnapshot([{ category: 'skill', name: 'a', estTokens: 10 }], NOW + 1000)), false);
});
test('shouldAppend: изменился total -> true', () => {
  const old = buildSnapshot([{ category: 'skill', name: 'a', estTokens: 10 }], NOW);
  assert.equal(shouldAppend([old], buildSnapshot([{ category: 'skill', name: 'a', estTokens: 20 }], NOW + 1000)), true);
});
test('shouldAppend: прошло > суток -> true', () => {
  const old = buildSnapshot([{ category: 'skill', name: 'a', estTokens: 10 }], NOW);
  assert.equal(shouldAppend([old], buildSnapshot([{ category: 'skill', name: 'a', estTokens: 10 }], NOW + DAY + 1)), true);
});

test('diffSnapshots: added/removed/changed/totalDelta', () => {
  const a = buildSnapshot([{ category: 'skill', name: 'keep', estTokens: 10 }, { category: 'skill', name: 'gone', estTokens: 5 }], NOW);
  const b = buildSnapshot([{ category: 'skill', name: 'keep', estTokens: 12 }, { category: 'agent', name: 'new', estTokens: 30 }], NOW + DAY);
  const d = diffSnapshots(a, b);
  assert.equal(d.totalDelta, (12 + 30) - (10 + 5));
  assert.deepEqual(d.added.map((x) => x.key), ['agent/new']);
  assert.deepEqual(d.removed.map((x) => x.key), ['skill/gone']);
  assert.deepEqual(d.changed.map((x) => x.key), ['skill/keep']);
});

test('renderTrends: пустая история', () => {
  assert.match(renderTrends([]), /История пуста/);
});
test('renderTrends: содержит дельту и изменения', () => {
  const a = buildSnapshot([{ category: 'skill', name: 'x', estTokens: 100 }], NOW);
  const b = buildSnapshot([{ category: 'skill', name: 'x', estTokens: 100 }, { category: 'skill', name: 'y', estTokens: 50 }], NOW + DAY);
  const out = renderTrends([a, b]);
  assert.match(out, /Тренды/);
  assert.match(out, /Добавилось/);
  assert.match(out, /skill\/y/);
  assert.match(out, /\+50/);
});

test('recordSnapshot: пишет первый, пропускает идентичный, пишет изменённый', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-tr-'));
  const hp = path.join(dir, 'history.jsonl');
  assert.equal(recordSnapshot(hp, [{ category: 'skill', name: 'a', estTokens: 10 }], NOW), true);
  assert.equal(recordSnapshot(hp, [{ category: 'skill', name: 'a', estTokens: 10 }], NOW + 1000), false);
  assert.equal(recordSnapshot(hp, [{ category: 'skill', name: 'a', estTokens: 20 }], NOW + 2000), true);
  assert.equal(loadHistory(hp).length, 2);
});
