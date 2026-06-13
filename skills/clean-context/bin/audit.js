import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defaultConfig } from '../lib/paths.js';
import { scanInventory } from '../lib/scan.js';
import { addCosts } from '../lib/cost.js';
import { loadUsage, addUsage } from '../lib/usage.js';
import { recommend } from '../lib/recommend.js';
import { renderReport } from '../lib/report.js';

const config = defaultConfig();
const now = Date.now();
let items = scanInventory(config);
items = addCosts(items);
items = addUsage(items, loadUsage(config.claudeJsonPath), now);
const result = recommend(items, { staleDays: config.staleDays });

const skillRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const stateDir = path.join(skillRoot, '.state');
fs.mkdirSync(stateDir, { recursive: true });
fs.writeFileSync(path.join(stateDir, 'last-audit.json'), JSON.stringify({ now, items, result }, null, 2));

console.log(renderReport(result, items));
