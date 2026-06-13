// Классифицирует инвентарь. Авто-отключение разрешено только скилам и MCP
// (низкий риск, обратимо). Плагины — рекомендация. Агенты — только manualReview
// (нет прямой статистики использования).
const WRONG_DIR_THRESHOLD = 20;

export function recommend(items, opts = {}) {
  const staleDays = opts.staleDays ?? 30;
  const toDisable = [];
  const wrongDirection = [];
  const manualReview = [];
  const keep = [];

  for (const it of items) {
    const canAuto = it.category === 'skill' || it.category === 'mcp'; // mcp reaches toDisable only in phase 2 (no usage data yet)
    const hasUsageData = it.category === 'skill' || it.category === 'plugin' || it.category === 'agent';

    if (it.status === 'active' && hasUsageData && it.usageCount !== null) {
      const unused = it.usageCount === 0 || (it.daysSinceUse !== null && it.daysSinceUse > staleDays);
      if (unused) {
        toDisable.push({
          ...it,
          auto: canAuto,
          reason: it.usageCount === 0 ? 'ни разу не использован' : `не использован ${it.daysSinceUse} дн.`,
        });
        continue;
      }
    }

    if (it.status === 'disabled' && it.usageCount !== null && it.usageCount > WRONG_DIR_THRESHOLD) {
      wrongDirection.push({ ...it, reason: `выключен, но использован ${it.usageCount} раз` });
      continue;
    }

    if (it.category === 'agent' && it.status === 'active' && it.usageCount === null) {
      manualReview.push(it);
      continue;
    }

    keep.push(it);
  }

  toDisable.sort((a, b) => (b.estTokens || 0) - (a.estTokens || 0));
  manualReview.sort((a, b) => (b.estTokens || 0) - (a.estTokens || 0));
  return { toDisable, wrongDirection, manualReview, keep };
}
