import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const settingsPath = path.join(os.homedir(), '.claude', 'settings.json');
const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));

if (!settings.hooks || !settings.hooks.SessionStart) {
  console.log('Будильник не установлен.');
  process.exit(0);
}
if (!JSON.stringify(settings.hooks.SessionStart).includes('clean-context')) {
  console.log('Будильник не найден.');
  process.exit(0);
}
fs.copyFileSync(settingsPath, settingsPath + '.bak');
settings.hooks.SessionStart = settings.hooks.SessionStart.filter(
  (entry) => !JSON.stringify(entry).includes('clean-context'),
);
if (settings.hooks.SessionStart.length === 0) delete settings.hooks.SessionStart;
fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
console.log('Будильник снят.');
