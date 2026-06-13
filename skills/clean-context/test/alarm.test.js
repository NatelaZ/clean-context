import { test } from 'node:test';
import assert from 'node:assert/strict';
import { signatureOf, buildMessage, decideAlert } from '../lib/alarm.js';

const DAY = 86_400_000;
const res = (over = {}) => ({ toDisable: [], wrongDirection: [], ...over });

test('signatureOf не зависит от порядка', () => {
  const a = signatureOf(res({ toDisable: [{ category: 'skill', name: 'b' }, { category: 'skill', name: 'a' }] }));
  const b = signatureOf(res({ toDisable: [{ category: 'skill', name: 'a' }, { category: 'skill', name: 'b' }] }));
  assert.equal(a, b);
});

test('пустой результат -> нет алерта', () => {
  const d = decideAlert(res(), null, 1000);
  assert.equal(d.alert, false);
});

test('есть что отключить и нет истории -> алерт', () => {
  const d = decideAlert(res({ toDisable: [{ category: 'skill', name: 'x', estTokens: 100 }] }), null, 1000);
  assert.equal(d.alert, true);
  assert.match(d.message, /clean-context/);
  assert.match(d.message, /100/);
  assert.match(d.message, /\/clean-context/);
});

test('та же сигнатура внутри окна -> нет алерта', () => {
  const r = res({ toDisable: [{ category: 'skill', name: 'x', estTokens: 100 }] });
  const sig = signatureOf(r);
  const d = decideAlert(r, { signature: sig, at: 1000 }, 1000 + DAY / 2);
  assert.equal(d.alert, false);
});

test('та же сигнатура после суток -> алерт', () => {
  const r = res({ toDisable: [{ category: 'skill', name: 'x', estTokens: 100 }] });
  const sig = signatureOf(r);
  const d = decideAlert(r, { signature: sig, at: 1000 }, 1000 + DAY + 1);
  assert.equal(d.alert, true);
});

test('изменённая сигнатура внутри окна -> алерт', () => {
  const r = res({ toDisable: [{ category: 'skill', name: 'y', estTokens: 100 }] });
  const d = decideAlert(r, { signature: 'skill/x', at: 1000 }, 1000 + 1);
  assert.equal(d.alert, true);
});

test('buildMessage включает wrongDirection', () => {
  const m = buildMessage(res({ wrongDirection: [{ category: 'plugin', name: 'ralph' }] }));
  assert.match(m, /выключено, но используется/);
});
