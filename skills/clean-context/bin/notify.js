import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defaultConfig } from '../lib/paths.js';
import { scanInventory } from '../lib/scan.js';
import { addCosts } from '../lib/cost.js';
import { loadUsage, addUsage } from '../lib/usage.js';
import { scanAgentUsage, addAgentUsage } from '../lib/agentusage.js';
import { recommend } from '../lib/recommend.js';
import { decideAlert } from '../lib/alarm.js';

try {
  const config = defaultConfig();
  const now = Date.now();
  let items = scanInventory(config);
  items = addCosts(items);
  items = addUsage(items, loadUsage(config.claudeJsonPath), now);
  items = addAgentUsage(items, scanAgentUsage(config.projectsDir, { now }), now);
  const result = recommend(items, { staleDays: config.staleDays });

  const skillRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
  const stateDir = path.join(skillRoot, '.state');
  fs.mkdirSync(stateDir, { recursive: true });
  fs.writeFileSync(path.join(stateDir, 'last-audit.json'), JSON.stringify({ now, items, result }, null, 2));

  const alertPath = path.join(stateDir, 'last-alert.json');
  let lastAlert = null;
  try { lastAlert = JSON.parse(fs.readFileSync(alertPath, 'utf8')); } catch {}

  const d = decideAlert(result, lastAlert, now);
  if (d.alert) {
    fs.writeFileSync(alertPath, JSON.stringify({ signature: d.signature, at: now }, null, 2));
    process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: d.message } }) + '\n');
  }
} catch {
  // Никогда не ломаем старт сессии.
}
process.exit(0);
