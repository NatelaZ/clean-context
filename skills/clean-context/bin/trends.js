import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadHistory, renderTrends } from '../lib/trends.js';

const skillRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const historyPath = path.join(skillRoot, '.state', 'history.jsonl');
console.log(renderTrends(loadHistory(historyPath)));
