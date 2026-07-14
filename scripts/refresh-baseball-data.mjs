import { mkdir, writeFile } from "node:fs/promises";

const BASE_YEAR = 2026;
const OUT = new URL("../app/data/player-database.json", import.meta.url);
const boardUrl = "https://www.fangraphs.com/prospects/the-board/";
const graduatesUrl = "https://www.fangraphs.com/prospects/the-board/2025-graduates";
const projectionUrl = (type, stats) => `https://www.fangraphs.com/projections?pos=all&stats=${stats}&type=${type}`;
const historyUrl = (stats) => `https://www.fangraphs.com/api/leaders/major-league/data?pos=all&stats=${stats}&lg=all&qual=0&type=8&season=2025&season1=2023&ind=1&pageitems=10000&pagenum=1`;

const teamSlugs = {
  ARI: "diamondbacks", ATL: "braves", BAL: "orioles", BOS: "red-sox", CHC: "cubs",
  CHW: "white-sox", CIN: "reds", CLE: "guardians", COL: "rockies", DET: "tigers",
  HOU: "astros", KCR: "royals", LAA: "angels", LAD: "dodgers", MIA: "marlins",
  MIL: "brewers", MIN: "twins", NYM: "mets", NYY: "yankees", ATH: "athletics",
  PHI: "phillies", PIT: "pirates", SDP: "padres", SEA: "mariners", SFG: "giants",
  STL: "cardinals", TBR: "rays", TEX: "rangers", TOR: "blue-jays", WSN: "nationals",
};

const normalizeTeam = (team) => ({ KC: "KCR", SD: "SDP", SF: "SFG", TB: "TBR", WSH: "WSN", CWS: "CHW", OAK: "ATH" }[team] ?? team);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const seasonStart = new Date("2026-03-25T12:00:00Z");
const seasonEnd = new Date("2026-09-27T12:00:00Z");
const snapshotDate = new Date();
const seasonRemainingFraction = Math.max(0, Math.min(1, (seasonEnd - snapshotDate) / (seasonEnd - seasonStart)));

async function getNextData(url) {
  const response = await fetch(url, { headers: { "user-agent": "DugoutValueDataRefresh/1.0 (public-source snapshot; one request per page)" } });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  const html = await response.text();
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!match) throw new Error(`No __NEXT_DATA__ payload: ${url}`);
  return JSON.parse(match[1]).props.pageProps.dehydratedState.queries;
}

const queryData = (queries, key) => queries.find((query) => query.queryKey?.[0] === key)?.state?.data;

async function loadHistory(stats) {
  const response = await fetch(historyUrl(stats), { headers: { "user-agent": "DugoutValueDataRefresh/1.0 (public-source snapshot)" } });
  if (!response.ok) throw new Error(`History download failed: ${response.status}`);
  const payload = await response.json();
  return (payload.data ?? []).map((row) => ({ ...row, _stats: stats }));
}

async function loadProjection(type) {
  const rows = [];
  for (const stats of ["bat", "pit"]) {
    const queries = await getNextData(projectionUrl(type, stats));
    const data = queryData(queries, "/projections");
    if (!Array.isArray(data)) throw new Error(`Projection payload missing for ${type}/${stats}`);
    rows.push(...data.map((row) => ({ ...row, _stats: stats })));
  }
  return rows;
}

function ageWar(war, age, isPitcher, yearsOut) {
  let projected = Number(war) || 0;
  let currentAge = Number.isFinite(age) ? age : (isPitcher ? 28 : 27);
  for (let year = 0; year < yearsOut; year += 1) {
    currentAge += 1;
    if (isPitcher) projected += currentAge <= 26 ? 0 : currentAge <= 29 ? -0.15 : -0.3;
    else projected += currentAge <= 26 ? 0.15 : currentAge === 27 ? 0 : currentAge <= 31 ? -0.25 : -0.4;
  }
  return Math.max(-0.5, Number(projected.toFixed(1)));
}

function marcelWar(rows) {
  const weights = { 2023: 3, 2024: 4, 2025: 5 };
  let weightedWar = 1.2 * 4; // regression toward a modest regular-player baseline
  let totalWeight = 4;
  for (const row of rows) {
    const weight = weights[row.Season] ?? 0;
    weightedWar += (Number(row.WAR) || 0) * weight;
    totalWeight += weight;
  }
  return Number((weightedWar / totalWeight).toFixed(1));
}

function salaryMode(type, arbYear) {
  const label = String(type ?? "").toUpperCase();
  if (label.includes("PRE-ARB") || label.includes("NOT 40")) return "prearb";
  if (label.includes("ARB")) return `arb${Math.min(4, Math.max(1, Number(arbYear) || Number(label.match(/\d/)?.[0]) || 1))}`;
  return "fixed";
}

