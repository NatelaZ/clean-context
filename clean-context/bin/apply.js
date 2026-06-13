import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defaultConfig } from '../lib/paths.js';
import { applyDisable } from '../lib/apply.js';

const config = defaultConfig();
const skillRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const stateDir = path.join(skillRoot, '.state');
const audit = JSON.parse(fs.readFileSync(path.join(stateDir, 'last-audit.json'), 'utf8'));

const names = process.argv.slice(2);
if (names.length === 0) {
  console.error('Укажи имена для отключения: node bin/apply.js <name> [<name> ...]');
  process.exit(1);
}
const pool = [...audit.result.toDisable, ...audit.result.manualReview];
const selections = names
  .map((n) => pool.find((it) => it.name === n))
  .filter(Boolean)
  .map((it) => ({ category: it.category, name: it.name, path: it.path }));

const missing = names.filter((n) => !pool.some((it) => it.name === n));
if (missing.length) console.error('Не найдены в последнем аудите:', missing.join(', '));

const ops = applyDisable(selections, config, path.join(stateDir, 'operations.log.jsonl'));
console.log(`Отключено: ${ops.length}`);
for (const op of ops) console.log('  -', op.name, '|', op.type, '->', op.to || op.file);
