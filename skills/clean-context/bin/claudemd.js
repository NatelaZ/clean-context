import { defaultConfig } from '../lib/paths.js';
import { scanClaudeMd } from '../lib/scan.js';
import { analyzeFile, findDuplicateSections } from '../lib/claudemd.js';

const config = defaultConfig();
const items = scanClaudeMd(config);
if (items.length === 0) {
  console.log('CLAUDE.md не найдены.');
  process.exit(0);
}

const analyses = items.map((it) => analyzeFile(it.name, it.descText)).sort((a, b) => b.total - a.total);

const lines = ['# Разбор CLAUDE.md', ''];
const grand = analyses.reduce((s, a) => s + a.total, 0);
lines.push(`Всего по CLAUDE.md: ~${grand} токенов в ${analyses.length} файл(ах)`);
lines.push('');

for (const a of analyses) {
  lines.push(`## ${a.name} — ~${a.total} ток.`);
  for (const s of a.top.slice(0, 8)) {
    lines.push(`  - ${s.heading || '(преамбула)'} — ~${s.tokens} ток.`);
  }
  lines.push('');
}

const dups = findDuplicateSections(analyses.map((a) => ({ name: a.name, sections: a.sections })));
if (dups.length) {
  lines.push('## Дубли между файлами (кандидаты вынести в общий ~/.claude/CLAUDE.md)');
  for (const d of dups) {
    lines.push(`  - «${d.heading || '(преамбула)'}» — в ${d.copies} файлах, вернёшь ~${d.wastedTokens} ток.`);
    for (const f of d.files) lines.push(`      · ${f}`);
  }
  lines.push('');
}

lines.push('## Подсказки');
lines.push('  - Самые тяжёлые секции вверху каждого файла — кандидаты сжать.');
lines.push('  - Дубли вынеси один раз в глобальный ~/.claude/CLAUDE.md.');
lines.push('  - «Карты проекта»/файловые деревья часто можно сократить или убрать.');
console.log(lines.join('\n'));
