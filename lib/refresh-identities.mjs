// Only provider crosswalks or individually reviewed matches establish identity.
// Names alone are not stable identifiers (including within an organization).
export function reconcilePlayerIdentities(current, incoming, { providerLinks = [], registry = { entries: [] } } = {}) {
  const players = structuredClone(incoming);
  const byId = new Map(players.map(player => [player.id, player]));
  const transitions = [];
  for (const prior of current) {
    let next = byId.get(prior.id);
    let evidence = "unchanged";
    if (!next && prior.kind === "prospect") {
      const providerId = prior.fangraphsId || prior.id.slice(9);
      const linkedIds = new Set(providerLinks.filter(link => link.fangraphsIds.includes(providerId)).map(link => `mlb-${link.mlbamId}`));
      const matches = players.filter(player => player.fangraphsId === providerId || linkedIds.has(player.id) || (prior.boardIdentity && prior.boardIdentity === player.boardIdentity));
      if (matches.length > 1) throw new Error(`Ambiguous provider identity: ${prior.id}`);
      next = matches[0];
      evidence = "provider-crosswalk";
      if (!next) {
        const entry = registry.entries.find(entry => entry.from === prior.id);
        if (entry) {
          next = byId.get(entry.to);
          if (!next || ["name", "team", "age", "prospectType"].some(key => next[key] !== entry[key])) throw new Error(`Reviewed identity requires reconciliation: ${prior.id}`);
          evidence = "reviewed-crosswalk";
        }
      }
    }
    if (!next) continue;
    next.previousIds = [...new Set([...(next.previousIds ?? []), ...(prior.previousIds ?? []), ...(prior.id === next.id ? [] : [prior.id])])];
    if (prior.id !== next.id) transitions.push({ from: prior.id, to: next.id, name: prior.name, evidence });
  }
  const owners = new Map();
  for (const player of players) for (const id of [player.id, ...(player.previousIds ?? [])]) {
    if (owners.has(id) && owners.get(id) !== player.id) throw new Error(`Conflicting player alias: ${id}`);
    owners.set(id, player.id);
  }
  return { players, transitions };
}
