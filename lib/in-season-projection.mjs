const ROLE_CONFIG = {
  position: {
    workloadKey: "PA",
    unit: 600,
    unitLabel: "600 PA",
    minimumWorkload: 75,
    maximumRateChange: 3,
  },
  starter: {
    workloadKey: "IP",
    unit: 180,
    unitLabel: "180 IP",
    minimumWorkload: 20,
    maximumRateChange: 3,
  },
  reliever: {
    workloadKey: "IP",
    unit: 65,
    unitLabel: "65 IP",
    minimumWorkload: 8,
    maximumRateChange: 1.5,
  },
};

// FanGraphs' Off and Def projection components are expressed in runs. A
// 10-runs-per-win conversion is sufficiently accurate for separating a
// hitter's offensive update from changes in projected role/defense. It does
// not replace the WAR projection; it only identifies contradictory signals.
const RUNS_PER_WIN = 10;
const CONTRADICTORY_NONOFFENSE_WEIGHT = 0.5;

// Historical holdouts did not support carrying nearly the entire in-season
// change into future years. Keep half as a transparent, conservative bridge;
// published future ZiPS remains the dominant estimate.
export const NEXT_YEAR_SIGNAL_CARRY = 0.5;
export const ANNUAL_SIGNAL_DECAY = 0.85;

const finiteNumber = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const rounded = (value, digits = 2) =>
  Number(Number(value).toFixed(digits));

const clamp = (value, minimum, maximum) =>
  Math.min(maximum, Math.max(minimum, value));

export function projectionRate(row, role) {
  const config = ROLE_CONFIG[role];
  if (!config || !row) return null;
  const war = finiteNumber(row.WAR);
  const workload = finiteNumber(row[config.workloadKey]);
  if (
    war === null ||
    workload === null ||
    workload < config.minimumWorkload
  )
    return null;
  return (war / workload) * config.unit;
}

function hitterComponentChanges(preseason, updated) {
  const preseasonPa = finiteNumber(preseason?.PA);
  const updatedPa = finiteNumber(updated?.PA);
  const preseasonOff = finiteNumber(preseason?.Off);
  const updatedOff = finiteNumber(updated?.Off);
  if (
    preseasonPa === null ||
    updatedPa === null ||
    preseasonOff === null ||
    updatedOff === null ||
    preseasonPa < ROLE_CONFIG.position.minimumWorkload ||
    updatedPa < ROLE_CONFIG.position.minimumWorkload
  )
    return null;

  return {
    offenseChangeRate:
      ((updatedOff / updatedPa) * ROLE_CONFIG.position.unit -
        (preseasonOff / preseasonPa) * ROLE_CONFIG.position.unit) /
      RUNS_PER_WIN,
  };
}

export function buildInSeasonTalentUpdate({ role, providers }) {
  const config = ROLE_CONFIG[role];
  if (!config) return null;
  const changes = (providers ?? []).flatMap((provider) => {
    const baselineRate = projectionRate(provider.preseason, role);
    const updatedRate = projectionRate(provider.updated, role);
    if (baselineRate === null || updatedRate === null) return [];
    const rawChangeRate = updatedRate - baselineRate;
    const components =
      role === "position"
        ? hitterComponentChanges(provider.preseason, provider.updated)
        : null;
    const offenseChangeRate = components?.offenseChangeRate ?? null;
    const nonoffenseChangeRate =
      offenseChangeRate === null ? null : rawChangeRate - offenseChangeRate;
    const roleGuarded =
      offenseChangeRate !== null &&
      nonoffenseChangeRate !== null &&
      offenseChangeRate * nonoffenseChangeRate < 0 &&
      Math.abs(nonoffenseChangeRate) > Math.abs(offenseChangeRate);
    const changeRate = roleGuarded
      ? offenseChangeRate +
        CONTRADICTORY_NONOFFENSE_WEIGHT * nonoffenseChangeRate
      : rawChangeRate;
    return [
      {
        name: provider.name,
        baselineRate: rounded(baselineRate),
        updatedRate: rounded(updatedRate),
        changeRate: rounded(changeRate),
        rawChangeRate: rounded(rawChangeRate),
        offenseChangeRate:
          offenseChangeRate === null ? null : rounded(offenseChangeRate),
        nonoffenseChangeRate:
          nonoffenseChangeRate === null
            ? null
            : rounded(nonoffenseChangeRate),
        roleGuarded,
      },
    ];
  });
  if (!changes.length) return null;

  const effectiveRateChange =
    changes.reduce((sum, provider) => sum + provider.changeRate, 0) /
    changes.length;
  const rawRateChange =
    changes.reduce((sum, provider) => sum + provider.rawChangeRate, 0) /
    changes.length;
  const rateChange = clamp(
    effectiveRateChange,
    -config.maximumRateChange,
    config.maximumRateChange,
  );

  return {
    method: "Role-aware rolling talent update v2",
    role,
    unit: config.unit,
    unitLabel: config.unitLabel,
    rateChange: rounded(rateChange),
    rawRateChange: rounded(rawRateChange),
    providerCount: changes.length,
    capped: Math.abs(rateChange - effectiveRateChange) > 0.001,
    roleGuarded: changes.some((provider) => provider.roleGuarded),
    providers: changes,
  };
}

export function signalPersistence(year, baseYear) {
  const yearsAhead = Math.max(1, Number(year) - Number(baseYear));
  return (
    NEXT_YEAR_SIGNAL_CARRY *
    Math.pow(ANNUAL_SIGNAL_DECAY, yearsAhead - 1)
  );
}

export function applyInSeasonTalentUpdate({
  baselineWar,
  futureProjection,
  role,
  year,
  baseYear,
  update,
}) {
  const config = ROLE_CONFIG[role];
  const baseline = finiteNumber(baselineWar);
  if (!config || baseline === null || !update) {
    return {
      baselineWar: baseline ?? 0,
      adjustment: 0,
      finalWar: baseline ?? 0,
      persistence: 0,
      workload: null,
    };
  }

  const projectedWorkload = finiteNumber(
    futureProjection?.[config.workloadKey],
  );
  const workload =
    projectedWorkload !== null && projectedWorkload > 0
      ? projectedWorkload
      : config.unit;
  const persistence = signalPersistence(year, baseYear);
  const adjustment =
    update.rateChange * (workload / config.unit) * persistence;

  return {
    baselineWar: rounded(baseline),
    adjustment: rounded(adjustment),
    finalWar: rounded(baseline + adjustment),
    persistence: rounded(persistence, 3),
    workload: rounded(workload, 1),
  };
}
