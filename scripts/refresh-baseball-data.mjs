import { mkdir, writeFile } from "node:fs/promises";
import {
  normalizeProspectRisk,
  prospectRosterContext,
} from "../lib/prospect-context.mjs";
import { tradeProtectionForPlayer } from "../lib/contract-context.mjs";
import {
  activeAvailabilityByMlbId,
  availabilityRiskAdjustment,
} from "../lib/availability-context.mjs";
import { rosterAssignmentsFromDepthChart } from "../lib/roster-position.mjs";
import {
  applyInSeasonTalentUpdate,
  buildInSeasonTalentUpdate,
  signalPersistence,
} from "../lib/in-season-projection.mjs";
import {
  agingProjectionSummary,
  projectWithAging,
} from "../lib/aging-curve.mjs";
import { loadTradeValueZiPS } from "../lib/fangraphs-trade-value-zips.mjs";
import { loadSoxProspects } from "../lib/soxprospects.mjs";

const BASE_YEAR = 2026;
const OUT = new URL("../app/data/player-database.json", import.meta.url);
const PLAYOFF_ODDS_OUT = new URL(
  "../app/data/playoff-odds.json",
  import.meta.url,
);
const boardUrl = "https://www.fangraphs.com/prospects/the-board/";
const graduatesUrl =
  "https://www.fangraphs.com/prospects/the-board/2025-graduates";
const injuryReportUrl =
  "https://www.fangraphs.com/roster-resource/injury-report/dodgers";
const playoffOddsUrl =
  "https://www.fangraphs.com/standings/playoff-odds/fg/mlb";
const projectionUrl = (type, stats) =>
  `https://www.fangraphs.com/projections?pos=all&stats=${stats}&type=${type}`;
const historyUrl = (stats) =>
  `https://www.fangraphs.com/api/leaders/major-league/data?pos=all&stats=${stats}&lg=all&qual=0&type=8&season=2026&season1=2023&ind=1&pageitems=10000&pagenum=1`;

const teamSlugs = {
  ARI: "diamondbacks",
  ATL: "braves",
  BAL: "orioles",
  BOS: "red-sox",
  CHC: "cubs",
  CHW: "white-sox",
  CIN: "reds",
  CLE: "guardians",
  COL: "rockies",
  DET: "tigers",
  HOU: "astros",
  KCR: "royals",
  LAA: "angels",
  LAD: "dodgers",
  MIA: "marlins",
  MIL: "brewers",
  MIN: "twins",
  NYM: "mets",
  NYY: "yankees",
  ATH: "athletics",
  PHI: "phillies",
  PIT: "pirates",
  SDP: "padres",
  SEA: "mariners",
  SFG: "giants",
  STL: "cardinals",
  TBR: "rays",
  TEX: "rangers",
  TOR: "blue-jays",
  WSN: "nationals",
};

const normalizeTeam = (team) =>
  ({
    KC: "KCR",
    SD: "SDP",
    SF: "SFG",
    TB: "TBR",
    WSH: "WSN",
    CWS: "CHW",
    OAK: "ATH",
  })[team] ?? team;
const normalizeIdentity = (name, team) =>
  `${String(name ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/gi, "")
    .toLowerCase()}::${normalizeTeam(team)}`;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const seasonStart = new Date("2026-03-25T12:00:00Z");
const seasonEnd = new Date("2026-09-27T12:00:00Z");
const snapshotDate = new Date();
const snapshotParts = Object.fromEntries(
  new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .formatToParts(snapshotDate)
    .map((part) => [part.type, part.value]),
);
const snapshotLabel = `${snapshotParts.year}-${snapshotParts.month}-${snapshotParts.day}`;
const seasonRemainingFraction = Math.max(
  0,
  Math.min(1, (seasonEnd - snapshotDate) / (seasonEnd - seasonStart)),
);

async function getNextData(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent":
        "DugoutValueDataRefresh/1.0 (public-source snapshot; one request per page)",
    },
  });
  if (!response.ok)
    throw new Error(`${response.status} ${response.statusText}: ${url}`);
  const html = await response.text();
  const match = html.match(
    /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/,
  );
  if (!match) throw new Error(`No __NEXT_DATA__ payload: ${url}`);
  return JSON.parse(match[1]).props.pageProps.dehydratedState.queries;
}

const queryData = (queries, key) =>
  queries.find((query) => query.queryKey?.[0] === key)?.state?.data;

async function loadHistory(stats) {
  const response = await fetch(historyUrl(stats), {
    headers: {
      "user-agent": "DugoutValueDataRefresh/1.0 (public-source snapshot)",
    },
  });
  if (!response.ok)
    throw new Error(`History download failed: ${response.status}`);
  const payload = await response.json();
  return (payload.data ?? []).map((row) => ({ ...row, _stats: stats }));
}

async function loadProjection(type) {
  const rows = [];
  for (const stats of ["bat", "pit"]) {
    const queries = await getNextData(projectionUrl(type, stats));
    const data = queryData(queries, "/projections");
    if (!Array.isArray(data))
      throw new Error(`Projection payload missing for ${type}/${stats}`);
    rows.push(...data.map((row) => ({ ...row, _stats: stats })));
  }
  return rows;
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

function hasRecentPlayingRecord(rows) {
  return rows.some(
    (row) =>
      Number(row.Season) >= BASE_YEAR - 1 &&
      [row.G, row.PA, row.IP].some((value) => Number(value) > 0),
  );
}

function salaryMode(type, arbYear) {
  const label = String(type ?? "").toUpperCase();
  if (label.includes("CLUB OPTION")) return "clubOption";
  if (label.includes("PLAYER OPTION")) return "playerOption";
  if (label.includes("MUTUAL OPTION")) return "mutualOption";
  if (label.includes("VESTING")) return "vestingOption";
  if (label.includes("PRE-ARB") || label.includes("NOT 40")) return "prearb";
  if (label.includes("ARB"))
    return `arb${Math.min(4, Math.max(1, Number(arbYear) || Number(label.match(/\d/)?.[0]) || 1))}`;
  return "fixed";
}

function firstOptOutYear(summary) {
  const note =
    typeof summary === "string" ? summary : fullContractNote(summary);
  if (!/opt[ -]?out/i.test(note)) return null;
  const years = [...note.matchAll(/20\d{2}/g)].map((match) =>
    Number(match[0]),
  );
  return years.length ? Math.min(...years) : null;
}

function fullContractNote(summary) {
  return [
    summary?.ContractSummaryPayrollNote,
    summary?.LongContractSummaryPayrollNote,
    summary?.NoTradeNotes,
  ]
    .filter(Boolean)
    .join(" ");
}

function numberFromWord(value) {
  const words = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
    eleven: 11,
    twelve: 12,
  };
  return words[String(value).toLowerCase()] ?? Number(value);
}

