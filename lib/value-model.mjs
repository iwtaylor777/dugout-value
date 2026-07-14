export const initialSettings = Object.freeze({
  dollarsPerWar: 12,
  regularRosterWar: 0.5,
  relieverRosterWar: 0.2,
  timingPreference: 0,
  starPremium: 30,
  relieverPremium: 0,
  inflation: 3,
  minimumSalary: 0.78,
});

export const prospectValues = Object.freeze({
  "70": {
    Hitter: { value: 195, war: 27.5, star: 87.5 },
    Pitcher: { value: 195, war: 27, star: 87.5 },
  },
  "65": {
    Hitter: { value: 95, war: 13.5, star: 40 },
    Pitcher: { value: 95, war: 13.5, star: 40 },
  },
  "60": {
    Hitter: { value: 82, war: 12.5, star: 33 },
    Pitcher: { value: 70, war: 11, star: 21 },
  },
  "55": {
    Hitter: { value: 55, war: 8, star: 17.5 },
    Pitcher: { value: 45, war: 7, star: 7 },
  },
  "50": {
    Hitter: { value: 45, war: 7, star: 13.5 },
    Pitcher: { value: 33.5, war: 5, star: 7 },
  },
  "45+": {
    Hitter: { value: 18.5, war: 3.2, star: 6 },
    Pitcher: { value: 15, war: 2.6, star: 3 },
  },
  "45": {
    Hitter: { value: 14.5, war: 2.5, star: 3.5 },
    Pitcher: { value: 9.5, war: 1.6, star: 1.5 },
  },
  "40+": {
    Hitter: { value: 8, war: 1.2, star: 1.8 },
    Pitcher: { value: 7, war: 1, star: 1 },
  },
  "40": {
    Hitter: { value: 5.5, war: 0.75, star: 0.8 },
    Pitcher: { value: 4, war: 0.55, star: 0.4 },
  },
  "35+": {
    Hitter: { value: 2, war: 0.3, star: 0.4 },
    Pitcher: { value: 1.5, war: 0.25, star: 0.4 },
  },
});

const prospectRosterMultiplier = Object.freeze({
  none: 1,
  rule5: 0.85,
  on40: 0.9,
  crunch: 0.6,
});

export const isReliever = (player) => {
  if (player.role) return player.role === "reliever";
  const roles = player.position.split(/[\/,]/).map((role) => role.trim());
  return roles.includes("RP") && !roles.includes("SP");
};

export function effectiveSeasons(player) {
  const scenario = player.contractScenario;
  if (!scenario) return player.seasons;
  const selected =
    scenario.options.find((option) => option.id === scenario.selectedId) ??
    scenario.options[0];
  return [...player.seasons, ...(selected?.seasons ?? [])];
}

export function marketValueForSeason(player, season, settings, database) {
  const yearsOut = Math.max(0, season.year - database.meta.baseYear);
  const inflation = Math.pow(1 + settings.inflation / 100, yearsOut);
  const seasonShare = season.ros
    ? (database.meta.seasonRemainingFraction ?? 1)
    : 1;
  const reliever = isReliever(player);
  const rosterBurden =
    (reliever ? settings.relieverRosterWar : settings.regularRosterWar) *
    seasonShare;
  const netWar = Math.max(0, season.war - rosterBurden);
  const starThreshold = 2 * seasonShare;
  const standardWar = Math.min(netWar, starThreshold);
  const starWar = Math.max(0, netWar - starThreshold);
  const curvedValue =
    standardWar * settings.dollarsPerWar +
    starWar *
      settings.dollarsPerWar *
      (1 + settings.starPremium / 100);
  const bullpenMarket = reliever ? 1 + settings.relieverPremium / 100 : 1;
  return curvedValue * bullpenMarket * inflation;
}

