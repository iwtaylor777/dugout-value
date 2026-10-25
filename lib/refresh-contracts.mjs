export function depthChartControlContract(assignment, { baseYear, remainingFraction }) {
  if ((!assignment?.activeRoster && !assignment?.on40Man) || !assignment.serviceTimeKnown) return null;
  const completedService = Math.max(0, Math.floor(assignment.serviceTime));
  // A roster entry does not grant another controlled year to a veteran.
  if (completedService >= 6) return null;
  const firstYear = baseYear + (remainingFraction === 0 ? 1 : 0);
  return {
    summary: { playerName: assignment.playerName, playerId: assignment.playerId, age: assignment.age },
    summaries: [],
    years: Array.from({ length: 6 - completedService }, (_, index) => {
      const arbitrationYear = Math.max(0, completedService + index - 2);
      return { Season: firstYear + index, Type: arbitrationYear ? `ARB ${arbitrationYear}` : "PRE-ARB", ArbYear: arbitrationYear, Salary: 780000 };
    }),
    incentives: [], notes: "", team: assignment.team, estimatedControl: true,
  };
}

export function applyReviewedContractPaths(player, registry, baseYear, projectionForYear) {
  const entry = registry.entries.find(item => `mlb-${item.mlbamId}` === player.id);
  if (!entry) return player;
  if (entry.baseYear !== baseYear || entry.team !== player.team) throw new Error(`Reviewed contract requires reconciliation: ${player.name}`);
  // A provider may keep the option years in its flat payroll schedule while
  // dropping the note that lets us identify the conditional paths. Match any
  // explicit future terms to one coherent reviewed path before replacing them.
  if (!player.contractScenario?.options?.length) {
    // The importer uses $0.78M when a payroll year has no usable salary.
    // That placeholder is not evidence that the contract terms changed.
    const flatOptionYears = player.seasons.filter(season =>
      season.year >= entry.scenario.startYear && season.salary > 0 &&
      !(season.salary === 0.78 && season.annualSalary === 0.78));
    if (flatOptionYears.length && !entry.scenario.options.some(option =>
      flatOptionYears.every(season => {
        const reviewed = option.seasons.find(terms => terms.year === season.year);
        return reviewed && reviewed.salary === season.salary &&
          (season.optionBuyout == null || season.optionBuyout <= 0 || reviewed.optionBuyout === season.optionBuyout);
      })
    )) throw new Error(`Changed flat contract terms require reconciliation: ${player.name}`);
  }
  for (const option of player.contractScenario?.options ?? []) {
    const reviewed = entry.scenario.options.find(path => path.id === option.id);
    if (!reviewed) throw new Error(`New source contract path requires reconciliation: ${player.name}/${option.id}`);
    for (const season of option.seasons ?? []) {
      const terms = reviewed.seasons.find(row => row.year === season.year);
      if (!terms || ["salary", "contractType", "optionBuyout"].some(key => terms[key] !== season[key])) throw new Error(`Changed source contract terms require reconciliation: ${player.name}/${option.id}/${season.year}`);
    }
    if (reviewed.seasons.length !== (option.seasons ?? []).length) throw new Error(`Changed source contract length requires reconciliation: ${player.name}/${option.id}`);
  }
  const scenario = structuredClone(entry.scenario);
  scenario.options = scenario.options.map(option => ({
    ...option,
    seasons: option.seasons.map(terms => {
      const projection = projectionForYear(terms.year);
      if (!projection || !Number.isFinite(projection.war)) throw new Error(`Missing projection for reviewed contract: ${player.name}/${terms.year}`);
      return { ...projection, ...terms };
    }),
  }));
  return {
    ...player,
    seasons: player.seasons.filter(season => season.year < scenario.startYear),
    contractScenario: scenario,
    source: { ...player.source, contract: `${player.source?.contract ?? ""} · reviewed option paths` },
    contractOverride: { version: registry.version, sourceVersion: entry.sourceVersion, sourceSnapshot: entry.sourceSnapshot, sourceSha256: entry.sourceSha256 },
  };
}

// Source absence is not evidence of retirement, free agency, or demotion.
// Preserve the stable record for reconciliation, but never mark it refreshed.
export function reconcileMlbUniverse(current, incoming, { baseYear, remainingFraction, snapshotDate, dispositions }) {
  const ids = new Set(incoming.map(player => player.id));
  const archived = [];
  const carried = current.filter(player => player.kind === "mlb" && !ids.has(player.id)).filter(player => {
    const disposition = dispositions?.entries.find(entry => entry.id === player.id);
    if (disposition && snapshotDate && snapshotDate <= dispositions.validThrough && disposition.effectiveDate <= snapshotDate) {
      archived.push({ ...structuredClone(player), disposition: { ...disposition, validThrough: dispositions.validThrough, sourceSha256: dispositions.sourceSha256 } });
      return false;
    }
    return true;
  }).map(player => {
    const copy = structuredClone(player);
    const expire = season => remainingFraction === 0 && season.year === baseYear && season.ros ? { ...season, war: 0, salary: 0 } : season;
    copy.seasons = copy.seasons.map(expire);
    if (copy.contractScenario) copy.contractScenario.options.forEach(option => { option.seasons = option.seasons.map(expire); });
    if (remainingFraction === 0) {
      copy.threeYearProjection = copy.threeYearProjection?.map(season => season.year === baseYear ? { ...season, war: 0 } : season);
      copy.platformWar = copy.seasonToDateWar;
    }
    copy.refreshStatus = "carried-forward";
    copy.sourceAsOf = player.source?.refreshed;
    copy.refreshReason = "No complete current projection/contract match; review roster and control before promotion.";
    return copy;
  });
  return { players: [...incoming, ...carried], carriedIds: carried.map(player => player.id), archived };
}
