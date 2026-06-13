import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderReport } from '../lib/report.js';

test('рендерит ключевые секции', () => {
  const items = [{ category: 'skill', name: 'x', estTokens: 10 }];
  const result = {
    toDisable: [{ category: 'skill', name: 'x', estTokens: 10, auto: true, reason: 'ни разу не использован' }],
    wrongDirection: [],
    manualReview: [],
    keep: [],
  };
  const out = renderReport(result, items);
  assert.match(out, /Стартовая плата/);
  assert.match(out, /Рекомендую отключить/);
  assert.match(out, /skill\/x/);
});

test('пустой toDisable -> дружелюбная строка', () => {
  const out = renderReport({ toDisable: [], wrongDirection: [], manualReview: [], keep: [] }, []);
  assert.match(out, /нечего/);
});
