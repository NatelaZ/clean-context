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

test('рендерит секции wrongDirection и manualReview когда непусты', () => {
  const result = {
    toDisable: [],
    wrongDirection: [{ category: 'plugin', name: 'ralph', reason: 'выключен, но использован 880 раз' }],
    manualReview: [{ category: 'agent', name: 'arhitektor', estTokens: 50 }],
    keep: [],
  };
  const out = renderReport(result, []);
  assert.match(out, /Возможно отключено нужное/);
  assert.match(out, /ralph/);
  assert.match(out, /решить вручную/);
  assert.match(out, /arhitektor/);
});
