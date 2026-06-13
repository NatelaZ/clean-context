import fs from 'node:fs';
import path from 'node:path';

// Резервная копия только если её ещё нет — чтобы повторный apply не затёр
// самую раннюю «чистую» копию. Основной механизм отката — журнал.
function backup(file) {
  const bak = file + '.bak';
  if (fs.existsSync(file) && !fs.existsSync(bak)) fs.copyFileSync(file, bak);
  return bak;
}

function appendLog(logPath, ops) {
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  for (const op of ops) fs.appendFileSync(logPath, JSON.stringify(op) + '\n');
}

function moveFile(sel, destDir, stamp) {
  fs.mkdirSync(destDir, { recursive: true });
  const dest = path.join(destDir, path.basename(sel.path));
  if (fs.existsSync(dest)) throw new Error(`${dest} уже существует — не перезаписываю`);
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
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const cfg = (data.mcpServers || {})[sel.name];
  if (cfg === undefined) throw new Error(`MCP-сервер "${sel.name}" не найден в ${file}`);
  fs.mkdirSync(config.mcpDisabledDir, { recursive: true });
  const dest = path.join(config.mcpDisabledDir, sel.name + '.json');
  if (fs.existsSync(dest)) throw new Error(`${dest} уже существует — не перезаписываю отключённый MCP "${sel.name}"`);
  const bak = backup(file);
  // Сначала сохраняем конфиг в dest, затем убираем из .claude.json — при сбое
  // конфиг остаётся в dest и/или .bak, не теряется.
  fs.writeFileSync(dest, JSON.stringify({ [sel.name]: cfg }, null, 2) + '\n');
  delete data.mcpServers[sel.name];
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
  return { type: 'mcp-move', name: sel.name, to: dest, file, backup: bak, at: stamp };
}

// Журналируем КАЖДУЮ операцию сразу после успеха: если следующая упадёт,
// уже выполненные останутся в логе и откатятся restore.js.
export function applyDisable(selections, config, logPath) {
  const stamp = Date.now();
  const ops = [];
  for (const sel of selections) {
    let op;
    if (sel.category === 'skill') op = moveFile(sel, config.skillsDisabledDir, stamp);
    else if (sel.category === 'agent') op = moveFile(sel, config.agentsDisabledDir, stamp);
    else if (sel.category === 'plugin') op = togglePlugin(sel, config, false, stamp);
    else if (sel.category === 'mcp') op = moveMcpOut(sel, config, stamp);
    else continue;
    appendLog(logPath, [op]);
    ops.push(op);
  }
  return ops;
}
