import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCalibrate } from '../lib/calibration.js';

const [category, realRaw] = process.argv.slice(2);
const VALID = ['skill', 'agent', 'mcp', 'plugin', 'claudemd', 'hook'];

if (!category || realRaw === undefined) {
  console.error('Использование: node bin/calibrate.js <skill|agent|...> <реальныеТокеныИзContext>');
  console.error('Пример: открой /context, посмотри строку «Custom agents: 2.1k», затем:');
  console.error('  node bin/calibrate.js agent 2100');
  process.exit(1);
}
if (!VALID.includes(category)) {
  console.error(`Неизвестная категория "${category}". Допустимо: ${VALID.join(', ')}`);
  process.exit(1);
}
const realTokens = Number(realRaw);
if (!Number.isFinite(realTokens) || realTokens <= 0) {
  console.error(`Реальные токены должны быть положительным числом, получено: "${realRaw}"`);
  process.exit(1);
}

const skillRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const stateDir = path.join(skillRoot, '.state');

try {
  const { est, factor } = runCalibrate({ stateDir, category, realTokens, now: Date.now() });
  console.log(`Калибровка «${category}»:`);
  console.log(`  оценка аудита : ~${est} ток.`);
  console.log(`  реально (/context): ${realTokens} ток.`);
  console.log(`  коэффициент   : ×${factor}`);
  console.log('Записано в .state/calibration.json. Следующий аудит учтёт поправку.');
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