function multiYearOptionTerms(note, optionName) {
  const patterns = [
    new RegExp(
      `${optionName}\\s+(?:for\\s+)?([a-z]+|\\d+)\\s+years?\\s+(?:and|for)\\s+\\$?([\\d.]+)\\s*(?:million|m)`,
      "i",
    ),
    new RegExp(
      `([a-z]+|\\d+)\\s+years?\\s*[/,]\\s*\\$?([\\d.]+)\\s*(?:million|m)?.{0,24}${optionName}`,
      "i",
    ),
  ];
  for (const pattern of patterns) {
    const match = String(note).match(pattern);
    if (!match) continue;
    const years = numberFromWord(match[1]);
    const total = Number(match[2]);
    if (Number.isFinite(years) && years > 0 && Number.isFinite(total))
      return { years, total };
  }
  return null;
}

function hasInjuryConditionalOption(note) {
  return (
    /option (?:is )?conditional/i.test(note) ||
    /option may only be exercised[\s\S]{0,180}(?:injur|surgery|healthy)/i.test(
      note,
    )
  );
}

function pitcherRole(row) {
  const games = Number(row?.G) || 0;
  const starts = Number(row?.GS) || 0;
  if (!games) return "starter";
  return starts / games < 0.35 ? "reliever" : "starter";
}

function depthChartContract(assignment) {
  if (!assignment?.activeRoster) return null;
  const completedService = Math.max(0, Math.floor(assignment.serviceTime || 0));
  const remainingYears = Math.max(1, 6 - completedService);
  return {
    summary: {
      playerName: assignment.playerName,
      playerId: assignment.playerId,
      age: assignment.age,
    },
    summaries: [],
    years: Array.from({ length: remainingYears }, (_, index) => {
      const serviceYear = completedService + index;
      const arbitrationYear = Math.max(0, serviceYear - 2);
      return {
        Season: BASE_YEAR + index,
        Type:
          arbitrationYear > 0
            ? `ARB ${Math.min(4, arbitrationYear)}`
            : "PRE-ARB",
        ArbYear: Math.min(4, arbitrationYear),
        Salary: 780000,
      };
    }),
    incentives: [],
    notes: "",
    team: assignment.team,
  };
}

function projectedPlayingTime(
  metric,
  triggerYear,
  history,
  rosProjection,
  future2027,
  future2028,
  fallback,
  isPitcher,
) {
  if (triggerYear === BASE_YEAR) {
    const ytd = history
      .filter((row) => Number(row.Season) === BASE_YEAR)
      .reduce((sum, row) => sum + (Number(row[metric]) || 0), 0);
    return ytd + (Number(rosProjection?.[metric]) || 0);
  }
  if (triggerYear === BASE_YEAR + 1)
    return Number(future2027?.[metric] ?? fallback?.[metric]) || 0;
  const longRange = Number(future2028?.[metric] ?? fallback?.[metric]) || 0;
  if (triggerYear === BASE_YEAR + 2) return longRange;
  const yearsBeyondExplicit = Math.max(0, triggerYear - (BASE_YEAR + 2));
  return (
    longRange * Math.pow(isPitcher ? 0.93 : 0.96, yearsBeyondExplicit)
  );
}

function arbitrationMetrics(role, rows, projection, scale = 1) {
  const sources = [...rows, projection].filter(Boolean);
  if (!sources.length) return undefined;
  const total = (key) =>
    sources.reduce((sum, row) => sum + (Number(row?.[key]) || 0), 0) *
    scale;
  const war = total("WAR");
  if (role === "position") {
    const atBats = total("AB");
    const hits = total("H");
    return {
      pa: Number(total("PA").toFixed(1)),
      hr: Number(total("HR").toFixed(1)),
      rbi: Number(total("RBI").toFixed(1)),
      sb: Number(total("SB").toFixed(1)),
      avg: Number(
        (atBats ? hits / atBats : Number(projection?.AVG) || 0).toFixed(3),
      ),
      war: Number(war.toFixed(1)),
    };
  }
  const innings = total("IP");
  const earnedRuns = total("ER");
  const common = {
    ip: Number(innings.toFixed(1)),
    era: Number(
      (innings
        ? (earnedRuns * 9) / innings
        : Number(projection?.ERA) || 4.5
      ).toFixed(2),
    ),
    so: Number(total("SO").toFixed(1)),
    war: Number(war.toFixed(1)),
  };
  if (role === "reliever")
    return {
      ...common,
      g: Number(total("G").toFixed(1)),
      sv: Number(total("SV").toFixed(1)),
      hld: Number(total("HLD").toFixed(1)),
    };
  return {
    ...common,
    gs: Number(total("GS").toFixed(1)),
    w: Number(total("W").toFixed(1)),
  };
}

function playingTimeProbability(expected, threshold, metric) {
  const spread = { PA: 60, IP: 24, G: 8, GS: 5 }[metric] ?? threshold * 0.12;
  return 1 / (1 + Math.exp(-(expected - threshold) / spread));
}

function expectedPlayingTimeIncentives(groups, context) {
  const bySeason = new Map();
  for (const group of groups ?? []) {
    for (const incentive of group.data ?? []) {
      if (String(incentive.type).toUpperCase() !== "PLAYING TIME") continue;
      const targetSeason = Number(incentive.season);
      if (targetSeason < BASE_YEAR) continue;
      const match = String(incentive.desc).match(
        /(\d+(?:\.\d+)?)\s*(PA|IP|GS|G)\s+in\s+(20\d{2})/i,
      );
      if (!match) continue;
      const status = String(incentive.reached ?? "PENDING").toUpperCase();
      let probability = 0;
      if (status.includes("NOT") || status.includes("FAIL")) probability = 0;
      else if (status.includes("REACHED")) probability = 1;
      else {
        const [, threshold, rawMetric, triggerYear] = match;
        const metric = rawMetric.toUpperCase();
        const expected = projectedPlayingTime(
          metric,
          Number(triggerYear),
          context.history,
          context.rosProjection,
          context.future2027,
          context.future2028,
          context.fallback,
          context.isPitcher,
        );
        probability = playingTimeProbability(
          expected,
          Number(threshold),
          metric,
        );
      }
      const expectedValue = (Number(incentive.value) || 0) * probability;
      bySeason.set(
        targetSeason,
        (bySeason.get(targetSeason) ?? 0) + expectedValue / 1_000_000,
      );
    }
  }
  return bySeason;
}

