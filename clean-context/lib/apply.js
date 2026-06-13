import fs from 'node:fs';
import path from 'node:path';

function backup(file) {
  const bak = file + '.bak';
  if (fs.existsSync(file)) fs.copyFileSync(file, bak);
  return bak;
}

function appendLog(logPath, ops) {
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  for (const op of ops) fs.appendFileSync(logPath, JSON.stringify(op) + '\n');
}

function moveFile(sel, destDir, stamp) {
  fs.mkdirSync(destDir, { recursive: true });
  const dest = path.join(destDir, path.basename(sel.path));
  fs.renameSync(sel.path, dest);
  return { type: 'move', category: sel.category, name: sel.name, from: sel.path, to: dest, at: stamp };
}

function togglePlugin(sel, config, enabled, stamp) {
  const file = config.settingsPath;
  const bak = backup(file);
  const settings = JSON.parse(fs.readFileSync(file, 'utf8'));
  settings.enabledPlugins = settings.enabledPlugins || {};
  const prev = settings.enabledPlugins[sel.name];
  settings.enabledPlugins[sel.name] = enabled;
  fs.writeFileSync(file, JSON.stringify(settings, null, 2) + '\n');
  return { type: 'plugin-toggle', name: sel.name, from: prev, to: enabled, file, backup: bak, at: stamp };
}

function moveMcpOut(sel, config, stamp) {
  const file = config.claudeJsonPath;
  const bak = backup(file);
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const cfg = (data.mcpServers || {})[sel.name];
  fs.mkdirSync(config.mcpDisabledDir, { recursive: true });
  const dest = path.join(config.mcpDisabledDir, sel.name + '.json');
  fs.writeFileSync(dest, JSON.stringify({ [sel.name]: cfg }, null, 2) + '\n');
  delete data.mcpServers[sel.name];
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
  return { type: 'mcp-move', name: sel.name, to: dest, file, backup: bak, at: stamp };
}

export function applyDisable(selections, config, logPath) {
  const stamp = Date.now();
  const ops = [];
  for (const sel of selections) {
    if (sel.category === 'skill') ops.push(moveFile(sel, config.skillsDisabledDir, stamp));
    else if (sel.category === 'agent') ops.push(moveFile(sel, config.agentsDisabledDir, stamp));
    else if (sel.category === 'plugin') ops.push(togglePlugin(sel, config, false, stamp));
    else if (sel.category === 'mcp') ops.push(moveMcpOut(sel, config, stamp));
  }
  appendLog(logPath, ops);
  return ops;
}
