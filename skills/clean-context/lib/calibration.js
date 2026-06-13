import fs from 'node:fs';
import path from 'node:path';

const FILE = 'calibration.json';

export function loadCalibration(stateDir) {
  try {
    const data = JSON.parse(fs.readFileSync(path.join(stateDir, FILE), 'utf8'));
    return { factors: data.factors || {}, updatedAt: data.updatedAt ?? null };
  } catch {
    return { factors: {}, updatedAt: null };
  }
}

export function saveCalibration(stateDir, cal) {
  fs.mkdirSync(stateDir, { recursive: true });
  const out = { factors: cal.factors || {}, updatedAt: cal.updatedAt ?? null };
  fs.writeFileSync(path.join(stateDir, FILE), JSON.stringify(out, null, 2));
  return out;
}

export function computeFactor(realTokens, estTokens) {
  if (!(estTokens > 0)) return 1;
  return Math.round((realTokens / estTokens) * 1000) / 1000;
}

export function categoryEstimate(items, category) {
  let sum = 0;
  for (const it of items || []) {
    if (it.category === category) sum += it.estTokens || 0;
  }
  return sum;
}

export function runCalibrate({ stateDir, category, realTokens, now }) {
  let audit;
  try {
    audit = JSON.parse(fs.readFileSync(path.join(stateDir, 'last-audit.json'), 'utf8'));
  } catch {
    throw new Error('Нет последнего аудита (.state/last-audit.json). Сначала запусти audit.js.');
  }
  const est = categoryEstimate(audit.items, category);
  const factor = computeFactor(realTokens, est);
  const cal = loadCalibration(stateDir);
  cal.factors[category] = factor;
  cal.updatedAt = now;
  saveCalibration(stateDir, cal);
  return { est, factor, calibration: cal };
}