function projectionMap(rows) {
  const map = new Map();
  for (const row of rows) {
    const id = String(row.xMLBAMID || row.playerid);
    const existing = map.get(id);
    if (!existing) {
      map.set(id, { ...row, _components: [row] });
      continue;
    }
    map.set(id, {
      ...existing,
      WAR: Number(existing.WAR || 0) + Number(row.WAR || 0),
      positionDB: "TWP",
      minpos: "TWP",
      _stats: "twp",
      _components: [...(existing._components ?? [existing]), row],
    });
  }
  return map;
}

function projectionComponent(row, stats) {
  if (!row) return undefined;
  return (row._components ?? [row]).find(
    (component) => component._stats === stats,
  );
}

function projectionWithPublishedWar(row, war) {
  const publishedWar = Number(war);
  if (!Number.isFinite(publishedWar)) return row;
  if (!row?._components?.length) return { ...(row ?? {}), WAR: publishedWar };
  const componentWar = row._components.reduce(
    (sum, component) => sum + (Number(component.WAR) || 0),
    0,
  );
  const scale = componentWar ? publishedWar / componentWar : 1;
  return {
    ...row,
    WAR: publishedWar,
    _components: row._components.map((component) => ({
      ...component,
      WAR: Number(((Number(component.WAR) || 0) * scale).toFixed(4)),
    })),
  };
}