function prospectGrade(value) {
  const raw = String(value ?? "40").replace(".0", "");
  if (["70", "65", "60", "55", "50", "45+", "45", "40+", "40", "35+"].includes(raw)) return raw;
  const number = Number.parseFloat(raw) || 40;
  if (number >= 70) return "70";
  if (number >= 65) return "65";
  if (number >= 60) return "60";
  if (number >= 55) return "55";
  if (number >= 50) return "50";
  if (number >= 45) return "45";
  if (number >= 40) return "40";
  return "35+";
}

console.log("Loading ZiPS, Steamer RoS, three-year history, and FanGraphs prospect data…");
const [zips, steamer, steamerRos, hitterHistory, pitcherHistory, boardQueries, graduateQueries] = await Promise.all([
  loadProjection("zips"),
  loadProjection("steamer"),
  loadProjection("steamerr"),
  loadHistory("bat"),
  loadHistory("pit"),
  getNextData(boardUrl),
  getNextData(graduatesUrl),
]);

const boardRows = queryData(boardQueries, "prospects/the-board");
const graduateRows = queryData(graduateQueries, "prospects/the-board");
const teamRows = queryData(boardQueries, "useTeamInfoBySeason");
if (!Array.isArray(boardRows) || !Array.isArray(graduateRows) || !Array.isArray(teamRows)) throw new Error("The Board payload is incomplete");

const contracts = new Map();
for (const [abbr, slug] of Object.entries(teamSlugs)) {
  console.log(`Loading ${abbr} payroll…`);
  const queries = await getNextData(`https://www.fangraphs.com/roster-resource/payroll/${slug}`);
  const payroll = queryData(queries, "roster-resource/payroll2020/data");
  for (const contract of payroll?.dataContract ?? []) {
    const summary = contract.contractSummary;
    const id = String(summary?.MLBAMID ?? "");
    if (!id) continue;
    const years = (contract.contractYears ?? []).filter((year) => year.Season >= BASE_YEAR && year.Season <= BASE_YEAR + 9 && String(year.Type).toUpperCase() !== "FREE AGENT");
    const existing = contracts.get(id);
    if (!existing || years.length > existing.years.length) contracts.set(id, { summary, years, team: abbr });
  }
  await sleep(120);
}

const steamerById = new Map(steamer.map((row) => [String(row.xMLBAMID || row.playerid), row]));
const steamerRosById = new Map(steamerRos.map((row) => [String(row.xMLBAMID || row.playerid), row]));
const zipsById = new Map(zips.map((row) => [String(row.xMLBAMID || row.playerid), row]));
const lastProspectByFgId = new Map();
for (const row of [...boardRows, ...graduateRows]) {
  const fgId = String(row.PlayerId || row.UPID || "");
  if (!fgId || !(row.cFV || row.FV_Current)) continue;
  const existing = lastProspectByFgId.get(fgId);
  if (!existing || Number(row.Season) >= Number(existing.Season)) lastProspectByFgId.set(fgId, row);
}
const historyById = new Map();
for (const row of [...hitterHistory, ...pitcherHistory]) {
  const id = String(row.xMLBAMID || "");
  if (!id) continue;
  historyById.set(id, [...(historyById.get(id) ?? []), row]);
}
const projectionIds = new Set([...zipsById.keys(), ...steamerById.keys(), ...contracts.keys()]);
const mlb = [];

