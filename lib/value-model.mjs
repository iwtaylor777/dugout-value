export const initialSettings = Object.freeze({
  dollarsPerWar: 11,
  regularRosterWar: 0.5,
  relieverRosterWar: 0.2,
  // 10 matches the discount rate FanGraphs used to build its prospect table.
  timingPreference: 10,
  starPremium: 20,
  starThreshold: 2,
  deadlineBoost: 0,
  postseasonStarterBaselineWar: 2,
  postseasonEquivalentSeason: 25,
  relieverPremium: 50,
  // The reliever premium applies only to seasons projected above this many WAR.
  relieverPremiumMinWar: 0.8,
  inflation: 3,
  minimumSalary: 0.78,
  // "offseason" drops the rest-of-2026 season from value; "deadline" keeps the
  // July 31 snapshot behavior. A settings object with no valuationView at all
  // is treated as "deadline" so pre-change callers and links reproduce.
  valuationView: "offseason",
});

export const valuationViews = Object.freeze(["offseason", "deadline"]);

export const normalizeValuationView = (value) =>
  value === "offseason" ? "offseason" : "deadline";

// The FanGraphs FV table is already discounted at 10% a year, so only the
// part of the user's rate above 10% is applied on top of it.
export const FANGRAPHS_PROSPECT_DISCOUNT = 10;

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

// Later arbitration awards are not ordinary percentage raises. A player's
// platform season is re-compared with players in the same arbitration class,
// while the prior salary remains an important anchor. The arb2 and arb3
// factors minimize absolute error against known 2026 salaries when applied to
// the role-specific first-year-equivalent model above. Arb4 is necessarily a
// lighter-sample extrapolation because only Super Two players reach it.
const arbitrationYearFactors = Object.freeze({
  arb1: 1,
  arb2: 1.3,
  arb3: 2.34,
  arb4: 2.7,
});

// Repeat-eligible salaries are path dependent: the CBA expressly permits a
// player's record of past compensation, and historical award ladders behave
// much more like "prior salary plus a performance raise" than independent
// repricing from zero each winter. The raise shares are applied to the same
// role-specific first-year-equivalent estimate used above. We then blend that
// path estimate with the same-service-class estimate so neither one noisy
// platform season nor one unusually high prior award controls the forecast.
const arbitrationRaiseShares = Object.freeze({
  arb2: 0.85,
  arb3: 0.9,
  arb4: 1,
});

const arbitrationPathWeights = Object.freeze({
  arb2: 0.75,
  arb3: 0.7,
  arb4: 0.75,
});

