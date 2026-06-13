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
