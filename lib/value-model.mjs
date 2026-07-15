export const initialSettings = Object.freeze({
  dollarsPerWar: 12,
  regularRosterWar: 0.5,
  relieverRosterWar: 0.2,
  timingPreference: 0,
  starPremium: 30,
  starThreshold: 2,
  deadlineBoost: 0,
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

const prospectRankBandCache = new WeakMap();

function prospectRankBands(database) {
  if (!database || typeof database !== "object") return new Map();
  const cached = prospectRankBandCache.get(database);
  if (cached) return cached;
  const bands = new Map();
  for (const candidate of database.players ?? []) {
    const rank = Number(candidate.rank);
    if (candidate.kind !== "prospect" || !(rank > 0)) continue;
    const current = bands.get(candidate.fv) ?? { minimum: rank, maximum: rank };
    current.minimum = Math.min(current.minimum, rank);
    current.maximum = Math.max(current.maximum, rank);
    bands.set(candidate.fv, current);
  }
  prospectRankBandCache.set(database, bands);
  return bands;
}

export function prospectRankAdjustment(player, database) {
  const rank = Number(player?.rank);
  if (!(rank > 0)) return 0;
  const band = prospectRankBands(database).get(player.fv);
  if (!band || band.maximum <= band.minimum) return 0;
  const withinTier = Math.min(
    1,
    Math.max(0, (rank - band.minimum) / (band.maximum - band.minimum)),
  );
  // Keep ordinal rank subordinate to the scouting grade: best-to-worst within
  // an FV tier spans only +5% to -5%.
  return 0.05 - withinTier * 0.1;
}

// Calibrated against the 2026 first-year arbitration class. The centered
// coefficients keep the model reproducible while preserving the different
// statistics that arbitration rewards for hitters, starters, and relievers.
const arbitrationModels = Object.freeze({
  position: {
    keys: ["pa", "hr", "rbi", "sb", "avg", "war"],
    intercept: 2.7792,
    means: [386.958, 11.396, 40.875, 8.792, 0.238, 1.168],
    deviations: [191.82, 9.133, 25.076, 10.958, 0.038, 1.408],
    coefficients: [0.4032, 0.404, 0.3233, 0.0209, -0.0833, 0.3443],
  },
  starter: {
    keys: ["ip", "gs", "w", "era", "so", "war"],
    intercept: 2.7583,
    means: [119.258, 21.167, 6.167, 4.395, 105.417, 1.346],
    deviations: [59.513, 10.707, 3.848, 0.896, 54.776, 1.351],
    coefficients: [0.1884, 0.2114, 0.143, -0.2191, 0.1833, 0.153],
  },
  reliever: {
    keys: ["ip", "g", "sv", "hld", "era", "so"],
    intercept: 1.4296,
    means: [54.954, 54.458, 2.958, 12.458, 3.863, 58.375],
    deviations: [18.378, 18.982, 5.095, 7.916, 1.537, 22.317],
    coefficients: [0.0257, 0.0006, 0.4124, 0.1869, -0.0111, -0.0047],
  },
});

const arbitrationWarFallbacks = Object.freeze({
  position: { intercept: 2.7792, mean: 1.168, deviation: 1.408, slope: 1.0667 },
  starter: { intercept: 2.7583, mean: 1.346, deviation: 1.351, slope: 0.9141 },
  reliever: { intercept: 1.4296, mean: 0.528, deviation: 0.588, slope: 0.2857 },
});

export const isReliever = (player) => {
  if (player.role) return player.role === "reliever";
  const roles = player.position.split(/[\/,]/).map((role) => role.trim());
  return roles.includes("RP") && !roles.includes("SP");
};

export function estimateFirstArbitrationSalary(
  player,
  metrics,
  inflation = 1,
) {
  const role = isReliever(player)
    ? "reliever"
    : player.role === "starter"
      ? "starter"
      : "position";
  const model = arbitrationModels[role];
  const hasRoleMetrics =
    metrics && model.keys.every((key) => Number.isFinite(Number(metrics[key])));
  let estimate;
  if (hasRoleMetrics) {
    estimate = model.keys.reduce(
      (salary, key, index) =>
        salary +
        model.coefficients[index] *
          ((Number(metrics[key]) - model.means[index]) /
            model.deviations[index]),
      model.intercept,
    );
  } else {
    const fallback = arbitrationWarFallbacks[role];
    const war = Math.max(0, Number(metrics?.war) || 0);
    estimate =
      fallback.intercept +
      fallback.slope * ((war - fallback.mean) / fallback.deviation);
  }
  const war = Math.max(0, Number(metrics?.war) || 0);
  const elitePremium =
    role === "position"
      ? Math.pow(Math.max(0, war - 3.5), 2)
      : role === "starter"
        ? 0.75 * Math.pow(Math.max(0, war - 3), 2)
        : 0;
  return Math.min(
    15 * inflation,
    Math.max(0.8 * inflation, (estimate + elitePremium) * inflation),
  );
}

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
  const starThreshold = settings.starThreshold * seasonShare;
  const standardWar = Math.min(netWar, starThreshold);
  const starWar = Math.max(0, netWar - starThreshold);
  const curvedValue =
    standardWar * settings.dollarsPerWar +
    starWar *
      settings.dollarsPerWar *
      (1 + settings.starPremium / 100);
  const bullpenMarket = reliever ? 1 + settings.relieverPremium / 100 : 1;
  const deadlineMarket = season.ros
    ? 1 + (settings.deadlineBoost ?? 0) / 100
    : 1;
  return curvedValue * bullpenMarket * inflation * deadlineMarket;
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
    const rankAdjustment = prospectRankAdjustment(player, database);
    const total =
      (tier.value *
        (settings.dollarsPerWar / 12) *
        (1 + player.adjustment / 100) *
        (1 + rankAdjustment) *
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
      prospectRankAdjustment: rankAdjustment * 100,
      expectedWar: tier.war,
      starOdds: tier.star,
      deadlineAdjustment: 0,
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
    const baselineMarket = marketValueForSeason(
      player,
      season,
      { ...settings, deadlineBoost: 0 },
      database,
    );
    const floor = settings.minimumSalary * inflation;
    let salary = season.salary;

    if (season.salaryMode === "prearb") salary = salary || floor;
    if (season.salaryMode.startsWith("arb")) {
      const previousSeason = index ? seasons[index - 1] : null;
      const previousWar = index
        ? previousSeason.war
        : (player.platformWar ?? season.war);
      const platformWar =
        season.year === baseYear + 1
          ? (player.platformWar ?? previousWar)
          : previousWar;
      const boundedWar = Math.max(0, Math.min(4, platformWar));
      if (season.salaryMode === "arb1") {
        salary = Math.max(
          floor,
          estimateFirstArbitrationSalary(
            player,
            { ...(previousSeason?.arbMetrics ?? {}), war: platformWar },
            inflation,
          ),
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
    const seasonSurplus = (fieldValue) => {
      if (contractMode === "clubOption")
        return Math.max(fieldValue - salary, -buyout);
      if (contractMode === "playerOption")
        return Math.min(fieldValue - salary, 0);
      if (contractMode === "mutualOption") return -buyout;
      if (contractMode === "vestingOption")
        return (
          ((season.optionProbability ?? 50) / 100) *
            (fieldValue - salary) +
          (1 - (season.optionProbability ?? 50) / 100) * -buyout
        );
      return fieldValue - salary;
    };
    const rawSurplus = seasonSurplus(market);
    const baselineSurplus = seasonSurplus(baselineMarket);
    rows.push({
      year: season.year,
      war: season.war,
      market,
      salary,
      surplus: rawSurplus * timingFactor,
      deadlineAdjustment: (rawSurplus - baselineSurplus) * timingFactor,
    });
  });

  const projectionTotal = rows.reduce((sum, row) => sum + row.surplus, 0);
  const projectionDeadlineAdjustment = rows.reduce(
    (sum, row) => sum + row.deadlineAdjustment,
    0,
  );
  const lastProspect = player.lastProspect;
  const prospectTier = lastProspect
    ? (prospectValues[lastProspect.fv]?.[
        player.position.includes("P") ? "Pitcher" : "Hitter"
      ] ?? null)
    : null;
  const rookieRankAdjustment = lastProspect
    ? prospectRankAdjustment(lastProspect, database)
    : 0;
  const prospectTotal = prospectTier
    ? prospectTier.value *
      (settings.dollarsPerWar / 12) *
      (1 + rookieRankAdjustment) *
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
  const deadlineAdjustment =
    player.rookieMode === "prospect" && prospectTotal !== undefined
      ? 0
      : player.rookieMode === "blend" && prospectTotal !== undefined
        ? projectionDeadlineAdjustment * (1 - prospectWeight)
        : projectionDeadlineAdjustment;
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
    prospectRankAdjustment: rookieRankAdjustment * 100,
    rookieAdjustment: total - projectionTotal,
    deadlineAdjustment,
    horizonRisk: horizonRisk * 100,
    low: total >= 0 ? total * (1 - uncertainty) : total * (1 + uncertainty),
    high: total >= 0 ? total * (1 + uncertainty) : total * (1 - uncertainty),
    rows,
  };
}
