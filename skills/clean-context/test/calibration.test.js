import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  loadCalibration, saveCalibration, computeFactor, categoryEstimate, runCalibrate,
} from '../lib/calibration.js';
import { addCosts } from '../lib/cost.js';

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'cc-cal-'));
}

test('loadCalibration возвращает пустую структуру, если файла нет', () => {
  const dir = tmpDir();
  const cal = loadCalibration(dir);
  assert.deepEqual(cal.factors, {});
});

test('loadCalibration не падает на битом JSON', () => {
  const dir = tmpDir();
  fs.writeFileSync(path.join(dir, 'calibration.json'), '{ broken');
  const cal = loadCalibration(dir);
  assert.deepEqual(cal.factors, {});
});

test('saveCalibration пишет и читается обратно', () => {
  const dir = tmpDir();
  saveCalibration(dir, { factors: { skill: 1.3 }, updatedAt: 42 });
  const cal = loadCalibration(dir);
  assert.equal(cal.factors.skill, 1.3);
  assert.equal(cal.updatedAt, 42);
});

test('computeFactor = real/est, округление до 3 знаков', () => {
  assert.equal(computeFactor(4600, 3514), 1.309);
  assert.equal(computeFactor(100, 50), 2);
});

test('computeFactor возвращает 1 при нулевой/отрицательной оценке', () => {
  assert.equal(computeFactor(100, 0), 1);
  assert.equal(computeFactor(100, -5), 1);
});

test('categoryEstimate суммирует estTokens по категории', () => {
  const items = [
    { category: 'skill', estTokens: 10 },
    { category: 'skill', estTokens: 5 },
    { category: 'agent', estTokens: 7 },
  ];
  assert.equal(categoryEstimate(items, 'skill'), 15);
  assert.equal(categoryEstimate(items, 'agent'), 7);
  assert.equal(categoryEstimate(items, 'mcp'), 0);
});

test('runCalibrate читает last-audit, пишет factor и возвращает детали', () => {
  const dir = tmpDir();
  fs.writeFileSync(path.join(dir, 'last-audit.json'), JSON.stringify({
    items: [
      { category: 'skill', estTokens: 2000 },
      { category: 'skill', estTokens: 1514 },
      { category: 'agent', estTokens: 1648 },
    ],
  }));
  const r = runCalibrate({ stateDir: dir, category: 'skill', realTokens: 4600, now: 99 });
  assert.equal(r.est, 3514);
  assert.equal(r.factor, 1.309);
  const cal = loadCalibration(dir);
  assert.equal(cal.factors.skill, 1.309);
  assert.equal(cal.updatedAt, 99);
});

test('runCalibrate сохраняет ранее откалиброванные категории (merge)', () => {
  const dir = tmpDir();
  saveCalibration(dir, { factors: { agent: 1.2 }, updatedAt: 1 });
  fs.writeFileSync(path.join(dir, 'last-audit.json'), JSON.stringify({
    items: [{ category: 'skill', estTokens: 100 }],
  }));
  runCalibrate({ stateDir: dir, category: 'skill', realTokens: 200, now: 5 });
  const cal = loadCalibration(dir);
  assert.equal(cal.factors.agent, 1.2);
  assert.equal(cal.factors.skill, 2);
});

test('runCalibrate бросает понятную ошибку без last-audit', () => {
  const dir = tmpDir();
  assert.throws(() => runCalibrate({ stateDir: dir, category: 'skill', realTokens: 100, now: 1 }),
    /аудит/i);
});

test('runCalibrate бросает ошибку и не пишет файл, если категории нет в аудите', () => {
  const dir = tmpDir();
  fs.writeFileSync(path.join(dir, 'last-audit.json'), JSON.stringify({
    items: [{ category: 'skill', estTokens: 100 }],
  }));
  assert.throws(() => runCalibrate({ stateDir: dir, category: 'hook', realTokens: 50, now: 1 }),
    /не найдена/);
  assert.equal(fs.existsSync(path.join(dir, 'calibration.json')), false);
});

test('categoryEstimate предпочитает estTokensRaw, если он есть', () => {
  const items = [
    { category: 'skill', estTokens: 20, estTokensRaw: 10 },
    { category: 'skill', estTokens: 40 }, // нет raw → фолбэк на estTokens
  ];
  assert.equal(categoryEstimate(items, 'skill'), 50); // 10 + 40
});

test('повторная калибровка идемпотентна — нет дрейфа коэффициента', () => {
  const dir = tmpDir();
  // Аудит #1 (калибровки ещё нет): сырые items через настоящий addCosts.
  const items1 = addCosts([{ category: 'skill', descText: 'x'.repeat(40) }]); // base=10
  fs.writeFileSync(path.join(dir, 'last-audit.json'), JSON.stringify({ items: items1 }));
  const r1 = runCalibrate({ stateDir: dir, category: 'skill', realTokens: 20, now: 1 });
  assert.equal(r1.factor, 2); // 20 / 10

  // Аудит #2 применяет коэффициент: estTokens=20 (калибр.), estTokensRaw=10 (сырой).
  const cal = loadCalibration(dir);
  const items2 = addCosts([{ category: 'skill', descText: 'x'.repeat(40) }], cal.factors);
  assert.equal(items2[0].estTokens, 20);
  assert.equal(items2[0].estTokensRaw, 10);
  fs.writeFileSync(path.join(dir, 'last-audit.json'), JSON.stringify({ items: items2 }));

  // Повторная калибровка тем же реальным значением → ТОТ ЖЕ коэффициент, не 1.
  const r2 = runCalibrate({ stateDir: dir, category: 'skill', realTokens: 20, now: 2 });
  assert.equal(r2.factor, 2);
});
