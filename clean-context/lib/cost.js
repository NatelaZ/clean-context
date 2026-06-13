import { estimateTokens } from './tokens.js';

export function addCosts(items) {
  return items.map((it) => ({ ...it, estTokens: estimateTokens(it.descText || '') }));
}

export function totalsByCategory(items) {
  const totals = {};
  for (const it of items) totals[it.category] = (totals[it.category] || 0) + (it.estTokens || 0);
  return totals;
}
