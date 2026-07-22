const clamp = (value, minimum, maximum) =>
  Math.min(maximum, Math.max(minimum, value));

const numeric = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

export function agingRole(role) {
  if (role === "starter") return "starter";
  if (role === "reliever") return "reliever";
  return "position";
}

export function agingPositionGroup(position) {
  const tokens = String(position ?? "")
    .toUpperCase()
    .split(/[\/,-]/)
    .map((token) => token.trim());
  if (tokens.includes("C")) return "catcher";
  if (tokens.some((token) => ["SS", "2B", "CF"].includes(token)))
    return "up-the-middle";
  return "corner";
}

export function agingUnit(role) {
  if (role === "starter") return { workload: "IP", amount: 180, label: "180 IP" };
  if (role === "reliever") return { workload: "IP", amount: 65, label: "65 IP" };
  return { workload: "PA", amount: 600, label: "600 PA" };
}

export function empiricalRateChange(role, age, position) {
  const normalizedRole = agingRole(role);
  if (normalizedRole === "starter") {
    if (age <= 26) return 0;
    if (age <= 29) return -0.1;
    if (age <= 32) return -0.2;
    if (age <= 35) return -0.3;
    if (age <= 38) return -0.4;
    return -0.5;
  }
  if (normalizedRole === "reliever") {
    if (age <= 26) return 0;
    if (age <= 29) return -0.03;
    if (age <= 32) return -0.06;
    if (age <= 35) return -0.1;
    if (age <= 38) return -0.14;
    return -0.18;
  }

  let change =
    age <= 26
      ? 0.05
      : age <= 29
        ? -0.12
        : age <= 32
          ? -0.22
          : age <= 35
            ? -0.35
            : age <= 38
              ? -0.45
              : -0.6;
  const positionGroup = agingPositionGroup(position);
  if (positionGroup === "catcher" && age >= 30) change -= 0.08;
  if (positionGroup === "up-the-middle") {
    if (age >= 36) change -= 0.1;
    else if (age >= 33) change -= 0.05;
    else if (age >= 30) change -= 0.03;
  }
  return change;
}

export function workloadRetention(role, age) {
  const normalizedRole = agingRole(role);
  if (normalizedRole === "starter") {
    if (age <= 26) return 0.99;
    if (age <= 29) return 0.98;
    if (age <= 32) return 0.97;
    if (age <= 35) return 0.95;
    if (age <= 38) return 0.92;
    return 0.86;
  }
  if (normalizedRole === "reliever") {
    if (age <= 26) return 0.995;
    if (age <= 29) return 0.99;
    if (age <= 32) return 0.985;
    if (age <= 35) return 0.97;
    if (age <= 38) return 0.94;
    return 0.9;
  }
  if (age <= 26) return 0.99;
  if (age <= 29) return 0.985;
  if (age <= 32) return 0.975;
  if (age <= 35) return 0.965;
  if (age <= 38) return 0.94;
  return 0.88;
}

function projectionWorkload(projection, role) {
  const unit = agingUnit(agingRole(role));
  const fallback = unit.amount;
  return Math.max(1, numeric(projection?.[unit.workload], fallback));
}

function trendBounds(role) {
  const normalizedRole = agingRole(role);
  if (normalizedRole === "starter") return [-1, 0.4];
  if (normalizedRole === "reliever") return [-0.4, 0.2];
  return [-1, 0.3];
}

function retentionBounds(role) {
  const normalizedRole = agingRole(role);
  if (normalizedRole === "starter") return [0.75, 1.02];
  if (normalizedRole === "reliever") return [0.8, 1.05];
  return [0.85, 1.02];
}

export function agingProjectionSummary({
  baseProjection,
  priorProjection,
  baseAge,
  role,
  position,
}) {
  const normalizedRole = agingRole(role);
  const unit = agingUnit(normalizedRole);
  const baseWorkload = projectionWorkload(baseProjection, normalizedRole);
  const baseWar = numeric(baseProjection?.WAR);
  const priorWorkload = priorProjection
    ? projectionWorkload(priorProjection, normalizedRole)
    : null;
  const priorWar = priorProjection ? numeric(priorProjection.WAR) : null;
  const [minimumTrend, maximumTrend] = trendBounds(normalizedRole);
  const rateTrend =
    priorWorkload && priorWar !== null
      ? clamp(
          (baseWar / baseWorkload - priorWar / priorWorkload) * unit.amount,
          minimumTrend,
          maximumTrend,
        )
      : null;
  const [minimumRetention, maximumRetention] = retentionBounds(normalizedRole);
  const recentRetention = priorWorkload
    ? clamp(baseWorkload / priorWorkload, minimumRetention, maximumRetention)
    : null;
  return {
    method: "ZiPS-anchored nonlinear aging v2",
    role: normalizedRole,
    profile:
      normalizedRole === "position"
        ? agingPositionGroup(position)
        : normalizedRole,
    unitLabel: unit.label,
    baseAge: numeric(baseAge),
    rateTrend:
      rateTrend === null ? null : Number(rateTrend.toFixed(2)),
    workloadRetention:
      recentRetention === null
        ? null
        : Number(recentRetention.toFixed(3)),
  };
}

export function projectWithAging({
  baseProjection,
  priorProjection,
  baseAge,
  role,
  position,
  yearsOut,
}) {
  const normalizedRole = agingRole(role);
  const unit = agingUnit(normalizedRole);
  const summary = agingProjectionSummary({
    baseProjection,
    priorProjection,
    baseAge,
    role: normalizedRole,
    position,
  });
  let projectedWar = numeric(baseProjection?.WAR);
  let projectedWorkload = projectionWorkload(baseProjection, normalizedRole);
  let rate = (projectedWar / projectedWorkload) * unit.amount;

  for (let year = 1; year <= Math.max(0, yearsOut); year += 1) {
    const age = numeric(baseAge) + year;
    const populationRateChange = empiricalRateChange(
      normalizedRole,
      age,
      position,
    );
    const trendWeight =
      summary.rateTrend === null ? 0 : 0.35 * Math.pow(0.6, year - 1);
    const rateChange =
      populationRateChange * (1 - trendWeight) +
      numeric(summary.rateTrend) * trendWeight;
    rate += rateChange;

    const populationRetention = workloadRetention(normalizedRole, age);
    const retentionWeight =
      summary.workloadRetention === null
        ? 0
        : 0.5 * Math.pow(0.6, year - 1);
    const retention =
      populationRetention * (1 - retentionWeight) +
      numeric(summary.workloadRetention, 1) * retentionWeight;
    projectedWorkload *= retention;
    projectedWar = (rate * projectedWorkload) / unit.amount;
  }

  return {
    war: Math.max(-0.5, Number(projectedWar.toFixed(1))),
    workload: Number(projectedWorkload.toFixed(1)),
    workloadScale: Number(
      (projectedWorkload /
        projectionWorkload(baseProjection, normalizedRole)).toFixed(4),
    ),
    rate: Number(rate.toFixed(2)),
  };
}

export function projectWarWithAging(args) {
  return projectWithAging(args).war;
}
