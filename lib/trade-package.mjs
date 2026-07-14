export const MAX_CASH_AMOUNT = 1_000;

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
