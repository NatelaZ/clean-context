import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defaultConfig } from '../lib/paths.js';
import { applyDisable } from '../lib/apply.js';

const config = defaultConfig();
const skillRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const stateDir = path.join(skillRoot, '.state');
let audit;
try {
  audit = JSON.parse(fs.readFileSync(path.join(stateDir, 'last-audit.json'), 'utf8'));
} catch {
  console.error('Не найден результат аудита (.state/last-audit.json). Сначала запусти bin/audit.js.');
  process.exit(1);
}

const names = process.argv.slice(2);
if (names.length === 0) {
  console.error('Укажи имена для отключения: node bin/apply.js <name> [<name> ...]');
  process.exit(1);
}
const pool = [...audit.result.toDisable, ...audit.result.manualReview]
  .filter((it) => it.category !== 'mcp' || !it.scope || it.scope === 'global');
const selections = names
  .map((n) => pool.find((it) => it.name === n))
  .filter(Boolean)
  .map((it) => ({ category: it.category, name: it.name, path: it.path }));

const missing = names.filter((n) => !pool.some((it) => it.name === n));
if (missing.length) {
  console.error('Не найдены в последнем аудите:', missing.join(', '));
  process.exitCode = 1;
}

const ops = applyDisable(selections, config, path.join(stateDir, 'operations.log.jsonl'));
console.log(`Отключено: ${ops.length}`);
for (const op of ops) console.log('  -', op.name, '|', op.type, '->', op.to || op.file);
