import { estimateTokens } from './tokens.js';

const MIN_DUP_CHARS = 40;

// Режет markdown по заголовкам #..######. Текст до первого заголовка — преамбула
// (heading: null). Пустые/пробельные секции отбрасываются.
export function splitSections(content) {
  const lines = (content || '').replace(/\r\n/g, '\n').split('\n');
  const sections = [];
  let cur = { heading: null, level: 0, line: 1, lines: [] };
  let inFence = false;
  lines.forEach((ln, i) => {
    if (ln.startsWith('```')) { inFence = !inFence; cur.lines.push(ln); return; }
    const m = !inFence && ln.match(/^(#{1,6})\s+(.*)$/);
    if (m) {
      sections.push(cur);
      const heading = m[2].trim().replace(/\s+#+$/, '').trim();
      cur = { heading, level: m[1].length, line: i + 1, lines: [ln] };
    } else {
      cur.lines.push(ln);
    }
  });
  sections.push(cur);
  return sections
    .map((s) => {
      const text = s.lines.join('\n');
      return { heading: s.heading, level: s.level, line: s.line, text, tokens: estimateTokens(text) };
    })
    .filter((s) => s.text.trim() !== '');
}

export function analyzeFile(name, content) {
  const sections = splitSections(content);
  const total = sections.reduce((s, x) => s + x.tokens, 0);
  const top = [...sections].sort((a, b) => b.tokens - a.tokens);
  return { name, total, sections, top };
}

function normalize(text) {
  return text.replace(/\s+/g, ' ').trim().toLowerCase();
}

// files: [{ name, sections }]. Находит секции, чей нормализованный текст встречается
// в ≥2 РАЗНЫХ файлах. wastedTokens = tokens * (копий - 1) — что вернёшь, оставив одну.
export function findDuplicateSections(files) {
  const byNorm = new Map();
  for (const f of files) {
    for (const s of f.sections) {
      const key = normalize(s.text);
      if (key.length < MIN_DUP_CHARS) continue; // крошечные секции не считаем дублями
      if (!byNorm.has(key)) byNorm.set(key, { heading: s.heading, tokens: s.tokens, files: [] });
      byNorm.get(key).files.push(f.name);
    }
  }
  const dups = [];
  for (const v of byNorm.values()) {
    const uniqueFiles = [...new Set(v.files)];
    if (uniqueFiles.length >= 2) {
      dups.push({
        heading: v.heading,
        tokens: v.tokens,
        files: uniqueFiles,
        copies: uniqueFiles.length,
        wastedTokens: v.tokens * (uniqueFiles.length - 1),
      });
    }
  }
  dups.sort((a, b) => b.wastedTokens - a.wastedTokens);
  return dups;
}
