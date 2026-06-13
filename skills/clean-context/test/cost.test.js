import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addCosts, totalsByCategory } from '../lib/cost.js';

test('addCosts проставляет estTokens', () => {
  const out = addCosts([{ category: 'skill', descText: 'abcd' }]);
  assert.equal(out[0].estTokens, 1);
});
test('totalsByCategory суммирует по категориям', () => {
  const t = totalsByCategory([
    { category: 'skill', estTokens: 5 },
    { category: 'skill', estTokens: 5 },
    { category: 'agent', estTokens: 3 },
  ]);
  assert.equal(t.skill, 10);
  assert.equal(t.agent, 3);
});
test('addCosts с пустыми факторами не меняет поведение', () => {
  const out = addCosts([{ category: 'skill', descText: 'abcd' }], {});
  assert.equal(out[0].estTokens, 1);
});
test('addCosts умножает estTokens на коэффициент категории', () => {
  const out = addCosts([{ category: 'skill', descText: 'abcdefgh' }], { skill: 2 });
  // estimateTokens('abcdefgh') = 2; *2 = 4
  assert.equal(out[0].estTokens, 4);
});
test('addCosts с коэффициентом округляет до целого', () => {
  const out = addCosts([{ category: 'agent', descText: 'abcdefgh' }], { agent: 1.309 });
  // 2 * 1.309 = 2.618 -> 3
  assert.equal(out[0].estTokens, 3);
});
test('addCosts не трогает категорию без коэффициента', () => {
  const out = addCosts([{ category: 'mcp', descText: 'abcd' }], { skill: 2 });
  assert.equal(out[0].estTokens, 1);
});
test('addCosts проставляет estTokensRaw = сырая оценка независимо от коэффициента', () => {
  const out = addCosts([{ category: 'skill', descText: 'abcdefgh' }], { skill: 2 });
  // estimateTokens('abcdefgh') = 2; estTokens = 4 (calibrated), estTokensRaw = 2 (raw)
  assert.equal(out[0].estTokens, 4);
  assert.equal(out[0].estTokensRaw, 2);
});
test('addCosts без коэффициента: estTokensRaw равен estTokens', () => {
  const out = addCosts([{ category: 'skill', descText: 'abcdefgh' }]);
  assert.equal(out[0].estTokens, 2);
  assert.equal(out[0].estTokensRaw, 2);
});
