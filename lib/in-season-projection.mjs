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

export function buildInSeasonTalentUpdate({ role, providers }) {
  const config = ROLE_CONFIG[role];
  if (!config) return null;
  const changes = (providers ?? []).flatMap((provider) => {
    const baselineRate = projectionRate(provider.preseason, role);
    const updatedRate = projectionRate(provider.updated, role);
    if (baselineRate === null || updatedRate === null) return [];
    return [
      {
        name: provider.name,
        baselineRate: rounded(baselineRate),
        updatedRate: rounded(updatedRate),
        changeRate: rounded(updatedRate - baselineRate),
      },
    ];
  });
  if (!changes.length) return null;

  const rawRateChange =
    changes.reduce((sum, provider) => sum + provider.changeRate, 0) /
    changes.length;
  const rateChange = clamp(
    rawRateChange,
    -config.maximumRateChange,
    config.maximumRateChange,
  );

  return {
    method: "Rolling talent update v1",
    role,
    unit: config.unit,
    unitLabel: config.unitLabel,
    rateChange: rounded(rateChange),
    rawRateChange: rounded(rawRateChange),
    providerCount: changes.length,
    capped: Math.abs(rateChange - rawRateChange) > 0.001,
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
