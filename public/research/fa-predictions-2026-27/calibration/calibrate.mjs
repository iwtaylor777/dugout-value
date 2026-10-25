// Fit the trade model's $/WAR and star premium to past free-agent contracts (2026 signings, FanGraphs projection at
// signing), using the site's own pricing (marketValueForSeason) and aging curves. Zero-surplus AAV over the actual term.
import fs from "node:fs";
const root = process.argv[2];
const vm = await import(`${root}/lib/value-model.mjs`);
const ag = await import(`${root}/lib/aging-curve.mjs`);
const raw = JSON.parse(fs.readFileSync("raw/fg_fa_tracker_2020_2027.json", "utf8"));
const marcel = JSON.parse(fs.readFileSync("raw/signings_marcel.json", "utf8"));
const db = { meta: { baseYear: 2026, seasonRemainingFraction: 1 } };
const roleOf = p => { const f = (p || "").toUpperCase().split("/")[0]; return f === "RP" || f === "CL" ? "reliever" : f === "SP" ? "starter" : "position"; };
function path(w1, age, role, pos, years) {
  const r = ag.agingRole(role), unit = ag.agingUnit(r).amount; let rate = w1, wl = unit; const out = [w1];
  for (let k = 1; k < years; k++) { const a = age + k; rate += ag.empiricalRateChange(r, a, pos); wl *= ag.workloadRetention(r, a); out.push(Math.max(-0.5, rate * wl / unit)); }
  return out;
}
function modelAav(d, S) {
  const player = { role: d.role, position: d.pos, depthPosition: d.role === "reliever" ? "RP" : d.role === "starter" ? "SP" : d.pos };
  const ws = path(d.w, d.age, d.role, d.pos, d.yrs); let pv = 0, ann = 0;
  ws.forEach((w, i) => { const v = vm.marketValueForSeason(player, { year: 2026 + i, war: w }, S, db); const f = 1 / Math.pow(1 + S.timingPreference / 100, i + 1); pv += v * f; ann += f; });
  return pv / ann;
}
// 2026 signings with FanGraphs' projection at signing (primary); 2021-25 with a 5/4/3 WAR proxy (robustness)
const deals = [];
for (const r of raw) {
  if (r.ContractType !== "Free Agent" || !r.ContractTotal || !r.YearsTotal || r.tracker_season > 2026) continue;
  const aav = r.ContractTotal / r.YearsTotal / 1e6 * Math.pow(1.03, 2026 - r.tracker_season);
  if (aav < 2) continue;
  let w = r.war_proj, src = "fg_proj";
  if (w == null) { const m = marcel.find(x => x.name === r.playerName && x.season === r.tracker_season); if (!m) continue; w = m.w; src = "proxy"; }
  deals.push({ name: r.playerName, season: r.tracker_season, role: roleOf(r.position), pos: (r.position || "").split("/")[0], age: r.age, w, yrs: r.YearsTotal, aav, src });
}
console.log("deals:", deals.length, "with FG projection:", deals.filter(d => d.src === "fg_proj").length);
const base = { ...vm.initialSettings, valuationView: "offseason" };
function loss(set, S) { let s = 0, n = 0; for (const d of set) { const m = modelAav(d, S); if (m <= 0.5) continue; s += Math.pow(Math.log(d.aav / m), 2); n++; } return { mse: s / n, n }; }
function ratio(set, S) { let a = 0, m = 0; for (const d of set) { a += d.aav; m += modelAav(d, S); } return a / m; }
const out = {};
for (const [label, set] of [["fg_proj_2026_nonRP_w>=1", deals.filter(d => d.src === "fg_proj" && d.role !== "reliever" && d.w >= 1)], ["proxy_2021_25_nonRP_w>=1", deals.filter(d => d.src === "proxy" && d.season >= 2021 && d.role !== "reliever" && d.w >= 1)]]) {
  let best = null; const grid = [];
  for (let D = 6; D <= 14.01; D += 0.5) for (let P = 0; P <= 40; P += 5) { const S = { ...base, dollarsPerWar: D, starPremium: P }; const l = loss(set, S); grid.push({ D, P, ...l }); if (!best || l.mse < best.mse) best = { D, P, ...l }; }
  const cur = loss(set, base);
  const byP = [0, 10, 15, 20, 30].map(P => { const g = grid.filter(x => x.P === P).sort((a, b) => a.mse - b.mse)[0]; return { P, bestD: g.D, mse: +g.mse.toFixed(4) }; });
  out[label] = { n: set.length, current: { D: 12, P: 30, mse: +cur.mse.toFixed(4), ratio: +ratio(set, base).toFixed(3) }, best: { D: best.D, P: best.P, mse: +best.mse.toFixed(4) }, bestDByStarPremium: byP };
  console.log(label, JSON.stringify(out[label]));
}
// Stars: deals with projected WAR >= 4 under candidate settings
const stars = deals.filter(d => d.role !== "reliever" && d.w >= 3.5);
for (const [D, P] of [[12, 30], [10, 20], [10, 15], [9.5, 15], [9, 10]]) {
  const S = { ...base, dollarsPerWar: D, starPremium: P };
  console.log(`stars (w>=3.5, n=${stars.length}) D=${D} P=${P}: actual/model ${ratio(stars, S).toFixed(2)} | all non-RP w>=1: ${ratio(deals.filter(d => d.role !== "reliever" && d.w >= 1), S).toFixed(2)}`);
}
fs.writeFileSync("calibration_results.json", JSON.stringify(out, null, 1));
