import { estimateTokens } from './tokens.js';

export function addCosts(items, factors = {}) {
  return items.map((it) => {
    const base = estimateTokens(it.descText || '');
    const factor = factors[it.category];
    // нет коэффициента (или 0) → берём оценку без поправки
    const estTokens = factor ? Math.round(base * factor) : base;
    // estTokensRaw — всегда сырая оценка: по ней калибруют, иначе повторная калибровка дрейфует
    return { ...it, estTokens, estTokensRaw: base };
  });
}

export function totalsByCategory(items) {
  const totals = {};
  for (const it of items) totals[it.category] = (totals[it.category] || 0) + (it.estTokens || 0);
  return totals;
}
