import fs from 'node:fs';
import path from 'node:path';

const MS_PER_DAY = 86_400_000;

// Чистая агрегация: files = [{ mtime (epoch ms), text }] -> { name: {usageCount, lastUsedAt} }.
// lastUsedAt = макс mtime файла, в котором агент встретился (без глубокого парсинга — быстро).
export function tallyAgents(files) {
  const out = Object.create(null);
  const re = /"subagent_type":"([^"]+)"/g;
  for (const f of files) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(f.text)) !== null) {
      const name = m[1];
      if (!out[name]) out[name] = { usageCount: 0, lastUsedAt: 0 };
      out[name].usageCount += 1;
      if (f.mtime > out[name].lastUsedAt) out[name].lastUsedAt = f.mtime;
    }
  }
  return out;
}

function walk(dir, cb) {
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    const fp = path.join(dir, e.name);
    if (e.isDirectory()) walk(fp, cb);
    else cb(fp);
  }
}

// Обход логов: только *.jsonl в окне последних windowDays по mtime; читает лишь файлы с 'subagent_type'.
export function scanAgentUsage(projectsDir, opts = {}) {
  const now = opts.now ?? Date.now();
  const windowDays = opts.windowDays ?? 45;
  const cutoff = now - windowDays * MS_PER_DAY;
  const files = [];
  walk(projectsDir, (fp) => {
    if (!fp.endsWith('.jsonl')) return;
    let stat;
    try { stat = fs.statSync(fp); } catch { return; }
    if (stat.mtimeMs < cutoff) return;
    let text = '';
    try { text = fs.readFileSync(fp, 'utf8'); } catch { return; }
    if (text.includes('subagent_type')) files.push({ mtime: stat.mtimeMs, text });
  });
  return tallyAgents(files);
}

// Заполняет агентам поля usage. Не найден в логах -> usageCount 0 (кандидат на отключение, «спрос»).
export function addAgentUsage(items, agentUsage, now) {
  return items.map((it) => {
    if (it.category !== 'agent') return it;
    const rec = agentUsage[it.name];
    const usageCount = rec ? rec.usageCount : 0;
    const lastUsedAt = rec ? rec.lastUsedAt : null;
    const daysSinceUse = lastUsedAt ? Math.floor((now - lastUsedAt) / MS_PER_DAY) : null;
    return { ...it, usageCount, lastUsedAt, daysSinceUse };
  });
}
