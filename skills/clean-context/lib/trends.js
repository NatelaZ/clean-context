import fs from 'node:fs';
import path from 'node:path';

const MS_PER_DAY = 86_400_000;

// Снимок: { at, total, byCategory, items } где items: { "category/name": estTokens }.
export function buildSnapshot(items, now) {
  const byCategory = {};
  const map = {};
  let total = 0;
  for (const it of items) {
    const t = it.estTokens || 0;
    total += t;
    byCategory[it.category] = (byCategory[it.category] || 0) + t;
    map[`${it.category}/${it.name}`] = t;
  }
  return { at: now, total, byCategory, items: map };
}

export function shouldAppend(history, snap, opts = {}) {
  const throttleMs = opts.throttleMs ?? MS_PER_DAY;
  if (!history.length) return true;
  const last = history[history.length - 1];
  if (last.total !== snap.total) return true;
  if (JSON.stringify(last.items) !== JSON.stringify(snap.items)) return true;
  return snap.at - last.at > throttleMs;
}

export function diffSnapshots(older, newer) {
  const a = older.items || {};
  const b = newer.items || {};
  const added = [], removed = [], changed = [];
  for (const k of Object.keys(b)) {
    if (!(k in a)) added.push({ key: k, tokens: b[k] });
    else if (a[k] !== b[k]) changed.push({ key: k, from: a[k], to: b[k] });
  }
  for (const k of Object.keys(a)) if (!(k in b)) removed.push({ key: k, tokens: a[k] });
  added.sort((x, y) => y.tokens - x.tokens);
  removed.sort((x, y) => y.tokens - x.tokens);
  changed.sort((x, y) => Math.abs(y.to - y.from) - Math.abs(x.to - x.from));
  return { totalDelta: (newer.total || 0) - (older.total || 0), added, removed, changed };
}

export function loadHistory(historyPath) {
  try {
    return fs.readFileSync(historyPath, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  } catch {
    return [];
  }
}

export function recordSnapshot(historyPath, items, now, opts = {}) {
  const history = loadHistory(historyPath);
  const snap = buildSnapshot(items, now);
  if (!shouldAppend(history, snap, opts)) return false;
  fs.mkdirSync(path.dirname(historyPath), { recursive: true });
  fs.appendFileSync(historyPath, JSON.stringify(snap) + '\n');
  return true;
}

function fmtDate(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

export function renderTrends(history) {
  const lines = ['# Тренды стартовой платы', ''];
  if (history.length === 0) {
    lines.push('История пуста — запусти аудит, снимки начнут копиться (раз в день).');
    return lines.join('\n');
  }
  lines.push('Снимки (дата → стартовая плата):');
  for (const s of history.slice(-10)) lines.push(`  ${fmtDate(s.at)} — ~${s.total} ток.`);
  lines.push('');
  const first = history[0];
  const last = history[history.length - 1];
  const d = diffSnapshots(first, last);
  const sign = d.totalDelta >= 0 ? '+' : '';
  lines.push(`Период ${fmtDate(first.at)} → ${fmtDate(last.at)}: ${sign}${d.totalDelta} ток.`);
  if (d.added.length) {
    lines.push('  Добавилось:');
    for (const x of d.added.slice(0, 10)) lines.push(`    + ${x.key} (~${x.tokens})`);
  }
  if (d.removed.length) {
    lines.push('  Убрано:');
    for (const x of d.removed.slice(0, 10)) lines.push(`    − ${x.key} (~${x.tokens})`);
  }
  if (d.changed.length) {
    lines.push('  Изменилось:');
    for (const x of d.changed.slice(0, 10)) lines.push(`    ~ ${x.key} (${x.from}→${x.to})`);
  }
  return lines.join('\n');
}