function prospectGrade(value) {
  const raw = String(value ?? "40").replace(".0", "");
  if (
    ["70", "65", "60", "55", "50", "45+", "45", "40+", "40", "35+"].includes(
      raw,
    )
  )
    return raw;
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

console.log(
  "Loading ZiPS, Steamer RoS, three-year history, and FanGraphs prospect data…",
);
const [
  zips,
  zips2027,
  zips2028,
  steamer,
  zipsRos,
  steamerRos,
  depthChartsRos,
  hitterHistory,
  pitcherHistory,
  boardQueries,
  graduateQueries,
  injuryQueries,
  playoffOddsQueries,
  tradeValueZips,
  soxProspectsData,
] = await Promise.all([
  loadProjection("zips"),
  loadProjection("zipsp1"),
  loadProjection("zipsp2"),
  loadProjection("steamer"),
  loadProjection("rzips"),
  loadProjection("steamerr"),
  loadProjection("rfangraphsdc"),
  loadHistory("bat"),
  loadHistory("pit"),
  getNextData(boardUrl),
  getNextData(graduatesUrl),
  getNextData(injuryReportUrl),
  getNextData(playoffOddsUrl),
  loadTradeValueZiPS(),
  loadSoxProspects(),
]);

const boardRows = queryData(boardQueries, "prospects/the-board");
const graduateRows = queryData(graduateQueries, "prospects/the-board");
const teamRows = queryData(boardQueries, "useTeamInfoBySeason");
const injuryRows = queryData(
  injuryQueries,
  "roster-resource/injury-report/data",
);
const playoffOddsRows = queryData(playoffOddsQueries, "playoff-odds");
if (
  !Array.isArray(boardRows) ||
  !Array.isArray(graduateRows) ||
  !Array.isArray(teamRows) ||
  !Array.isArray(injuryRows) ||
  !Array.isArray(playoffOddsRows)
)
  throw new Error("The Board, injury-report, or playoff-odds payload is incomplete");
const availabilityById = activeAvailabilityByMlbId(injuryRows, BASE_YEAR);

const contractRecords = new Map();
const depthAssignments = new Map();
for (const [abbr, slug] of Object.entries(teamSlugs)) {
  console.log(`Loading ${abbr} payroll and depth chart…`);
  const [payrollQueries, depthQueries] = await Promise.all([
    getNextData(`https://www.fangraphs.com/roster-resource/payroll/${slug}`),
    getNextData(
      `https://www.fangraphs.com/roster-resource/depth-charts/${slug}`,
    ),
  ]);
  const payroll = queryData(
    payrollQueries,
    "roster-resource/payroll2020/data",
  );
  const depthChart = queryData(depthQueries, "depth-charts-all");
  for (const [id, assignment] of rosterAssignmentsFromDepthChart(
    depthChart?.dataRoster,
    abbr,
  )) {
    const existing = depthAssignments.get(id);
    if (!existing || assignment.priority >= existing.priority)
      depthAssignments.set(id, assignment);
  }
  for (const contract of payroll?.dataContract ?? []) {
    const summary = contract.contractSummary;
    const id = String(summary?.MLBAMID ?? "");
    if (!id) continue;
    const years = (contract.contractYears ?? []).filter(
      (year) =>
        year.Season >= BASE_YEAR &&
        String(year.Type).toUpperCase() !== "FREE AGENT",
    );
    const existing = contractRecords.get(id) ?? { records: [], team: abbr };
    existing.records.push({
      summary,
      years,
      incentives: contract.incentivesAll ?? [],
    });
    contractRecords.set(id, existing);
  }
  await sleep(120);
}

// RosterResource can publish a future extension as a separate contract record
// while retaining the player's current deal. Merge those records by effective
// season so a 2027 extension never erases the 2026 deadline value.
const contracts = new Map(
  [...contractRecords.entries()].map(([id, bundle]) => {
    const records = bundle.records.toSorted((left, right) => {
      const leftStart = Number(
        left.summary?.startSeason ?? left.years[0]?.Season ?? BASE_YEAR,
      );
      const rightStart = Number(
        right.summary?.startSeason ?? right.years[0]?.Season ?? BASE_YEAR,
      );
      return leftStart - rightStart;
    });
    const yearsBySeason = new Map();
    for (const record of records) {
      for (const year of record.years) {
        yearsBySeason.set(Number(year.Season), {
          ...year,
          _contractSummary: record.summary,
        });
      }
    }
    const latest = records.at(-1);
    return [
      id,
      {
        summary: latest?.summary,
        summaries: records.map((record) => record.summary),
        years: [...yearsBySeason.values()].sort(
          (left, right) => Number(left.Season) - Number(right.Season),
        ),
        incentives: records.flatMap((record) => record.incentives),
        notes: records
          .map((record) => fullContractNote(record.summary))
          .filter(Boolean)
          .join(" "),
        team: bundle.team,
      },
    ];
  }),
);

const steamerById = projectionMap(steamer);
const zipsRosById = projectionMap(zipsRos);
const steamerRosById = projectionMap(steamerRos);
const depthChartsRosById = projectionMap(depthChartsRos);
const zipsById = projectionMap(zips);
const zips2027ById = projectionMap(zips2027);
const zips2028ById = projectionMap(zips2028);
const tradeValueZipsByFgId = new Map(
  tradeValueZips.map((player) => [String(player.fgId), player]),
);
const soxProspectsByIdentity = new Map(
  soxProspectsData.prospects.map((player) => [
    normalizeIdentity(player.name, "BOS"),
    player,
  ]),
);
const lastProspectByFgId = new Map();
for (const row of [...boardRows, ...graduateRows]) {
  const fgId = String(row.PlayerId || row.UPID || "");
  if (!fgId || !(row.cFV || row.FV_Current)) continue;
  const existing = lastProspectByFgId.get(fgId);
  if (!existing || Number(row.Season) >= Number(existing.Season))
    lastProspectByFgId.set(fgId, row);
}
const historyById = new Map();
for (const row of [...hitterHistory, ...pitcherHistory]) {
  const id = String(row.xMLBAMID || "");
  if (!id) continue;
  historyById.set(id, [...(historyById.get(id) ?? []), row]);
}
const projectionIds = new Set([
  ...zipsById.keys(),
  ...steamerById.keys(),
  ...contracts.keys(),
  ...[...depthAssignments.entries()]
    .filter(([, assignment]) => assignment.activeRoster)
    .map(([id]) => id),
]);
const mlb = [];

for (const id of projectionIds) {
  const history = historyById.get(id) ?? [];
  const latestHistory = history.sort((a, b) => b.Season - a.Season)[0];
  const depthAssignment = depthAssignments.get(id);
  const contract = contracts.get(id) ?? depthChartContract(depthAssignment);
  const hasCurrentProjection = zipsById.has(id) || steamerById.has(id);
  // Payroll pages also carry retired-player and dead-money obligations. Those
  // are real club expenses, but they are not tradable baseball assets. Keep a
  // Marcel fallback only for players with a 2025/26 playing record.
  if (
    !hasCurrentProjection &&
    !hasRecentPlayingRecord(history) &&
    !depthAssignment?.activeRoster
  )
    continue;
  const primary =
    zipsById.get(id) ??
    steamerById.get(id) ??
    (depthAssignment?.activeRoster
      ? {
          xMLBAMID: id,
          playerid: depthAssignment.playerId,
          PlayerName: depthAssignment.playerName,
          Team: depthAssignment.team,
          positionDB: depthAssignment.eligiblePosition,
          WAR: depthAssignment.actualWar + depthAssignment.projectedWar,
          _stats: ["SP", "RP"].includes(depthAssignment.depthPosition)
            ? "pit"
            : "bat",
        }
      : null) ??
    (contract
      ? {
          xMLBAMID: id,
          PlayerName: contract.summary.playerName,
          Team: contract.team,
          positionDB:
            latestHistory?.positionDB || latestHistory?.position || "UTIL",
          WAR: marcelWar(history),
          _stats: latestHistory?._stats || "bat",
        }
      : null);
  if (!primary) continue;
  const backup = steamerById.get(id);
  const matchedContract =
    contract ??
    contracts.get(String(primary?.xMLBAMID || backup?.xMLBAMID || ""));
  // Keep the major-league library aligned to current RosterResource payroll/control pages.
  // The full minor-league universe is supplied separately by The Board.
  if (!matchedContract) continue;
  const team = normalizeTeam(
    depthAssignment?.team ||
      primary?.Team ||
      backup?.Team ||
      matchedContract.team,
  );
  if (!teamSlugs[team]) continue;
  const age = Number(matchedContract.summary?.age) || null;
  const isPitcher = primary?._stats === "pit";
  const isTwoWay = primary?._stats === "twp";
  const rosProjection =
    depthChartsRosById.get(id) ??
    steamerRosById.get(id) ??
    zipsRosById.get(id) ??
    (depthAssignment
      ? { WAR: depthAssignment.projectedWar }
      : undefined);
  const contractYears = matchedContract.years.length
    ? matchedContract.years
    : [{ Season: BASE_YEAR, Type: "PRE-ARB", Salary: 780000, ArbYear: 0 }];
  const source = zipsById.has(id)
    ? "ZiPS"
    : steamerById.has(id)
      ? "Steamer"
      : depthAssignment?.activeRoster
        ? "RosterResource + Marcel + role-aware aging"
        : "Marcel + role-aware aging";
  const currentWar = Number(primary?.WAR ?? backup?.WAR ?? 0);
  const fgId = String(
    primary?.playerid ||
      backup?.playerid ||
      matchedContract.summary?.playerId ||
      "",
  );
  const tradeValueProjection = tradeValueZipsByFgId.get(fgId);
  const publishedZiPSWarForSeason = (season) => {
    const war = Number(tradeValueProjection?.projections?.[season]);
    return Number.isFinite(war) ? war : null;
  };
  const publishedZiPSYears = Object.keys(
    tradeValueProjection?.projections ?? {},
  )
    .map(Number)
    .filter((season) => Number.isFinite(publishedZiPSWarForSeason(season)))
    .sort((left, right) => left - right);
  const publicFutureProjectionForSeason = (season) =>
    season === BASE_YEAR + 1
      ? zips2027ById.get(id)
      : season === BASE_YEAR + 2
        ? zips2028ById.get(id)
        : undefined;
  const explicitFutureProjectionForSeason = (season) => {
    const publishedWar = publishedZiPSWarForSeason(season);
    if (publishedWar !== null)
      return projectionWithPublishedWar(
        publicFutureProjectionForSeason(season) ??
          zips2028ById.get(id) ??
          zips2027ById.get(id) ??
          primary ??
          backup,
        publishedWar,
      );
    return publicFutureProjectionForSeason(season);
  };
  const future2027Projection = explicitFutureProjectionForSeason(
    BASE_YEAR + 1,
  );
  const future2028Projection = explicitFutureProjectionForSeason(
    BASE_YEAR + 2,
  );
  const future2027 = Number(future2027Projection?.WAR);
  const future2028 = Number(future2028Projection?.WAR);
  const lastProspect = lastProspectByFgId.get(fgId);
  const injuryRecord = availabilityById.get(id);
  const availabilityRisk = injuryRecord
    ? availabilityRiskAdjustment(injuryRecord)
    : 0;
  const availability = injuryRecord
    ? {
        status: String(injuryRecord.status),
        injury: String(injuryRecord.injurySurgery || "Injury not specified"),
        latestUpdate: String(
          injuryRecord.latestUpdate || "No current timetable listed",
        ),
        eligibleDate: injuryRecord.eligibledate || undefined,
        returnDate: injuryRecord.returndate || undefined,
        riskAdjustment: availabilityRisk,
      }
    : undefined;
  const contractNote =
    matchedContract.notes || fullContractNote(matchedContract.summary);
  const tradeProtection = tradeProtectionForPlayer(id, contractNote);
  const hasDeferrals = /deferr/i.test(contractNote);
  const optOutAfter = firstOptOutYear(contractNote);
  const role = isTwoWay
    ? "two-way"
    : isPitcher
      ? depthAssignment?.depthPosition === "RP"
        ? "reliever"
        : depthAssignment?.depthPosition === "SP"
          ? "starter"
          : pitcherRole(primary ?? backup ?? rosProjection)
      : "position";
  const updatePart = (partRole, stats, label) => {
    const preseason = projectionComponent(zipsById.get(id), stats);
    const updated = projectionComponent(zipsRosById.get(id), stats);
    // WAR per inning is not directly portable across starting and relief roles.
    // When ZiPS changes the projected role, leave the published future ZiPS
    // baseline alone instead of presenting the role change as a talent change.
    const incompatiblePitcherRoles =
      stats === "pit" &&
      preseason &&
      updated &&
      pitcherRole(preseason) !== pitcherRole(updated);
    const update = buildInSeasonTalentUpdate({
      role: partRole,
      providers: incompatiblePitcherRoles
        ? []
        : [
        {
          name: "ZiPS",
          preseason,
          updated,
        },
          ],
    });
    return update ? { role: partRole, stats, label, update } : null;
  };
  const pitcherUpdateRole = pitcherRole(
    projectionComponent(zipsById.get(id), "pit") ??
      projectionComponent(steamerById.get(id), "pit") ??
      projectionComponent(zipsRosById.get(id), "pit") ??
      projectionComponent(steamerRosById.get(id), "pit"),
  );
  const updateParts = tradeValueProjection
    ? []
    : (
        isTwoWay
          ? [
              updatePart("position", "bat", "Hitting"),
              updatePart(pitcherUpdateRole, "pit", "Pitching"),
            ]
          : [updatePart(role, isPitcher ? "pit" : "bat", null)]
      ).filter(Boolean);
  const talentUpdate = updateParts.length
    ? {
        method: "Role-aware rolling talent update v2",
        unitLabel:
          updateParts.length === 1
            ? updateParts[0].update.unitLabel
            : "hitting and pitching rates",
        rateChange:
          updateParts.length === 1 ? updateParts[0].update.rateChange : null,
        capped: updateParts.some((part) => part.update.capped),
        roleGuarded: updateParts.some((part) => part.update.roleGuarded),
        providers: updateParts.flatMap((part) =>
          part.update.providers.map((provider) => ({
            ...provider,
            name: part.label
              ? `${provider.name} ${part.label.toLowerCase()}`
              : provider.name,
            unitLabel: part.update.unitLabel,
          })),
        ),
      }
    : undefined;
  const expectedIncentives = expectedPlayingTimeIncentives(
    matchedContract.incentives,
    {
      history,
      rosProjection,
      future2027: future2027Projection,
      future2028: future2028Projection,
      fallback: primary ?? backup,
      isPitcher,
    },
  );
  const agingAnchorYear = publishedZiPSYears.at(-1) ??
    (Number.isFinite(future2028)
      ? BASE_YEAR + 2
      : Number.isFinite(future2027)
        ? BASE_YEAR + 1
        : BASE_YEAR);
  const agingAnchorProjection =
    agingAnchorYear === BASE_YEAR
      ? primary ?? backup
      : explicitFutureProjectionForSeason(agingAnchorYear) ??
        future2028Projection ??
        future2027Projection ??
        primary ??
        backup;
  const agingPriorProjection =
    agingAnchorYear === BASE_YEAR
      ? undefined
      : agingAnchorYear === BASE_YEAR + 1
        ? primary ?? backup
        : explicitFutureProjectionForSeason(agingAnchorYear - 1) ??
          future2027Projection ??
          primary ??
          backup;
  const agingBaseAge = age
    ? Math.floor(age) + (agingAnchorYear - BASE_YEAR)
    : isPitcher
      ? 28
      : 27;
  const agingPosition =
    depthAssignment?.depthPosition ||
    agingAnchorProjection?.positionDB ||
    agingAnchorProjection?.minpos ||
    primary?.positionDB;
  const agingProjectionForSeason = (season) => {
    const yearsOut = Math.max(0, season - agingAnchorYear);
    if (!isTwoWay)
      return projectWithAging({
        baseProjection: agingAnchorProjection,
        priorProjection: agingPriorProjection,
        baseAge: agingBaseAge,
        role,
        position: agingPosition,
        yearsOut,
      });
    if (yearsOut === 0)
      return {
        war: Number(agingAnchorProjection?.WAR) || 0,
        workloadScale: 1,
      };
    const parts = ["bat", "pit"]
      .map((stats) => {
        const baseComponent = projectionComponent(
          agingAnchorProjection,
          stats,
        );
        if (!baseComponent) return null;
        const partRole =
          stats === "bat" ? "position" : pitcherRole(baseComponent);
        return projectWithAging({
          baseProjection: baseComponent,
          priorProjection: projectionComponent(agingPriorProjection, stats),
          baseAge: agingBaseAge,
          role: partRole,
          position:
            stats === "bat"
              ? baseComponent.positionDB || baseComponent.minpos
              : partRole === "starter"
                ? "SP"
                : "RP",
          yearsOut,
        });
      })
      .filter(Boolean);
    return {
      war: Number(
        parts.reduce((sum, part) => sum + part.war, 0).toFixed(1),
      ),
      workloadScale: 1,
    };
  };
  const agingModel = isTwoWay
    ? {
        method: "ZiPS-anchored nonlinear aging v2",
        role: "position",
        profile: "two-way",
        unitLabel: "hitting and pitching workloads",
        baseAge: agingBaseAge,
        rateTrend: null,
        workloadRetention: null,
      }
    : agingProjectionSummary({
        baseProjection: agingAnchorProjection,
        priorProjection: agingPriorProjection,
        baseAge: agingBaseAge,
        role,
        position: agingPosition,
      });
  const projectedWarDetail = (season) => {
    const agedProjection = agingProjectionForSeason(season);
    const explicitFutureProjection =
      season > BASE_YEAR
        ? explicitFutureProjectionForSeason(season)
        : undefined;
    const explicitFutureWar = Number(explicitFutureProjection?.WAR);
    const futureWar =
      Number.isFinite(explicitFutureWar)
        ? explicitFutureWar
        : season > agingAnchorYear
          ? agedProjection.war
          : currentWar;
    if (season === BASE_YEAR) {
      return {
        war: Number(
          Number(
            rosProjection?.WAR ?? currentWar * seasonRemainingFraction,
          ).toFixed(1),
        ),
      };
    }

    const futureProjectionForWorkload =
      explicitFutureProjection ?? primary ?? backup;
    const yearsBeyondExplicit = Math.max(0, season - (BASE_YEAR + 2));
    const adjustment = updateParts.reduce((sum, part) => {
      const component = projectionComponent(
        futureProjectionForWorkload,
        part.stats,
      );
      const workloadScale =
        !isTwoWay && season > agingAnchorYear
          ? agedProjection.workloadScale
          : Math.pow(
              part.role === "position" ? 0.96 : 0.93,
              yearsBeyondExplicit,
            );
      const scaledComponent = component
        ? {
            ...component,
            PA:
              Number(component.PA) > 0
                ? Number(component.PA) * workloadScale
                : component.PA,
            IP:
              Number(component.IP) > 0
                ? Number(component.IP) * workloadScale
                : component.IP,
          }
        : undefined;
      return (
        sum +
        applyInSeasonTalentUpdate({
          baselineWar: 0,
          futureProjection: scaledComponent,
          role: part.role,
          year: season,
          baseYear: BASE_YEAR,
          update: part.update,
        }).adjustment
      );
    }, 0);
    const baselineWar = Number(futureWar.toFixed(1));
    const war = Number((futureWar + adjustment).toFixed(1));
    return {
      war,
      baselineWar,
      inSeasonAdjustment: Number((war - baselineWar).toFixed(1)),
      signalPersistence: Number(signalPersistence(season, BASE_YEAR).toFixed(3)),
    };
  };
  const projectedWarForSeason = (season) => projectedWarDetail(season).war;
  const currentRoleHistory = history.filter(
    (row) =>
      Number(row.Season) === BASE_YEAR &&
      (role === "position" ? row._stats === "bat" : row._stats === "pit"),
  );
  const projectedArbitrationMetrics = (season) => {
    if (role === "two-way") return undefined;
    if (season === BASE_YEAR)
      return arbitrationMetrics(role, currentRoleHistory, rosProjection);
    const explicitProjection = explicitFutureProjectionForSeason(season);
    const agingWorkloadScale =
      season > agingAnchorYear
        ? agingProjectionForSeason(season).workloadScale
        : 1;
    const metrics = arbitrationMetrics(
      role,
      [],
      explicitProjection ??
        agingAnchorProjection ??
        primary ??
        backup ??
        rosProjection,
      agingWorkloadScale,
    );
    return metrics
      ? { ...metrics, war: projectedWarForSeason(season) }
      : metrics;
  };
  let seasons = contractYears.map((year) => {
    const season = Number(year.Season);
    const projection = projectedWarDetail(season);
    const yearSummary = year._contractSummary ?? matchedContract.summary;
    const yearHasDeferrals = /deferr/i.test(fullContractNote(yearSummary));
    const economicAnnual = yearHasDeferrals
      ? yearSummary?.AAV
      : year.ArbSalaryProjection || year.Salary || 780000;
    const expectedIncentive = Number(
      (expectedIncentives.get(season) ?? 0).toFixed(2),
    );
    const baseAnnualSalary = Number(
      (Number(economicAnnual || 780000) / 1_000_000).toFixed(2),
    );
    const annualSalary = Number(
      (baseAnnualSalary + expectedIncentive).toFixed(2),
    );
    const listedOptionMode = salaryMode(year.Type, year.ArbYear);
    // Once a player can opt out, the club cannot count later positive surplus
    // as guaranteed control. A struggling player can still keep the downside.
    const optionMode =
      optOutAfter !== null && season > optOutAfter
        ? "playerOption"
        : listedOptionMode;
    return {
      year: season,
      war: projection.war,
      projectionBaselineWar: projection.baselineWar,
      inSeasonAdjustment: projection.inSeasonAdjustment,
      signalPersistence: projection.signalPersistence,
      arbMetrics: projectedArbitrationMetrics(season),
      salary:
        season === BASE_YEAR
          ? Number(
              (
                baseAnnualSalary * seasonRemainingFraction +
                expectedIncentive
              ).toFixed(2),
            )
          : String(year.Type).toUpperCase().includes("ARB")
            ? 0
            : annualSalary,
      annualSalary,
      expectedIncentives: expectedIncentive || undefined,
      salaryMode:
        season === BASE_YEAR
          ? "fixed"
          : [
                "clubOption",
                "playerOption",
                "mutualOption",
                "vestingOption",
              ].includes(optionMode)
            ? "fixed"
            : optionMode,
      contractType: optionMode,
      ros: season === BASE_YEAR,
      optionBuyout: Number(
        (Number(year.OptionBuyout || 0) / 1_000_000).toFixed(2),
      ),
      optionProbability: optionMode === "vestingOption" ? 50 : undefined,
    };
  });
  let contractScenario;
  const firstFallbackYear = seasons.find((season) =>
    ["playerOption", "mutualOption"].includes(
      season.contractType ?? season.salaryMode,
    ),
  )?.year;
  const clubBlock = multiYearOptionTerms(contractNote, "club option");
  const mutualBlock = multiYearOptionTerms(contractNote, "mutual option");
  if (firstFallbackYear && clubBlock) {
    const guaranteed = seasons.filter(
      (season) => season.year < firstFallbackYear,
    );
    const fallback = seasons.filter(
      (season) => season.year >= firstFallbackYear,
    );
    const fixedBlock = (terms) =>
      Array.from({ length: terms.years }, (_, index) => {
        const year = firstFallbackYear + index;
        const projection = projectedWarDetail(year);
        const salary = Number((terms.total / terms.years).toFixed(2));
        return {
          year,
          war: projection.war,
          projectionBaselineWar: projection.baselineWar,
          inSeasonAdjustment: projection.inSeasonAdjustment,
          signalPersistence: projection.signalPersistence,
          salary,
          annualSalary: salary,
          salaryMode: "fixed",
          contractType: "fixed",
          ros: false,
          optionBuyout: 0,
        };
      });
    const options = [
      {
        id: "fallback",
        label: "Player-option fallback",
        description:
          "Conservative default: the club declines its earlier choice and the player controls the listed fallback years.",
        seasons: fallback,
      },
      {
        id: "club",
        label: "Current club-option tier",
        description: `Assumes the club exercises the current ${clubBlock.years}-year, $${clubBlock.total}M tier as one guaranteed commitment.`,
        seasons: fixedBlock(clubBlock),
      },
    ];
    if (mutualBlock) {
      options.push({
        id: "mutual",
        label: "Mutual-option path",
        description: `Assumes both the player and club agree to the ${mutualBlock.years}-year, $${mutualBlock.total}M option.`,
        seasons: fixedBlock(mutualBlock),
      });
    }
    contractScenario = {
      startYear: firstFallbackYear,
      selectedId: "fallback",
      note:
        "This contract has mutually exclusive paths. Pick one to compare it; impossible combinations are never added together.",
      options,
    };
    seasons = guaranteed;
  } else if (hasInjuryConditionalOption(contractNote)) {
    const conditionalIndex = seasons.findIndex(
      (season) => season.contractType === "clubOption",
    );
    if (conditionalIndex >= 0) {
      const conditionalSeason = seasons[conditionalIndex];
      seasons = seasons.filter((_, index) => index !== conditionalIndex);
      contractScenario = {
        startYear: conditionalSeason.year,
        selectedId: "unavailable",
        note:
          "The option only becomes available if the injury language in the contract is triggered.",
        options: [
          {
            id: "unavailable",
            label: "Option unavailable",
            description:
              "Healthy-player default: the injury condition is not met, so the option is excluded.",
            seasons: [],
          },
          {
            id: "condition-met",
            label: "Injury condition met",
            description:
              "The condition is met and the club option becomes available; the club still chooses whether to exercise it.",
            seasons: [conditionalSeason],
          },
        ],
      };
    }
  }
  const historyYtdWar = history
    .filter((row) => Number(row.Season) === BASE_YEAR)
    .reduce((sum, row) => sum + (Number(row.WAR) || 0), 0);
  const ytdWar = history.some((row) => Number(row.Season) === BASE_YEAR)
    ? historyYtdWar
    : (depthAssignment?.actualWar ?? 0);
  mlb.push({
    id: `mlb-${primary?.xMLBAMID || primary?.playerid}`,
    kind: "mlb",
    name: primary?.PlayerName || primary?.ShortName,
    team,
    position: isTwoWay
      ? "TWP"
      : depthAssignment?.eligiblePosition ||
        primary?.positionDB ||
        primary?.minpos ||
        (isPitcher ? "P" : "UTIL"),
    depthPosition: isTwoWay
      ? "TWP"
      : depthAssignment?.depthPosition ||
        primary?.positionDB ||
        primary?.minpos ||
        (isPitcher ? "P" : "UTIL"),
    role,
    age: age ? Math.floor(age) : isPitcher ? 28 : 27,
    source: {
      projection: [
        "FanGraphs Depth Charts RoS (2026)",
        tradeValueProjection
          ? "ZiPS Trade Value Series update (2027–31)"
          : `${source} future`,
        talentUpdate ? "ZiPS role-aware rolling talent update" : null,
      ]
        .filter(Boolean)
        .join(" · "),
      contract: [
        "FanGraphs RosterResource",
        hasDeferrals ? "economic AAV" : null,
        expectedIncentives.size ? "expected playing-time incentives" : null,
        contractScenario ? "conditional option paths" : null,
        tradeProtection !== "none" ? "trade protection" : null,
        availability ? "injury status" : null,
        seasons.some((season) => season.salaryMode.startsWith("arb"))
          ? "role-specific arbitration estimates"
          : null,
      ]
        .filter(Boolean)
        .join(" · "),
      refreshed: snapshotLabel,
    },
    risk: (isTwoWay ? 14 : isPitcher ? 12 : 7) + availabilityRisk,
    tradeProtection,
    availability,
    seasons,
    contractScenario,
    talentUpdate,
    futureProjectionUpdate: tradeValueProjection
      ? {
          provider: "ZiPS",
          series: "FanGraphs 2026 Trade Value Series",
          rank: tradeValueProjection.rank,
          sourceUrl: tradeValueProjection.sourceUrl,
          projections: tradeValueProjection.projections,
        }
      : undefined,
    agingModel: {
      ...agingModel,
      anchorYear: agingAnchorYear,
    },
    threeYearProjection: [BASE_YEAR, BASE_YEAR + 1, BASE_YEAR + 2].map(
      (year) => {
        const projection = projectedWarDetail(year);
        return {
          year,
          war: projection.war,
          projectionBaselineWar: projection.baselineWar,
          inSeasonAdjustment: projection.inSeasonAdjustment,
          signalPersistence: projection.signalPersistence,
        };
      },
    ),
    seasonToDateWar: Number(ytdWar.toFixed(1)),
    platformWar: Number((ytdWar + Number(rosProjection?.WAR || 0)).toFixed(1)),
    rookieMode:
      lastProspect && Number(lastProspect.servicetime || 99) < 1
        ? "blend"
        : "projection",
    lastProspect:
      lastProspect && Number(lastProspect.servicetime || 99) < 1
        ? {
            fv: prospectGrade(lastProspect.cFV || lastProspect.FV_Current),
            rank: Number(lastProspect.Ovr_Rank || lastProspect.cOVR) || null,
            year: Number(lastProspect.Season) || 2025,
            serviceTime: Number(lastProspect.servicetime) || 0,
            risk: lastProspect.cRisk || lastProspect.Variance || null,
          }
        : null,
  });
}

const mlbIdentities = new Set(
  mlb.map((player) => normalizeIdentity(player.name, player.team)),
);
const prospects = boardRows
  .filter(
    (row) =>
      teamSlugs[normalizeTeam(row.Team)] &&
      row.playerName &&
      !mlbIdentities.has(normalizeIdentity(row.playerName, row.Team)),
  )
  .map((row) => {
    const tradeValueProjection = tradeValueZipsByFgId.get(
      String(row.PlayerId || row.UPID || ""),
    );
    return {
      id: `prospect-${row.PlayerId || row.ID}`,
      kind: "prospect",
      name: row.playerName,
      team: normalizeTeam(row.Team),
      position: row.positionDB || row.Position || "—",
      age: Math.floor(Number(row.Age) || 20),
      source: {
        projection: tradeValueProjection
          ? "FanGraphs The Board · ZiPS Trade Value Series update"
          : "FanGraphs The Board",
        contract: "FV, ETA, scouting risk & roster status",
        refreshed: snapshotLabel,
      },
      prospectType: String(row.positionDB || row.Position).includes("P")
        ? "Pitcher"
        : "Hitter",
      fv: prospectGrade(row.cFV || row.FV_Current),
      eta: Number(row.cETA || row.ETA_Current) || BASE_YEAR + 1,
      adjustment: 0,
      rosterContext: prospectRosterContext(row, BASE_YEAR),
      rank: Number(row.Ovr_Rank) || null,
      riskLabel: normalizeProspectRisk(row.cRisk || row.Variance),
      futureProjectionUpdate: tradeValueProjection
        ? {
            provider: "ZiPS",
            series: "FanGraphs 2026 Trade Value Series",
            rank: tradeValueProjection.rank,
            sourceUrl: tradeValueProjection.sourceUrl,
            projections: tradeValueProjection.projections,
          }
        : undefined,
    };
  });

function soxProspectRisk(player) {
  const spread = Number(player.ceiling) - Number(player.floor);
  if (spread >= 4) return "High";
  if (spread >= 2.5) return "Med";
  return "Low";
}

function withSoxProspectsGrade(player) {
  if (player.team !== "BOS") return player;
  const rating = soxProspectsByIdentity.get(
    normalizeIdentity(player.name, player.team),
  );
  if (!rating) return player;
  const soxProspects = {
    grade: rating.grade,
    fv: rating.fv,
    organizationRank: rating.rank,
    floor: rating.floor,
    ceiling: rating.ceiling,
    rankingsDate: soxProspectsData.rankingsDate,
    sourceUrl: soxProspectsData.sourceUrl,
  };
  if (player.kind === "mlb") {
    return {
      ...player,
      rookieMode: player.rookieMode === "projection" ? "blend" : player.rookieMode,
      lastProspect: {
        fv: prospectGrade(rating.fv),
        rank: player.lastProspect?.rank ?? null,
        year: BASE_YEAR,
        serviceTime: player.lastProspect?.serviceTime ?? 0,
        risk: player.lastProspect?.risk ?? soxProspectRisk(rating),
      },
      soxProspects,
    };
  }
  return {
    ...player,
    fv: prospectGrade(rating.fv),
    source: {
      ...player.source,
      projection: player.rank
        ? "SoxProspects current grade · FanGraphs The Board rank"
        : "SoxProspects current grade",
      contract: "FV from SoxProspects · ETA, scouting risk & roster status",
    },
    soxProspects,
  };
}

const gradedMlb = mlb.map(withSoxProspectsGrade);
const gradedProspects = prospects.map(withSoxProspectsGrade);
const existingIdentities = new Set(
  [...gradedMlb, ...gradedProspects].map((player) =>
    normalizeIdentity(player.name, player.team),
  ),
);
const soxOnlyProspects = soxProspectsData.prospects
  .filter(
    (player) => !existingIdentities.has(normalizeIdentity(player.name, "BOS")),
  )
  .map((player) => ({
    id: `prospect-sox-${player.slug}`,
    kind: "prospect",
    name: player.name,
    team: "BOS",
    position: /(?:^|\/)(?:LHP|RHP|P)(?:$|\/)/.test(player.position)
      ? "P"
      : player.position,
    age: player.age ?? 20,
    source: {
      projection: "SoxProspects current grade",
      contract: "FV, ETA, scouting risk & roster status",
      refreshed: snapshotLabel,
    },
    prospectType: /(?:^|\/)(?:LHP|RHP|P)(?:$|\/)/.test(player.position)
      ? "Pitcher"
      : "Hitter",
    fv: prospectGrade(player.fv),
    eta: player.eta ?? BASE_YEAR + 1,
    adjustment: 0,
    rosterContext: "none",
    rank: null,
    riskLabel: soxProspectRisk(player),
    soxProspects: {
      grade: player.grade,
      fv: player.fv,
      organizationRank: player.rank,
      floor: player.floor,
      ceiling: player.ceiling,
      rankingsDate: soxProspectsData.rankingsDate,
      sourceUrl: soxProspectsData.sourceUrl,
    },
  }));
const finalProspects = [...gradedProspects, ...soxOnlyProspects];

const teams = teamRows
  .map((team) => ({ abbr: normalizeTeam(team.AbbName), name: team.FullName }))
  .filter((team) => teamSlugs[team.abbr])
  .sort((a, b) => a.name.localeCompare(b.name));

const players = [...gradedMlb, ...finalProspects].sort(
  (a, b) =>
    a.team.localeCompare(b.team) ||
    a.kind.localeCompare(b.kind) ||
    a.name.localeCompare(b.name),
);
const playoffOdds = {};
for (const row of playoffOddsRows) {
  const team = normalizeTeam(row.abbName);
  if (!teamSlugs[team] || playoffOdds[team] !== undefined) continue;
  playoffOdds[team] = Number(
    (100 * (Number(row.endData?.poffTitle) || 0)).toFixed(1),
  );
}
const output = {
  meta: {
    refreshed: snapshotLabel,
    baseYear: BASE_YEAR,
    mlbCount: gradedMlb.length,
    prospectCount: finalProspects.length,
    projectionPriority: [
      "FanGraphs Depth Charts RoS",
      "FanGraphs 2026 Trade Value Series ZiPS update where published",
      "ZiPS future + ZiPS role-aware rolling talent update",
      "ZiPS-anchored nonlinear aging + Marcel fallback",
    ],
    seasonRemainingFraction: Number(seasonRemainingFraction.toFixed(4)),
    sources: [
      "FanGraphs projections",
      "FanGraphs 2026 Trade Value Series",
      "FanGraphs RosterResource",
      "FanGraphs RosterResource injury report",
      "FanGraphs The Board",
      "SoxProspects current projection grades",
      "FanGraphs playoff odds",
    ],
    soxProspects: {
      rankingsDate: soxProspectsData.rankingsDate,
      gradedPlayers: soxProspectsData.prospects.length,
      addedPlayers: soxOnlyProspects.length,
      sourceUrl: soxProspectsData.sourceUrl,
    },
  },
  teams,
  players,
};
const playoffOddsOutput = {
  refreshed: snapshotLabel,
  source: "FanGraphs Playoff Odds",
  sourceUrl: playoffOddsUrl,
  mode: "FanGraphs projections",
  odds: playoffOdds,
};

await mkdir(new URL("../app/data/", import.meta.url), { recursive: true });
await writeFile(OUT, `${JSON.stringify(output)}\n`);
await writeFile(PLAYOFF_ODDS_OUT, `${JSON.stringify(playoffOddsOutput, null, 2)}\n`);
console.log(
  `Wrote ${players.length} players (${gradedMlb.length} MLB, ${finalProspects.length} prospects) to ${OUT.pathname}`,
);
