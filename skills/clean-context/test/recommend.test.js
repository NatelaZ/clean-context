import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recommend } from '../lib/recommend.js';

const skill = (o) => ({ category: 'skill', status: 'active', estTokens: 10, usageCount: 5, daysSinceUse: 1, name: 'x', ...o });

test('помечает ни разу не использованный активный скил', () => {
  const r = recommend([skill({ usageCount: 0, daysSinceUse: null })]);
  assert.equal(r.toDisable.length, 1);
  assert.equal(r.toDisable[0].auto, true);
  assert.match(r.toDisable[0].reason, /ни разу/);
});
test('помечает устаревший скил (> staleDays)', () => {
  const r = recommend([skill({ usageCount: 2, daysSinceUse: 40 })], { staleDays: 30 });
  assert.equal(r.toDisable.length, 1);
});
test('оставляет свежий скил', () => {
  const r = recommend([skill({ usageCount: 2, daysSinceUse: 3 })]);
  assert.equal(r.toDisable.length, 0);
  assert.equal(r.keep.length, 1);
});
test('скил без статистики не трогаем', () => {
  const r = recommend([skill({ usageCount: null, daysSinceUse: null })]);
  assert.equal(r.toDisable.length, 0);
  assert.equal(r.keep.length, 1);
});
test('wrong-direction: выключен, но активно использован', () => {
  const r = recommend([skill({ status: 'disabled', usageCount: 880, daysSinceUse: 1 })]);
  assert.equal(r.wrongDirection.length, 1);
});
test('агент идёт в manualReview, не в toDisable', () => {
  const r = recommend([{ category: 'agent', status: 'active', name: 'a', estTokens: 50, usageCount: null, daysSinceUse: null }]);
  assert.equal(r.toDisable.length, 0);
  assert.equal(r.manualReview.length, 1);
});
test('toDisable отсортирован по estTokens по убыванию', () => {
  const r = recommend([
    skill({ name: 'a', usageCount: 0, daysSinceUse: null, estTokens: 5 }),
    skill({ name: 'b', usageCount: 0, daysSinceUse: null, estTokens: 50 }),
  ]);
  assert.equal(r.toDisable[0].name, 'b');
});

test('агент с данными: не использован -> toDisable как «спрос» (auto=false)', () => {
  const r = recommend([{ category: 'agent', status: 'active', name: 'kb-ingest', estTokens: 90, usageCount: 0, daysSinceUse: null }]);
  assert.equal(r.toDisable.length, 1);
  assert.equal(r.toDisable[0].auto, false);
});
test('агент с данными: используется -> keep', () => {
  const r = recommend([{ category: 'agent', status: 'active', name: 'arhitektor', estTokens: 180, usageCount: 3, daysSinceUse: 2 }]);
  assert.equal(r.toDisable.length, 0);
  assert.equal(r.keep.length, 1);
});
test('агент без данных (usageCount null) -> manualReview', () => {
  const r = recommend([{ category: 'agent', status: 'active', name: 'x', estTokens: 50, usageCount: null, daysSinceUse: null }]);
  assert.equal(r.manualReview.length, 1);
  assert.equal(r.toDisable.length, 0);
});
test('агент с данными: устарел (daysSinceUse > staleDays) -> toDisable auto=false', () => {
  const r = recommend(
    [{ category: 'agent', status: 'active', name: 'a', estTokens: 50, usageCount: 2, daysSinceUse: 35 }],
    { staleDays: 30 },
  );
  assert.equal(r.toDisable.length, 1);
  assert.equal(r.toDisable[0].auto, false);
});
