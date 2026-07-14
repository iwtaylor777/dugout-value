import { mkdir, writeFile } from "node:fs/promises";
import {
  normalizeProspectRisk,
  prospectRosterContext,
} from "../lib/prospect-context.mjs";
import { tradeProtectionFromNote } from "../lib/contract-context.mjs";

const BASE_YEAR = 2026;
const OUT = new URL("../app/data/player-database.json", import.meta.url);
const boardUrl = "https://www.fangraphs.com/prospects/the-board/";
const graduatesUrl =
  "https://www.fangraphs.com/prospects/the-board/2025-graduates";
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

function ageWar(war, age, isPitcher, yearsOut) {
  let projected = Number(war) || 0;
  let currentAge = Number.isFinite(age) ? age : isPitcher ? 28 : 27;
  for (let year = 0; year < yearsOut; year += 1) {
    currentAge += 1;
    if (isPitcher)
      projected += currentAge <= 26 ? 0 : currentAge <= 29 ? -0.15 : -0.3;
    else
      projected +=
        currentAge <= 26
          ? 0.15
          : currentAge === 27
            ? 0
            : currentAge <= 31
              ? -0.25
              : -0.4;
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
      map.set(id, row);
      continue;
    }
    map.set(id, {
      ...existing,
      WAR: Number(existing.WAR || 0) + Number(row.WAR || 0),
      positionDB: "TWP",
      minpos: "TWP",
      _stats: "twp",
    });
  }
  return map;
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
  steamerRos,
  hitterHistory,
  pitcherHistory,
  boardQueries,
  graduateQueries,
] = await Promise.all([
  loadProjection("zips"),
  loadProjection("zipsp1"),
  loadProjection("zipsp2"),
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
if (
  !Array.isArray(boardRows) ||
  !Array.isArray(graduateRows) ||
  !Array.isArray(teamRows)
)
  throw new Error("The Board payload is incomplete");

const contractRecords = new Map();
for (const [abbr, slug] of Object.entries(teamSlugs)) {
  console.log(`Loading ${abbr} payroll…`);
  const queries = await getNextData(
    `https://www.fangraphs.com/roster-resource/payroll/${slug}`,
  );
  const payroll = queryData(queries, "roster-resource/payroll2020/data");
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
const steamerRosById = projectionMap(steamerRos);
const zipsById = projectionMap(zips);
const zips2027ById = projectionMap(zips2027);
const zips2028ById = projectionMap(zips2028);
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
]);
const mlb = [];

for (const id of projectionIds) {
  const history = historyById.get(id) ?? [];
  const latestHistory = history.sort((a, b) => b.Season - a.Season)[0];
  const contract = contracts.get(id);
  const primary =
    zipsById.get(id) ??
    steamerById.get(id) ??
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
  const team = normalizeTeam(primary?.Team || backup?.Team);
  if (!teamSlugs[team]) continue;
  const matchedContract =
    contract ??
    contracts.get(String(primary?.xMLBAMID || backup?.xMLBAMID || ""));
  // Keep the major-league library aligned to current RosterResource payroll/control pages.
  // The full minor-league universe is supplied separately by The Board.
  if (!matchedContract) continue;
  const age = Number(matchedContract.summary?.age) || null;
  const isPitcher = primary?._stats === "pit";
  const isTwoWay = primary?._stats === "twp";
  const rosProjection = steamerRosById.get(id);
  const contractYears = matchedContract.years.length
    ? matchedContract.years
    : [{ Season: BASE_YEAR, Type: "PRE-ARB", Salary: 780000, ArbYear: 0 }];
  const source = zipsById.has(id)
    ? "ZiPS"
    : steamerById.has(id)
      ? "Steamer"
      : "Marcel + aging";
  const currentWar = Number(primary?.WAR ?? backup?.WAR ?? 0);
  const future2027 = Number(zips2027ById.get(id)?.WAR);
  const future2028 = Number(zips2028ById.get(id)?.WAR);
  const fgId = String(
    primary?.playerid ||
      backup?.playerid ||
      matchedContract.summary?.playerId ||
      "",
  );
  const lastProspect = lastProspectByFgId.get(fgId);
  const contractNote =
    matchedContract.notes || fullContractNote(matchedContract.summary);
  const tradeProtection = tradeProtectionFromNote(contractNote);
  const hasDeferrals = /deferr/i.test(contractNote);
  const optOutAfter = firstOptOutYear(contractNote);
  const role = isTwoWay
    ? "two-way"
    : isPitcher
      ? pitcherRole(primary ?? backup ?? rosProjection)
      : "position";
  const expectedIncentives = expectedPlayingTimeIncentives(
    matchedContract.incentives,
    {
      history,
      rosProjection,
      future2027: zips2027ById.get(id),
      future2028: zips2028ById.get(id),
      fallback: primary ?? backup,
      isPitcher,
    },
  );
  const projectedWarForSeason = (season) => {
    const futureWar =
      season === 2027 && Number.isFinite(future2027)
        ? future2027
        : season === 2028 && Number.isFinite(future2028)
          ? future2028
          : season > 2028 && Number.isFinite(future2028)
            ? ageWar(future2028, age ? age + 2 : null, isPitcher, season - 2028)
            : ageWar(currentWar, age, isPitcher, season - BASE_YEAR);
    return season === BASE_YEAR
      ? Number(
          Number(
            rosProjection?.WAR ?? currentWar * seasonRemainingFraction,
          ).toFixed(1),
        )
      : Number(futureWar.toFixed(1));
  };
  let seasons = contractYears.map((year) => {
    const season = Number(year.Season);
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
      war: projectedWarForSeason(season),
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
        const salary = Number((terms.total / terms.years).toFixed(2));
        return {
          year,
          war: projectedWarForSeason(year),
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
  const ytdWar = history
    .filter((row) => Number(row.Season) === BASE_YEAR)
    .reduce((sum, row) => sum + (Number(row.WAR) || 0), 0);
  mlb.push({
    id: `mlb-${primary?.xMLBAMID || primary?.playerid}`,
    kind: "mlb",
    name: primary?.PlayerName || primary?.ShortName,
    team,
    position: isTwoWay
      ? "TWP"
      : primary?.positionDB || primary?.minpos || (isPitcher ? "P" : "UTIL"),
    role,
    age: age ? Math.floor(age) : isPitcher ? 28 : 27,
    source: {
      projection: `Steamer RoS (2026) · ${source} future`,
      contract: [
        "FanGraphs RosterResource",
        hasDeferrals ? "economic AAV" : null,
        expectedIncentives.size ? "expected playing-time incentives" : null,
        contractScenario ? "conditional option paths" : null,
        tradeProtection !== "none" ? "trade protection" : null,
      ]
        .filter(Boolean)
        .join(" · "),
      refreshed: new Date().toISOString().slice(0, 10),
    },
    risk: isTwoWay ? 14 : isPitcher ? 12 : 7,
    tradeProtection,
    seasons,
    contractScenario,
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
  .map((row) => ({
    id: `prospect-${row.PlayerId || row.ID}`,
    kind: "prospect",
    name: row.playerName,
    team: normalizeTeam(row.Team),
    position: row.positionDB || row.Position || "—",
    age: Math.floor(Number(row.Age) || 20),
    source: {
      projection: "FanGraphs The Board",
      contract: "FV, ETA, scouting risk & roster status",
      refreshed: new Date().toISOString().slice(0, 10),
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
  }));

const teams = teamRows
  .map((team) => ({ abbr: normalizeTeam(team.AbbName), name: team.FullName }))
  .filter((team) => teamSlugs[team.abbr])
  .sort((a, b) => a.name.localeCompare(b.name));

const players = [...mlb, ...prospects].sort(
  (a, b) =>
    a.team.localeCompare(b.team) ||
    a.kind.localeCompare(b.kind) ||
    a.name.localeCompare(b.name),
);
const output = {
  meta: {
    refreshed: new Date().toISOString().slice(0, 10),
    baseYear: BASE_YEAR,
    mlbCount: mlb.length,
    prospectCount: prospects.length,
    projectionPriority: ["ZiPS", "Steamer", "Marcel + aging"],
    seasonRemainingFraction: Number(seasonRemainingFraction.toFixed(4)),
    sources: [
      "FanGraphs projections",
      "FanGraphs RosterResource",
      "FanGraphs The Board",
    ],
  },
  teams,
  players,
};

await mkdir(new URL("../app/data/", import.meta.url), { recursive: true });
await writeFile(OUT, `${JSON.stringify(output)}\n`);
console.log(
  `Wrote ${players.length} players (${mlb.length} MLB, ${prospects.length} prospects) to ${OUT.pathname}`,
);
