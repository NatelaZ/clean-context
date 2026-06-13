import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defaultConfig } from '../lib/paths.js';
import { restoreAll } from '../lib/restore.js';

const config = defaultConfig();
const skillRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const log = path.join(skillRoot, '.state', 'operations.log.jsonl');
const done = restoreAll(log, config);
console.log(`Восстановлено операций: ${done.length}`);
for (const op of done) console.log('  -', op.name, '|', op.type);
