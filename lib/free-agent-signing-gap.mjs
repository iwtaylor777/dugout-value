/**
 * @param {{years?: number | null, total_musd?: number | null}} signing
 * @param {{years: number, total: number}[]} values
 */
export function signedContractGap(signing, values) {
  const { years, total_musd: total } = signing;
  if (years == null || !Number.isInteger(years) || years < 1 || total == null || !Number.isFinite(total)) return null;
  const matched = values.find(value => value.years === years && Number.isFinite(value.total));
  return matched ? total - matched.total : null;
}
