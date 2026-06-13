import { totalsByCategory } from './cost.js';

export function renderReport(result, items) {
  const lines = [];
  const total = items.reduce((s, i) => s + (i.estTokens || 0), 0);
  const totals = totalsByCategory(items);

  lines.push('# Клинер контекста — отчёт');
  lines.push('');
  lines.push(`Стартовая плата (оценка): ~${total} токенов`);
  lines.push('Разбивка по категориям:');
  for (const [cat, t] of Object.entries(totals).sort((a, b) => b[1] - a[1])) {
    lines.push(`  - ${cat}: ~${t}`);
  }
  lines.push('');

  const top = [...items].sort((a, b) => (b.estTokens || 0) - (a.estTokens || 0)).slice(0, 5);
  if (top.length) {
    lines.push('Топ пожирателей (отдельные пункты):');
    for (const it of top) lines.push(`  - ${it.category}/${it.name} — ~${it.estTokens || 0} ток.`);
    lines.push('');
  }

  const reclaim = result.toDisable.reduce((s, i) => s + (i.estTokens || 0), 0);
  lines.push(`## Рекомендую отключить (вернём ~${reclaim} токенов)`);
  if (result.toDisable.length === 0) lines.push('  — нечего, всё используется. 👍');
  for (const it of result.toDisable) {
    lines.push(`  - [${it.auto ? 'авто' : 'спрос'}] ${it.category}/${it.name} — ~${it.estTokens} ток. (${it.reason})`);
  }
  lines.push('');

  if (result.wrongDirection.length) {
    lines.push('## ⚠️ Возможно отключено нужное');
    for (const it of result.wrongDirection) lines.push(`  - ${it.category}/${it.name} — ${it.reason}`);
    lines.push('');
  }

  if (result.manualReview.length) {
    lines.push('## Агенты — решить вручную (нет статистики использования)');
    for (const it of result.manualReview) lines.push(`  - ${it.name} — ~${it.estTokens} ток.`);
    lines.push('');
  }

  lines.push('## Гигиена контекста');
  lines.push('  - Одна сессия = одна задача; /clear между задачами (история — главный пожиратель).');
  lines.push('  - Тяжёлое чтение — через субагентов: у них свой контекст.');
  lines.push('  - Короткие описания скилов/агентов; CLAUDE.md — только необходимое.');
  lines.push('  - MCP включать точечно.');
  return lines.join('\n');
}
