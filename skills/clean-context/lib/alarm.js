const DAY_MS = 86_400_000;

export function signatureOf(result) {
  const items = [...(result.toDisable || []), ...(result.wrongDirection || [])];
  return items.map((it) => `${it.category}/${it.name}`).sort().join(',');
}

export function buildMessage(result) {
  const td = result.toDisable || [];
  const wd = result.wrongDirection || [];
  const parts = [];
  if (td.length) {
    const tokens = td.reduce((s, i) => s + (i.estTokens || 0), 0);
    parts.push(`${td.length} шт. включено, но не используется (~${tokens} ток.)`);
  }
  if (wd.length) parts.push(`${wd.length} шт. выключено, но используется`);
  if (!parts.length) return '';
  return `🧹 clean-context: ${parts.join('; ')}. Запусти /clean-context — посмотреть и отключить.`;
}

// Анти-спам: алерт, если есть что отключить И (сигнатура изменилась ИЛИ
// прошло больше throttleMs с прошлого алерта).
export function decideAlert(result, lastAlert, now, opts = {}) {
  const throttleMs = opts.throttleMs ?? DAY_MS;
  const signature = signatureOf(result);
  if (!signature) return { alert: false, signature, message: '' };
  const changed = signature !== lastAlert?.signature;
  const stale = now - (lastAlert?.at ?? 0) > throttleMs;
  const alert = changed || stale;
  return { alert, signature, message: alert ? buildMessage(result) : '' };
}
