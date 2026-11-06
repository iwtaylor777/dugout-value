const normalize = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export function matchesTradePlayer(name, query) {
  const normalized = normalize(name);
  return normalize(query).split(/\s+/).filter(Boolean).every(word => normalized.includes(word));
}
