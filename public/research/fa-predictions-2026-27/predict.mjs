import fs from "node:fs";
const root = process.argv[2];
const vm = await import(`${root}/lib/value-model.mjs`);
const ag = await import(`${root}/lib/aging-curve.mjs`);
const db = JSON.parse(fs.readFileSync(`${root}/app/data/player-database.json`, "utf8"));
const S = { ...vm.initialSettings, dollarsPerWar: Number(process.env.DPW ?? vm.initialSettings.dollarsPerWar), starPremium: Number(process.env.STAR ?? vm.initialSettings.starPremium), relieverPremium: 0 };
const RP_PREM = Number(process.env.RELIEVER_PREMIUM ?? 0), RP_MIN = Number(process.env.RELIEVER_MIN_WAR ?? 0.8);
const mvs = (p, season) => vm.marketValueForSeason(p, season, (vm.isReliever(p) && season.war > RP_MIN) ? { ...S, relieverPremium: RP_PREM } : S, db);
const base = db.meta.baseYear, r = S.timingPreference / 100;
const norm = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z]/gi, "").toLowerCase();
const byName = new Map(); for (const p of db.players) if (p.kind === "mlb") { const k = norm(p.name); if (!byName.has(k)) byName.set(k, []); byName.get(k).push(p); }
function warPath(p, years = 12) {
  const t = Object.fromEntries((p.threeYearProjection ?? []).map(x => [x.year, x.war])); const am = p.agingModel ?? {}; const anchor = am.anchorYear ?? 2028;
  const role = ag.agingRole(am.role ?? p.role ?? "position"); const unit = ag.agingUnit(role).amount; const out = {};
  for (let y = base + 1; y <= base + years; y++) {
    // Published ZiPS seasons always win; later seasons age forward from the last published season.
    if (t[y] !== undefined && y > base) { out[y] = t[y]; continue; }
    const pub = Object.keys(t).map(Number).filter(k => k > base && t[k] !== undefined);
    const last = pub.length ? Math.max(...pub) : anchor;
    let war = t[last] ?? 0, rate = war, wl = unit;
    for (let k = 1; k <= y - last; k++) { const age = am.baseAge + (last - anchor) + k;
      const tw = am.rateTrend == null ? 0 : 0.35 * Math.pow(0.6, k - 1); rate += ag.empiricalRateChange(role, age, p.position) * (1 - tw) + (am.rateTrend ?? 0) * tw;
      const rw = am.workloadRetention == null ? 0 : 0.5 * Math.pow(0.6, k - 1); wl *= ag.workloadRetention(role, age) * (1 - rw) + (am.workloadRetention ?? 1) * rw; war = rate * wl / unit; }
    out[y] = Math.max(-0.5, Math.round(war * 10) / 10);
  }
  return out;
}
const extra = process.argv[5] ? JSON.parse(fs.readFileSync(process.argv[5], "utf8")) : [];
for (const x of extra) { const k = norm(x.player.name); byName.set(k, [x.player]); }
const list = [...fs.readFileSync(process.argv[3], "utf8").trim().split("\n").map(l => { const [pos, name, note] = l.split("|"); return { pos, name, note }; }), ...extra.map(x => ({ pos: x.listPos, name: x.player.name, note: x.note }))];
const out = [], missing = [];
for (const it of list) {
  const c = byName.get(norm(it.name)) ?? []; if (!c.length) { missing.push(it.name); continue; }
  const p = c[0]; const am = p.agingModel ?? {}; const anchor = am.anchorYear ?? 2028;
  const age27 = am.baseAge != null ? am.baseAge - (anchor - 2027) : p.age + 1;
  const pitcher = /P/.test(p.position) && !/^(C|1B|2B|3B|SS|OF|LF|CF|RF|DH)/.test(p.position);
  const reliever = vm.isReliever(p);
  const minWar = reliever ? 0.5 : 1.0, maxAge = pitcher ? 36 : 37;
  const path = it.path ?? warPath(p); const ys = Object.keys(path).map(Number); const w0 = path[2027];
  // Term rule (pre-registered): eligible consecutive seasons, capped by role x 2027 WAR band and by age.
  let cap;
  if (reliever) cap = w0 < 1.0 ? 2 : w0 < 1.5 ? 3 : 4;
  else if (pitcher) cap = w0 < 2.0 ? 2 : w0 < 3.0 ? 4 : w0 < 4.5 ? 6 : 8;
  else cap = w0 < 2.0 ? 2 : w0 < 3.0 ? 4 : w0 < 4.0 ? 6 : w0 < 5.0 ? 8 : 10;
  if (age27 >= 36) cap = 1; else if (age27 >= 34) cap = Math.min(cap, 2);
  // Elite exception: projected 4.5+ WAR players get up to 10 years and an age limit of 39 (40 for hitters),
  // in line with the longest recent deals for players of that level (Cole 9 at 29, Yamamoto 12 at 25).
  const elite = w0 >= 4.5; if (elite) cap = 10;
  const ageLimit = elite ? maxAge + 3 : maxAge;
  let term = 0; for (const y of ys) { const age = age27 + (y - 2027); if (path[y] >= minWar && age <= ageLimit && term < cap) term++; else break; }
  term = Math.max(1, term);
  if (process.env.FORCE_TERM_NAME && norm(it.name) === norm(process.env.FORCE_TERM_NAME)) term = Number(process.env.FORCE_TERM);
  const mv = ys.map(y => mvs(p, { year: y, war: path[y] }));
  const pv = mv.slice(0, term).reduce((s, v, i) => s + v / Math.pow(1 + r, i + 1), 0);
  const ann = Array.from({ length: term }, (_, i) => 1 / Math.pow(1 + r, i + 1)).reduce((a, b) => a + b, 0);
  const aav = pv / ann;
  out.push({ name: it.name, dbName: p.name, id: p.id, team: p.team, listPos: it.pos, dbPos: p.position, role: p.role, reliever, age27, note: it.note, term, aav: +aav.toFixed(1), total: +(aav * term).toFixed(1), war: ys.slice(0, Math.max(term, 3)).map(y => path[y]), mv27: +mv[0].toFixed(1), dupes: c.length });
}
out.sort((a, b) => b.total - a.total);
fs.writeFileSync(process.argv[4], JSON.stringify({ generated: new Date().toISOString(), settings: S, dbRefreshed: db.meta.refreshed, rows: out, missing }, null, 1));
for (const [i, x] of out.slice(0, 45).entries()) console.log(`${i + 1}. ${x.name} (${x.team} ${x.dbPos}, ${x.age27}) ${x.term}y/$${x.total}M AAV $${x.aav}M | WAR ${x.war.slice(0, 4).join("/")} | ${x.note}`);
console.log("missing:", missing.join(", "));
