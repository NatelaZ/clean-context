// Грубая оценка стартовой платы в токенах с поправкой на язык.
// Кириллица токенизируется плотнее латиницы, поэтому делители разные.
export function estimateTokens(text) {
  if (!text) return 0;
  const cyrillic = (text.match(/[Ѐ-ӿ]/g) || []).length;
  const rest = text.length - cyrillic;
  return Math.ceil(cyrillic / 2.5 + rest / 4);
}
