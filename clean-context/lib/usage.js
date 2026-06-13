import fs from 'node:fs';

const MS_PER_DAY = 86_400_000;

export function loadUsage(claudeJsonPath) {
  try {
    const d = JSON.parse(fs.readFileSync(claudeJsonPath, 'utf8'));
    return { skillUsage: d.skillUsage || {}, pluginUsage: d.pluginUsage || {} };
  } catch {
    return { skillUsage: {}, pluginUsage: {} };
  }
}

// Локальные скилы лежат под голым именем, плагинные — под 'plugin:skill'.
function matchSuffix(map, name) {
  for (const k of Object.keys(map)) if (k.endsWith(':' + name)) return map[k];
  return null;
}

export function addUsage(items, usage, now) {
  return items.map((it) => {
    let rec = null;
    if (it.category === 'skill') rec = usage.skillUsage[it.name] || matchSuffix(usage.skillUsage, it.name);
    else if (it.category === 'plugin') rec = usage.pluginUsage[it.name];
    const usageCount = rec ? (rec.usageCount ?? 0) : null;
    const lastUsedAt = rec ? (rec.lastUsedAt ?? null) : null;
    const daysSinceUse = lastUsedAt ? Math.floor((now - lastUsedAt) / MS_PER_DAY) : null;
    return { ...it, usageCount, lastUsedAt, daysSinceUse };
  });
}