for (const id of projectionIds) {
  const history = historyById.get(id) ?? [];
  const latestHistory = history.sort((a, b) => b.Season - a.Season)[0];
  const contract = contracts.get(id);
  const primary = zipsById.get(id) ?? steamerById.get(id) ?? (contract ? {
    xMLBAMID: id,
    PlayerName: contract.summary.playerName,
    Team: contract.team,
    positionDB: latestHistory?.positionDB || latestHistory?.position || "UTIL",
    WAR: marcelWar(history),
    _stats: latestHistory?._stats || "bat",
  } : null);
  if (!primary) continue;
  const backup = steamerById.get(id);
  const team = normalizeTeam(primary?.Team || backup?.Team);
  if (!teamSlugs[team]) continue;
  const matchedContract = contract ?? contracts.get(String(primary?.xMLBAMID || backup?.xMLBAMID || ""));
  // Keep the major-league library aligned to current RosterResource payroll/control pages.
  // The full minor-league universe is supplied separately by The Board.
  if (!matchedContract) continue;
  const age = Number(matchedContract.summary?.age) || null;
  const isPitcher = primary?._stats === "pit";
  const rosProjection = steamerRosById.get(id);
  const contractYears = matchedContract.years.length ? matchedContract.years : [{ Season: BASE_YEAR, Type: "PRE-ARB", Salary: 780000, ArbYear: 0 }];
  const source = zipsById.has(id) ? "ZiPS" : steamerById.has(id) ? "Steamer" : "Marcel + aging";
  const currentWar = Number(primary?.WAR ?? backup?.WAR ?? 0);
  const fgId = String(primary?.playerid || backup?.playerid || matchedContract.summary?.playerId || "");
  const lastProspect = lastProspectByFgId.get(fgId);
  const seasons = contractYears.map((year) => {
    const season = Number(year.Season);
    const annualSalary = Number(((year.ArbSalaryProjection || year.Salary || 780000) / 1_000_000).toFixed(2));
    return {
      year: season,
      war: season === BASE_YEAR
        ? Number((Number(rosProjection?.WAR ?? currentWar * seasonRemainingFraction)).toFixed(1))
        : ageWar(currentWar, age, isPitcher, season - BASE_YEAR),
      salary: season === BASE_YEAR ? Number((annualSalary * seasonRemainingFraction).toFixed(2)) : (String(year.Type).toUpperCase().includes("ARB") ? 0 : annualSalary),
      annualSalary,
      salaryMode: season === BASE_YEAR ? "fixed" : salaryMode(year.Type, year.ArbYear),
      ros: season === BASE_YEAR,
    };
  });
  mlb.push({
    id: `mlb-${primary?.xMLBAMID || primary?.playerid}`,
    kind: "mlb",
    name: primary?.PlayerName || primary?.ShortName,
    team,
    position: primary?.positionDB || primary?.minpos || (isPitcher ? "P" : "UTIL"),
    age: age ? Math.floor(age) : (isPitcher ? 28 : 27),
    source: { projection: `Steamer RoS (2026) · ${source} future`, contract: "FanGraphs RosterResource", refreshed: new Date().toISOString().slice(0, 10) },
    risk: isPitcher ? 12 : 7,
    seasons,
    rookieMode: lastProspect && Number(lastProspect.servicetime || 99) < 1 ? "blend" : "projection",
    lastProspect: lastProspect && Number(lastProspect.servicetime || 99) < 1 ? {
      fv: prospectGrade(lastProspect.cFV || lastProspect.FV_Current),
      rank: Number(lastProspect.Ovr_Rank || lastProspect.cOVR) || null,
      year: Number(lastProspect.Season) || 2025,
      serviceTime: Number(lastProspect.servicetime) || 0,
      risk: lastProspect.cRisk || lastProspect.Variance || null,
    } : null,
  });
}

const prospects = boardRows
  .filter((row) => teamSlugs[normalizeTeam(row.Team)] && row.playerName)
  .map((row) => ({
    id: `prospect-${row.PlayerId || row.ID}`,
    kind: "prospect",
    name: row.playerName,
    team: normalizeTeam(row.Team),
    position: row.positionDB || row.Position || "—",
    age: Math.floor(Number(row.Age) || 20),
    source: { projection: "FanGraphs The Board", contract: "Not applicable", refreshed: new Date().toISOString().slice(0, 10) },
    prospectType: String(row.positionDB || row.Position).includes("P") ? "Pitcher" : "Hitter",
    fv: prospectGrade(row.cFV || row.FV_Current),
    eta: Number(row.cETA || row.ETA_Current) || BASE_YEAR + 1,
    adjustment: 0,
    rank: Number(row.Ovr_Rank) || null,
    riskLabel: row.cRisk || row.Variance || null,
  }));

const teams = teamRows
  .map((team) => ({ abbr: normalizeTeam(team.AbbName), name: team.FullName }))
  .filter((team) => teamSlugs[team.abbr])
  .sort((a, b) => a.name.localeCompare(b.name));

const players = [...mlb, ...prospects].sort((a, b) => a.team.localeCompare(b.team) || a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name));
const output = {
  meta: {
    refreshed: new Date().toISOString().slice(0, 10),
    baseYear: BASE_YEAR,
    mlbCount: mlb.length,
    prospectCount: prospects.length,
    projectionPriority: ["ZiPS", "Steamer", "Marcel + aging"],
    seasonRemainingFraction: Number(seasonRemainingFraction.toFixed(4)),
    sources: ["FanGraphs projections", "FanGraphs RosterResource", "FanGraphs The Board"],
  },
  teams,
  players,
};

await mkdir(new URL("../app/data/", import.meta.url), { recursive: true });
await writeFile(OUT, `${JSON.stringify(output)}\n`);
console.log(`Wrote ${players.length} players (${mlb.length} MLB, ${prospects.length} prospects) to ${OUT.pathname}`);
