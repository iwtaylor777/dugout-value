export function reviewDataRefresh(current, candidate) {
  const blockers = [];
  const warnings = [];
  const identityTransitions = [];
  if (!Array.isArray(candidate.players) || !candidate.players.length) {
    return { readyForPromotion: false, blockers: ["Candidate has no player records."], warnings };
  }
  const byId = new Map();
  const mlbamIds = new Set();
  const aliasOwners = new Map();
  const allSeasons = player => [...(player.seasons ?? []), ...(player.contractScenario?.options ?? []).flatMap(option => option.seasons ?? [])];
  for (const player of candidate.players) {
    if (!player.id || byId.has(player.id)) blockers.push(`Missing or duplicate player ID: ${player.id}`);
    byId.set(player.id, player);
    for (const alias of [player.id, ...(player.previousIds ?? [])]) {
      if (aliasOwners.has(alias) && aliasOwners.get(alias).id !== player.id) blockers.push(`Conflicting player alias: ${alias}.`);
      aliasOwners.set(alias, player);
    }
    const mlbamId = player.mlbamId ?? (player.id?.startsWith("mlb-") ? player.id.slice(4) : null);
    if (mlbamId && mlbamIds.has(String(mlbamId))) blockers.push(`Duplicate MLBAM identity: ${mlbamId}.`);
    if (mlbamId) mlbamIds.add(String(mlbamId));
    if (player.refreshStatus === "carried-forward") blockers.push(`Unresolved carried-forward MLB record: ${player.name} (${player.id}); source ${player.sourceAsOf ?? "unknown"}.`);
    if (player.refreshStatus === "retained-grade" && !(player.kind === "prospect" && player.disposition?.evidenceVerified && player.disposition?.action === "retain-grade" && player.disposition.validThrough >= candidate.meta.refreshed && player.refreshNote && player.source?.refreshed < candidate.meta.refreshed)) blockers.push(`Unreviewed retained grade: ${player.name}.`);
    for (const season of allSeasons(player)) {
      if (![season.year, season.war, season.salary].every(Number.isFinite)) blockers.push(`Invalid numeric season for ${player.name}.`);
      if (candidate.meta?.seasonRemainingFraction === 0 && season.year === candidate.meta.baseYear && season.ros) {
        if (season.war !== 0) blockers.push(`Remaining-season WAR after season end: ${player.name} (${season.war}).`);
        if (season.salary !== 0) blockers.push(`Remaining-season salary after season end: ${player.name} (${season.salary}).`);
      }
    }
    const paths = player.contractScenario?.options ?? [];
    if (paths.length && (!paths.some(path => path.id === player.contractScenario.selectedId) || new Set(paths.map(path => path.id)).size !== paths.length)) blockers.push(`Invalid contract path selection: ${player.name}.`);
  }
  for (const player of current.players) {
    const incoming = byId.get(player.id) ?? aliasOwners.get(player.id);
    if (incoming && incoming.id !== player.id) identityTransitions.push({ from: player.id, to: incoming.id, name: player.name });
    if (!incoming) {
      const archived = candidate.archivedPlayers?.find(record => record.id === player.id);
      const disposition = archived?.disposition;
      if (player.kind === "prospect" && disposition?.action === "archive" && disposition.evidenceVerified && disposition.effectiveDate <= candidate.meta.refreshed && disposition.validThrough >= candidate.meta.refreshed && disposition.sourceSha256) continue;
      if (player.kind === "mlb" && disposition?.transactionId && /^https:\/\/statsapi\.mlb\.com\//.test(disposition.sourceUrl ?? "") && disposition.effectiveDate <= candidate.meta.refreshed && disposition.validThrough >= candidate.meta.refreshed && disposition.reason && disposition.sourceSha256) continue;
      // A prospect's provider ID may become an MLB entry. Record the explicit
      // crosswalk rather than treating that as an unexplained lost record.
      const fgId = player.fangraphsId ?? (player.id?.startsWith("prospect-") ? player.id.slice(9) : null);
      const promoted = player.kind === "prospect" && fgId ? candidate.players.find(record => record.kind === "mlb" && record.fangraphsId === fgId) : null;
      if (promoted) {
        identityTransitions.push({ from: player.id, to: promoted.id, name: player.name, fangraphsId: fgId });
        continue;
      }
      (player.kind === "mlb" ? blockers : warnings).push(`Record missing from candidate: ${player.name} (${player.id}).`);
      continue;
    }
    if (player.kind === "mlb" && incoming.kind !== "mlb") blockers.push(`Unreviewed MLB reclassification: ${player.name} (${player.id}).`);
    const paths = player.contractScenario?.options?.map(option => option.id) ?? [];
    const incomingPaths = new Set(incoming.contractScenario?.options?.map(option => option.id) ?? []);
    if (paths.some(path => !incomingPaths.has(path))) blockers.push(`Contract paths removed: ${player.name}.`);
  }
  if (candidate.meta?.baseYear !== current.meta?.baseYear) blockers.push("Base year changed; projection and discount clocks require review.");
  if (!Number.isFinite(candidate.meta?.seasonRemainingFraction) || candidate.meta.seasonRemainingFraction < 0 || candidate.meta.seasonRemainingFraction > 1) blockers.push("Invalid remaining-season fraction.");
  const counts = { mlb: 0, prospect: 0 };
  for (const player of candidate.players) if (player.kind in counts) counts[player.kind]++;
  if (counts.mlb !== candidate.meta?.mlbCount || counts.prospect !== candidate.meta?.prospectCount) blockers.push("Player counts do not match the candidate metadata.");
  return {
    readyForPromotion: blockers.length === 0 && warnings.length === 0,
    currentAsOf: current.meta?.refreshed,
    candidateAsOf: candidate.meta?.refreshed,
    currentCount: current.players.length,
    candidateCount: candidate.players.length,
    blockers, warnings, identityTransitions,
  };
}
