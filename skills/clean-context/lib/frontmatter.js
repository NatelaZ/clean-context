// Достаёт name/description из YAML-frontmatter. Описания в SKILL.md и агентах —
// однострочные, поэтому без полноценного YAML-парсера (zero-dep).
export function parseFrontmatter(text) {
  if (!text) return { name: null, description: null, body: '' };
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return { name: null, description: null, body: text };
  const fm = m[1];
  const get = (key) => {
    const r = fm.match(new RegExp('^' + key + ':\\s*(.*)$', 'm'));
    return r ? r[1].trim().replace(/^["']|["']$/g, '') : null;
  };
  return { name: get('name'), description: get('description'), body: text.slice(m[0].length).replace(/^\n/, '') };
}
