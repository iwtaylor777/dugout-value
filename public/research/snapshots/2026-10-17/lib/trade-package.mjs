export const MAX_CASH_AMOUNT = 1_000;
// Package uncertainty contains both shared model risk and player-specific risk.
// A 40% error-correlation assumption is intentionally conservative: a
// multi-player return diversifies some scouting/injury risk, but never pretends
// the assets are independent or that the projection system itself is certain.
export const PACKAGE_SHARED_RISK = 0.4;

export function normalizeCashAmount(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return 0;
  return Math.round(Math.min(MAX_CASH_AMOUNT, Math.max(0, amount)) * 100) / 100;
}

export function packageValue(ids, cash, values, field = "total") {
  return (
    normalizeCashAmount(cash) +
    ids.reduce((sum, id) => sum + (Number(values[id]?.[field]) || 0), 0)
  );
}

export function packageRange(
  ids,
  cash,
  values,
  sharedRisk = PACKAGE_SHARED_RISK,
) {
  const total = packageValue(ids, cash, values);
  const correlation = Math.min(1, Math.max(0, Number(sharedRisk) || 0));
  const downside = [];
  const upside = [];
  for (const id of ids) {
    const value = values[id];
    if (!value) continue;
    const center = Number(value.total) || 0;
    const low = Number(value.low);
    const high = Number(value.high);
    downside.push(
      Math.max(0, center - (Number.isFinite(low) ? low : center)),
    );
    upside.push(
      Math.max(0, (Number.isFinite(high) ? high : center) - center),
    );
  }
  const combine = (widths) => {
    const sum = widths.reduce((totalWidth, width) => totalWidth + width, 0);
    const squares = widths.reduce(
      (totalSquares, width) => totalSquares + width * width,
      0,
    );
    return Math.sqrt(correlation * sum * sum + (1 - correlation) * squares);
  };
  return {
    total,
    low: total - combine(downside),
    high: total + combine(upside),
    sharedRisk: correlation,
  };
}

const HEADLINER_VALUE = 50;
const HEADLINER_RATIO = 0.65;
const CLOSE_PACKAGE_RATIO = 0.75;

function packageShape(ids, cash, values) {
  const assets = ids
    .map((id) => ({ id, value: Number(values[id]?.total) || 0 }))
    .sort((left, right) => right.value - left.value);
  return {
    assets,
    total: packageValue(ids, cash, values),
    headliner: assets[0] ?? null,
    positiveAssetCount: assets.filter((asset) => asset.value > 0).length,
  };
}

// A context flag, never a hidden package penalty. Comparable totals do not
// guarantee comparable trade construction when one club is consolidating
// several lesser assets into a genuinely elite one.
export function packageConsolidation(leftIds, leftCash, rightIds, rightCash, values) {
  const left = packageShape(leftIds, leftCash, values);
  const right = packageShape(rightIds, rightCash, values);
  if (!left.headliner || !right.headliner) return null;

  const [headlinerSide, returnSide, headliner, returning] =
    left.headliner.value >= right.headliner.value
      ? ["left", right, left.headliner, right.headliner]
      : ["right", left, right.headliner, left.headliner];
  const largerTotal = Math.max(left.total, right.total, 0);
  const smallerTotal = Math.min(left.total, right.total);
  const packagesAreClose =
    largerTotal > 0 && smallerTotal / largerTotal >= CLOSE_PACKAGE_RATIO;
  const returnIsQuantity = returnSide.positiveAssetCount >= 2;
  const materialHeadlinerGap = returning.value <= headliner.value * HEADLINER_RATIO;

  if (
    headliner.value < HEADLINER_VALUE ||
    !packagesAreClose ||
    !returnIsQuantity ||
    !materialHeadlinerGap
  )
    return null;

  return {
    headlinerSide,
    headlinerId: headliner.id,
    headlinerValue: headliner.value,
    returningHeadlinerId: returning.id,
    returningHeadlinerValue: returning.value,
  };
}
