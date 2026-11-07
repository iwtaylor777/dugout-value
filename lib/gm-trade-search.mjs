const normalize = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export function matchesTradePlayer(name, query) {
  const normalized = normalize(name);
  return normalize(query).split(/\s+/).filter(Boolean).every(word => normalized.includes(word));
}

/** Search only the public player description, not salary or negotiation fields. */
export function matchesTradeChoice(choice, query) {
  const description = normalize(`${choice.name ?? ''} ${choice.position ?? ''}`);
  const positions = normalize(choice.position).split(/\s+/);
  const roles = new Set(['c', '1b', '2b', '3b', 'ss', 'lf', 'cf', 'rf', 'of', 'dh', 'sp', 'rp']);
  return normalize(query).split(/\s+/).filter(Boolean).every(word => {
    // "SP" must not match the letters inside "prospect"; C must mean catcher.
    if (roles.has(word)) return positions.includes(word) || (word === 'of' && positions.some(pos => ['lf', 'cf', 'rf'].includes(pos)));
    return description.includes(word);
  });
}
