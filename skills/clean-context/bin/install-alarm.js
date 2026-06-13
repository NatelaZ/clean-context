import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const settingsPath = path.join(os.homedir(), '.claude', 'settings.json');
const notifyPath = path.join(os.homedir(), '.claude', 'skills', 'clean-context', 'bin', 'notify.js');
const command = `node "${notifyPath}"`;

const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
settings.hooks = settings.hooks || {};
settings.hooks.SessionStart = settings.hooks.SessionStart || [];

if (JSON.stringify(settings.hooks.SessionStart).includes('clean-context')) {
  console.log('Будильник уже установлен.');
  process.exit(0);
}

fs.copyFileSync(settingsPath, settingsPath + '.bak');
settings.hooks.SessionStart.push({ hooks: [{ type: 'command', command }] });
fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
console.log('Будильник установлен (SessionStart → notify.js). Заработает со следующей сессии.');
