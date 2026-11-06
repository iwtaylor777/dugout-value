// Reconcile the game snapshot with already-reviewed reported deals/decisions.
// This does not alter the shared player database or turn estimates into reports.
export const contractNameKey = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z]/gi, '').toLowerCase();
const RESOLVED = new Set(['signed', 're-signed', 'opted-in', 'option-exercised', 'qo-accepted']);

export function withReportedGmContract(player, reported, projection, firstYear = 2027) {
  if (player.kind !== 'mlb' || !reported || !RESOLVED.has(reported.outcome)
    || !Number.isInteger(reported.years) || reported.years < 1
    || !Number.isFinite(reported.total_musd) || reported.total_musd <= 0) return player;
  const end = firstYear + reported.years - 1;
  const original = player.seasons ?? [];
  const covered = original.filter(s => s.year >= firstYear && s.year <= end);
  const baseSum = covered.reduce((sum, s) => sum + (s.annualSalary ?? s.salary) - (s.expectedIncentives ?? 0), 0);
  // Keep known uneven salaries when they reconcile with the reported guarantee.
  const keepSchedule = covered.length === reported.years && Math.abs(baseSum - reported.total_musd) < 0.15;
  const guaranteed = Array.from({ length: reported.years }, (_, index) => {
    const year = firstYear + index;
    const old = original.find(s => s.year === year);
    const salary = keepSchedule ? (old.annualSalary ?? old.salary) : reported.total_musd / reported.years + (old?.expectedIncentives ?? 0);
    return {
      ...old, year, war: old?.war ?? projection?.war?.[year] ?? 0,
      salary, annualSalary: salary, salaryMode: 'fixed', contractType: 'fixed',
      ros: false, optionBuyout: 0, optionProbability: 100,
    };
  });
  // Exercising one club option does not erase a later club option. An opt-in or
  // new reported deal does fix its remaining term; drop stale extrapolated rows.
  const later = reported.outcome === 'option-exercised' ? original.filter(s => s.year > end) : [];
  return { ...player, team: reported.team ?? player.team, seasons: [...original.filter(s => s.year < firstYear), ...guaranteed, ...later] };
}