export function valuePlayer(player, settings, database) {
  const baseYear = database.meta.baseYear;
  if (player.kind === "prospect") {
    const tier =
      prospectValues[player.fv]?.[player.prospectType] ??
      prospectValues["40"][player.prospectType];
    const yearsAway = Math.max(0, player.eta - baseYear);
    const rosterMultiplier =
      prospectRosterMultiplier[player.rosterContext ?? "none"];
    const total =
      (tier.value *
        (settings.dollarsPerWar / 12) *
        (1 + player.adjustment / 100) *
        rosterMultiplier) /
      Math.pow(1 + settings.timingPreference / 100, yearsAway);
    const riskLabel = String(player.riskLabel ?? "Med").toLowerCase();
    const baseUncertainty = riskLabel.startsWith("low")
      ? 0.18
      : riskLabel.startsWith("high")
        ? 0.32
        : 0.24;
    const uncertainty = Math.min(
      0.65,
      baseUncertainty +
        yearsAway * 0.035 +
        (player.prospectType === "Pitcher" ? 0.05 : 0),
    );
    return {
      total,
      low: Math.max(0, total * (1 - uncertainty)),
      high: total * (1 + uncertainty),
      rangeUncertainty: uncertainty * 100,
      expectedWar: tier.war,
      starOdds: tier.star,
      rows: [],
    };
  }

  const rows = [];
  const seasons = effectiveSeasons(player);
  let priorAnnualSalary = 0;
  seasons.forEach((season, index) => {
    const contractMode = season.contractType ?? season.salaryMode;
    const yearsOut = Math.max(0, season.year - baseYear);
    const inflation = Math.pow(1 + settings.inflation / 100, yearsOut);
    const timingFactor =
      1 / Math.pow(1 + settings.timingPreference / 100, yearsOut);
    const market = marketValueForSeason(player, season, settings, database);
    const floor = settings.minimumSalary * inflation;
    let salary = season.salary;

    if (season.salaryMode === "prearb") salary = salary || floor;
    if (season.salaryMode.startsWith("arb")) {
      const previousWar = index
        ? seasons[index - 1].war
        : (player.platformWar ?? season.war);
      const platformWar =
        season.year === baseYear + 1
          ? (player.platformWar ?? previousWar)
          : previousWar;
      const boundedWar = Math.max(0, Math.min(4, platformWar));
      if (season.salaryMode === "arb1" && priorAnnualSalary <= 1.5) {
        salary = Math.max(
          2.5,
          Math.min(12, 1.5 + 1.8 * Math.max(0, platformWar)),
        );
      } else {
        const raise =
          season.salaryMode === "arb2"
            ? 0.1 + 0.04 * boundedWar
            : season.salaryMode === "arb3"
              ? 0.12 + 0.045 * boundedWar
              : 0.15 + 0.05 * boundedWar;
        salary = Math.max(floor, priorAnnualSalary * (1 + raise));
      }
    }

    priorAnnualSalary = season.salaryMode.startsWith("arb")
      ? salary
      : (season.annualSalary ?? salary);
    const buyout = season.optionBuyout ?? 0;
    let rawSurplus = market - salary;
    if (contractMode === "clubOption")
      rawSurplus = Math.max(market - salary, -buyout);
    if (contractMode === "playerOption")
      rawSurplus = Math.min(market - salary, 0);
    if (contractMode === "mutualOption") rawSurplus = -buyout;
    if (contractMode === "vestingOption")
      rawSurplus =
        ((season.optionProbability ?? 50) / 100) * (market - salary) +
        (1 - (season.optionProbability ?? 50) / 100) * -buyout;
    rows.push({
      year: season.year,
      war: season.war,
      market,
      salary,
      surplus: rawSurplus * timingFactor,
    });
  });

  const projectionTotal = rows.reduce((sum, row) => sum + row.surplus, 0);
  const lastProspect = player.lastProspect;
  const prospectTier = lastProspect
    ? (prospectValues[lastProspect.fv]?.[
        player.position.includes("P") ? "Pitcher" : "Hitter"
      ] ?? null)
    : null;
  const prospectTotal = prospectTier
    ? prospectTier.value *
      (settings.dollarsPerWar / 12) *
      Math.max(0, (6 - lastProspect.serviceTime) / 6)
    : undefined;
  const prospectWeight = lastProspect
    ? Math.min(
        0.8,
        Math.pow(0.8, Math.max(0, baseYear - lastProspect.year)) *
          0.8 *
          Math.exp(-lastProspect.serviceTime / 0.75),
      )
    : 0;
  const total =
    player.rookieMode === "prospect" && prospectTotal !== undefined
      ? prospectTotal
      : player.rookieMode === "blend" && prospectTotal !== undefined
        ? projectionTotal * (1 - prospectWeight) +
          prospectTotal * prospectWeight
        : projectionTotal;
  const weightedHorizonNumerator = rows.reduce(
    (sum, row) =>
      sum +
      Math.abs(row.surplus) * Math.max(0, row.year - database.meta.baseYear),
    0,
  );
  const weightedHorizonDenominator = rows.reduce(
    (sum, row) => sum + Math.abs(row.surplus),
    0,
  );
  const weightedHorizon = weightedHorizonDenominator
    ? weightedHorizonNumerator / weightedHorizonDenominator
    : 0;
  const horizonRisk = Math.min(0.15, weightedHorizon * 0.018);
  const uncertainty = Math.min(0.45, 0.1 + player.risk / 200 + horizonRisk);
  return {
    total,
    projectionTotal,
    prospectTotal,
    rookieAdjustment: total - projectionTotal,
    horizonRisk: horizonRisk * 100,
    low: total >= 0 ? total * (1 - uncertainty) : total * (1 + uncertainty),
    high: total >= 0 ? total * (1 + uncertainty) : total * (1 - uncertainty),
    rows,
  };
}