// Record-aware ceilings prevent a single extreme projection from producing an
// award outside the range established by comparable arbitration classes. The
// values are in 2026 dollars and rise with the model's salary inflation input.
const arbitrationYearCaps = Object.freeze({
  arb1: 15,
  arb2: 24,
  arb3: 36,
  arb4: 40,
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

export function estimateArbitrationSalary(
  player,
  salaryMode,
  metrics,
  priorSalary = 0,
  inflation = 1,
  annualInflation = 1,
) {
  const factor = arbitrationYearFactors[salaryMode] ?? 1;
  const cap = (arbitrationYearCaps[salaryMode] ?? 40) * inflation;
  const firstYearEquivalent = estimateFirstArbitrationSalary(
    player,
    metrics,
    inflation,
  );
  const classEstimate = firstYearEquivalent * factor;
  const raiseShare = arbitrationRaiseShares[salaryMode] ?? 0;
  const pathWeight = arbitrationPathWeights[salaryMode] ?? 0;
  const priorSalaryInTargetDollars = priorSalary * annualInflation;
  const pathEstimate =
    priorSalaryInTargetDollars + firstYearEquivalent * raiseShare;
  const blendedEstimate =
    priorSalary > 0 && pathWeight > 0
      ? classEstimate * (1 - pathWeight) + pathEstimate * pathWeight
      : classEstimate;
  // The CBA generally limits a tendered player's maximum salary reduction to
  // 20 percent. This remains a downside guardrail; unlike the old model, prior
  // salary also contributes positively to the central estimate for repeat
  // eligibles. A poor platform year can still leave a player flat or lower.
  const priorSalaryFloor = salaryMode === "arb1" ? 0 : priorSalary * 0.8;
  return Math.min(
    cap,
    Math.max(0.8 * inflation, priorSalaryFloor, blendedEstimate),
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
  // The market pays relievers projected above about 0.8 WAR roughly 50% more
  // per WAR than this model's base price (calibrated on 2020-26 free-agent
  // contracts; the analysis lives outside this repo). Lesser relievers get no
  // premium. A settings object with no relieverPremiumMinWar is treated as 0,
  // so pre-change callers and saved links keep the old every-reliever rule.
  const bullpenMarket =
    reliever && season.war > (settings.relieverPremiumMinWar ?? 0)
      ? 1 + settings.relieverPremium / 100
      : 1;
  const deadlineMarket = season.ros
    ? 1 + (settings.deadlineBoost ?? 0) / 100
    : 1;
  const postseasonRotationValue = postseasonRotationValueForSeason(
    player,
    season,
    settings,
    database,
  );
  return (
    curvedValue * bullpenMarket * inflation * deadlineMarket +
    postseasonRotationValue
  );
}

export function postseasonRotationValueForSeason(
  player,
  season,
  settings,
  database,
) {
  if (
    !season.ros ||
    !(settings.deadlineBoost > 0) ||
    player.role !== "starter"
  )
    return 0;

  const seasonShare = Math.max(
    0.01,
    database.meta.seasonRemainingFraction ?? 1,
  );
  const fullSeasonWarPace = Math.max(0, season.war / seasonShare);
  // This is a net playoff-rotation benchmark rather than a claim that the
  // displaced starter vanishes. Setting it at 2 WAR reflects the quality of a
  // typical contender's fourth starter and the value retained when that arm
  // shifts into a shorter bullpen role.
  const displacedStarterBaseline = Math.max(
    0,
    settings.postseasonStarterBaselineWar ?? 2,
  );
  const postseasonEquivalentSeason = Math.max(
    0,
    (settings.postseasonEquivalentSeason ?? 25) / 100,
  );
  const octoberEquivalentWar =
    Math.max(0, fullSeasonWarPace - displacedStarterBaseline) *
    postseasonEquivalentSeason;
  const starWarPrice =
    settings.dollarsPerWar * (1 + settings.starPremium / 100);
  const yearsOut = Math.max(0, season.year - database.meta.baseYear);
  const inflation = Math.pow(1 + settings.inflation / 100, yearsOut);
  return octoberEquivalentWar * starWarPrice * inflation;
}

const PLAYER_DECISION_MODES = ["playerOption", "mutualOption"];

/**
 * Splits the counted seasons into club control and player-decision years.
 * Club control ends before the first player or mutual option season, the same
 * rule the contract label in the workspace uses. Seasons settled as opted out
 * count nowhere. `controlThrough` keeps its old meaning (last counted season of
 * any kind); `clubControlThrough` stops where the player takes over.
 */
function clubControlFields(seasons, rows) {
  const firstDecisionYear = seasons.find((season) =>
    PLAYER_DECISION_MODES.includes(season.contractType ?? season.salaryMode),
  )?.year;
  const live = rows.filter((row) => !row.optedOut);
  const club = live.filter(
    (row) => firstDecisionYear === undefined || row.year < firstDecisionYear,
  );
  const counted = (list) => list.filter((row) => !row.excluded);
  const controlThrough = live.length
    ? Math.max(...live.map((row) => row.year))
    : null;
  const clubControlThrough = club.length
    ? Math.max(...club.map((row) => row.year))
    : null;
  return {
    controlThrough,
    clubControlThrough,
    playerOptionThrough:
      controlThrough !== null &&
      (clubControlThrough === null || controlThrough > clubControlThrough)
        ? controlThrough
        : null,
    clubControlWar: counted(club).reduce((sum, row) => sum + row.war, 0),
    clubControlSalary: counted(club).reduce((sum, row) => sum + row.salary, 0),
  };
}

function driverFields({
  valuationView,
  controlThrough,
  clubControlThrough = null,
  playerOptionThrough = null,
  clubControlWar = null,
  clubControlSalary = null,
  totalWar,
  totalSalary,
  extrapolatedValue,
  total,
  pendingFreeAgent,
  player,
  valuationBasis,
  prospectWeight,
  excludedRosValue,
}) {
  const rank = Number(player?.futureProjectionUpdate?.rank);
  return {
    valuationView,
    controlThrough,
    clubControlThrough,
    playerOptionThrough,
    clubControlWar,
    clubControlSalary,
    totalWar,
    totalSalary,
    extrapolatedValue,
    extrapolatedShare:
      total > 0 && extrapolatedValue !== undefined
        ? extrapolatedValue / total
        : null,
    excludedRosValue,
    pendingFreeAgent,
    fgTradeValueRank: rank > 0 ? rank : null,
    valuationBasis,
    prospectWeight,
  };
}

export function valuePlayer(player, settings, database) {
  const baseYear = database.meta.baseYear;
  const valuationView = normalizeValuationView(settings.valuationView);
  const offseason = valuationView === "offseason";
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
      Math.pow(
        1 +
          Math.max(0, settings.timingPreference - FANGRAPHS_PROSPECT_DISCOUNT) /
            100,
        yearsAway,
      );
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
      deadlineCurrentWinAdjustment: 0,
      octoberAdjustment: 0,
      rows: [],
      ...driverFields({
        valuationView,
        controlThrough: null,
        totalWar: null,
        totalSalary: null,
        extrapolatedValue: 0,
        total,
        pendingFreeAgent: false,
        player,
        valuationBasis: "prospect grade",
        prospectWeight: 0,
        excludedRosValue: 0,
      }),
    };
  }

  const rows = [];
  const seasons = effectiveSeasons(player);
  // Seasons after the aging-model anchor year are the site's own extrapolation
  // beyond the last published ZiPS season.
  const anchorYear = Number.isFinite(Number(player.agingModel?.anchorYear))
    ? Number(player.agingModel.anchorYear)
    : null;
  let priorAnnualSalary = 0;
  seasons.forEach((season, index) => {
    const contractMode = season.contractType ?? season.salaryMode;
    const yearsOut = Math.max(0, season.year - baseYear);
    const inflation = Math.pow(1 + settings.inflation / 100, yearsOut);
    const timingFactor =
      1 / Math.pow(1 + settings.timingPreference / 100, yearsOut);
    const market = marketValueForSeason(player, season, settings, database);
    const currentWinMarket = marketValueForSeason(
      player,
      season,
      { ...settings, postseasonEquivalentSeason: 0 },
      database,
    );
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
      salary = Math.max(
        floor,
        estimateArbitrationSalary(
          player,
          season.salaryMode,
          { ...(previousSeason?.arbMetrics ?? {}), war: platformWar },
          priorAnnualSalary,
          inflation,
          1 + settings.inflation / 100,
        ),
      );
    }

    priorAnnualSalary = season.salaryMode.startsWith("arb")
      ? salary
      : (season.annualSalary ?? salary);
    const buyout = season.optionBuyout ?? 0;
    // optionBlock marks seasons that belong to one multi-year player option
    // (settled together after the rows are built) rather than a per-season one.
    const isOptionBlock =
      Boolean(season.optionBlock) && contractMode === "playerOption";
    const seasonSurplus = (fieldValue) => {
      if (contractMode === "clubOption")
        return Math.max(fieldValue - salary, -buyout);
      if (contractMode === "playerOption")
        return isOptionBlock ? fieldValue - salary : Math.min(fieldValue - salary, 0);
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
    const currentWinSurplus = seasonSurplus(currentWinMarket);
    const baselineSurplus = seasonSurplus(baselineMarket);
    // Offseason view drops the rest-of-2026 season from value. The row stays
    // in the table, marked excluded, so the UI can show what was left out.
    const excluded = offseason && Boolean(season.ros);
    const counted = (amount) => (excluded ? 0 : amount * timingFactor);
    rows.push({
      year: season.year,
      war: season.war,
      market,
      salary,
      surplus: counted(rawSurplus),
      deadlineAdjustment: counted(rawSurplus - baselineSurplus),
      deadlineCurrentWinAdjustment: counted(currentWinSurplus - baselineSurplus),
      octoberAdjustment: counted(rawSurplus - currentWinSurplus),
      excluded,
      excludedSurplus: excluded ? rawSurplus * timingFactor : 0,
      optionBlock: isOptionBlock,
      optedOut: false,
      extrapolated: anchorYear !== null && season.year > anchorYear,
    });
  });

  // An optionBlock is one all-or-nothing player option covering several
  // seasons (Soto's post-2029 opt-out). The player decides once, so the club
  // keeps the block only when it costs more than it returns at the central
  // projection; otherwise the player opts out and the club keeps nothing. A
  // per-season "playerOption" would let the player skip only the good years.
  const blockRows = rows.filter((row) => row.optionBlock);
  if (blockRows.length) {
    const blockSurplus = blockRows.reduce((sum, row) => sum + row.surplus, 0);
    const optsOut = blockSurplus >= 0;
    for (const row of blockRows) {
      row.optedOut = optsOut;
      if (optsOut) {
        row.surplus = 0;
        row.deadlineAdjustment = 0;
        row.deadlineCurrentWinAdjustment = 0;
        row.octoberAdjustment = 0;
      }
    }
  }
  const projectionTotal = rows.reduce((sum, row) => sum + row.surplus, 0);
  const projectionDeadlineAdjustment = rows.reduce(
    (sum, row) => sum + row.deadlineAdjustment,
    0,
  );
  const projectionDeadlineCurrentWinAdjustment = rows.reduce(
    (sum, row) => sum + row.deadlineCurrentWinAdjustment,
    0,
  );
  const projectionOctoberAdjustment = rows.reduce(
    (sum, row) => sum + row.octoberAdjustment,
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
  const deadlineCurrentWinAdjustment =
    player.rookieMode === "prospect" && prospectTotal !== undefined
      ? 0
      : player.rookieMode === "blend" && prospectTotal !== undefined
        ? projectionDeadlineCurrentWinAdjustment * (1 - prospectWeight)
        : projectionDeadlineCurrentWinAdjustment;
  const octoberAdjustment =
    player.rookieMode === "prospect" && prospectTotal !== undefined
      ? 0
      : player.rookieMode === "blend" && prospectTotal !== undefined
        ? projectionOctoberAdjustment * (1 - prospectWeight)
        : projectionOctoberAdjustment;
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
  const projectionScale =
    player.rookieMode === "prospect" && prospectTotal !== undefined
      ? 0
      : player.rookieMode === "blend" && prospectTotal !== undefined
        ? 1 - prospectWeight
        : 1;
  const countedRows = rows.filter((row) => !row.excluded && !row.optedOut);
  const extrapolatedValue =
    rows
      .filter((row) => row.extrapolated)
      .reduce((sum, row) => sum + row.surplus, 0) * projectionScale;
  const excludedRosValue =
    rows.reduce((sum, row) => sum + row.excludedSurplus, 0) * projectionScale;
  const valuationBasis =
    player.rookieMode === "prospect" && prospectTotal !== undefined
      ? "prospect grade"
      : player.rookieMode === "blend" && prospectTotal !== undefined
        ? "projection blended with prospect grade"
        : "projection";
  return {
    total,
    projectionTotal,
    prospectTotal,
    prospectRankAdjustment: rookieRankAdjustment * 100,
    rookieAdjustment: total - projectionTotal,
    deadlineAdjustment,
    deadlineCurrentWinAdjustment,
    octoberAdjustment,
    horizonRisk: horizonRisk * 100,
    low: total >= 0 ? total * (1 - uncertainty) : total * (1 + uncertainty),
    high: total >= 0 ? total * (1 + uncertainty) : total * (1 - uncertainty),
    rows,
    ...driverFields({
      valuationView,
      ...clubControlFields(seasons, rows),
      totalWar: countedRows.reduce((sum, row) => sum + row.war, 0),
      totalSalary: countedRows.reduce((sum, row) => sum + row.salary, 0),
      extrapolatedValue,
      total,
      pendingFreeAgent: offseason && countedRows.length === 0,
      player,
      valuationBasis,
      prospectWeight: valuationBasis === "projection" ? 0 : prospectWeight,
      excludedRosValue,
    }),
  };
}
