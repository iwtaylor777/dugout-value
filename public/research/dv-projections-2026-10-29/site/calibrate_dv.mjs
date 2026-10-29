// Refit $/WAR (and star premium) when contract values are built from Dugout Value projection paths instead of
// FanGraphs projections + the standard aging curve. Same pricing (marketValueForSeason), discounting and loss as calibrate.mjs.
import fs from "node:fs";
const root = process.argv[2];
const vm = await import(`${root}/lib/value-model.mjs`);
const ag = await import(`${root}/lib/aging-curve.mjs`);
const deals = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
const db = { meta: { baseYear: 2026, seasonRemainingFraction: 1 } };
const base = { ...vm.initialSettings, valuationView: "offseason" };
function agingPath(w1, age, role, pos, years) {
  const r = ag.agingRole(role), unit = ag.agingUnit(r).amount; let rate = w1, wl = unit; const out = [w1];
  for (let k = 1; k < years; k++) { const a = age + k; rate += ag.empiricalRateChange(r, a, pos); wl *= ag.workloadRetention(r, a); out.push(Math.max(-0.5, rate * wl / unit)); }
  return out;
}
const player = d => ({ role: d.role, position: d.pos, depthPosition: d.role === "reliever" ? "RP" : d.role === "starter" ? "SP" : d.pos });
function aavOf(d, path, S) { let pv = 0, ann = 0; path.forEach((w, i) => { const f = 1 / Math.pow(1 + S.timingPreference / 100, i + 1); pv += vm.marketValueForSeason(player(d), { year: 2026 + i, war: w }, S, db) * f; ann += f; }); return pv / ann; }
const fit = (set, pathFn) => {
  if (!set.length) return { n: 0, status: "No eligible contracts" };
  const res = [];
  for (let D = 6; D <= 18.01; D += 0.25) for (const P of [0, 10, 20, 30, 40]) {
    const S = { ...base, dollarsPerWar: D, starPremium: P }; let s = 0, n = 0;
    for (const d of set) { const m = aavOf(d, pathFn(d), S); if (m <= 0.5) continue; s += Math.log(d.aav / m) ** 2; n++; }
    res.push({ D, P, mse: s / n, n });
  }
  const best = res.reduce((a, b) => (b.mse < a.mse ? b : a));
  const atP20 = res.filter(r => r.P === 20).reduce((a, b) => (b.mse < a.mse ? b : a));
  const at11 = res.find(r => r.P === 20 && Math.abs(r.D - 11) < 1e-9);
  return { n: set.length, scored_at_best: best.n, best: { D: best.D, P: best.P, mse: +best.mse.toFixed(4) }, bestD_atP20: { D: atP20.D, mse: +atP20.mse.toFixed(4) }, mse_at_11_20: +at11.mse.toFixed(4) };
};
const dvAging = d => agingPath(d.w1, d.age, d.role, d.pos, d.yrs);
const dv = d => d.path, fgAging = d => agingPath(d.fg_proj, d.age, d.role, d.pos, d.yrs);
const out = {};
const nonRP = deals.filter(d => d.role !== "reliever");
const c26 = nonRP.filter(d => d.season === 2026 && d.fg_proj != null && d.fg_proj >= 1 && d.w1 >= 1);
out["2026 class, FanGraphs projection + aging curve"] = fit(c26, fgAging);
out["2026 class, Dugout Value paths"] = fit(c26, dv);
out["2026 class, Dugout Value first-year level + standard aging curve"] = fit(c26, dvAging);
const all = nonRP.filter(d => d.w1 >= 1);
const seasons = [...new Set(all.map(d => d.season))].sort();
const period = `${seasons[0]}–${String(seasons.at(-1)).slice(2)}`;
out[`${period}, Dugout Value paths`] = fit(all, dv);
out[`${period}, Dugout Value first year + standard aging curve`] = fit(all, dvAging);
for (const s of seasons) out[`${s}, Dugout Value paths`] = fit(all.filter(d => d.season === s), dv);
console.log(JSON.stringify(out, null, 1));
fs.writeFileSync("calibration_dv_results.json", JSON.stringify(out, null, 1));
