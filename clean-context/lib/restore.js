import fs from 'node:fs';
import path from 'node:path';

export function restoreAll(logPath, config) {
  if (!fs.existsSync(logPath)) return [];
  const ops = fs.readFileSync(logPath, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)).reverse();
  const done = [];
  for (const op of ops) {
    if (op.type === 'move') {
      fs.mkdirSync(path.dirname(op.from), { recursive: true });
      fs.renameSync(op.to, op.from);
    } else if (op.type === 'plugin-toggle') {
      const s = JSON.parse(fs.readFileSync(op.file, 'utf8'));
      s.enabledPlugins = s.enabledPlugins || {};
      if (op.from === undefined) delete s.enabledPlugins[op.name];
      else s.enabledPlugins[op.name] = op.from;
      fs.writeFileSync(op.file, JSON.stringify(s, null, 2) + '\n');
    } else if (op.type === 'mcp-move') {
      const data = JSON.parse(fs.readFileSync(op.file, 'utf8'));
      const restored = JSON.parse(fs.readFileSync(op.to, 'utf8'));
      data.mcpServers = data.mcpServers || {};
      Object.assign(data.mcpServers, restored);
      fs.writeFileSync(op.file, JSON.stringify(data, null, 2) + '\n');
      fs.rmSync(op.to, { force: true });
    }
    done.push(op);
  }
  fs.writeFileSync(logPath, '');
  return done;
}
