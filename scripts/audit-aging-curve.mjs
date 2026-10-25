const leaderboardUrl =
  "https://www.fangraphs.com/api/leaders/major-league/data?pos=all&stats=bat&lg=all&qual=0&type=8&season=2025&season1=2016&ind=1&pageitems=10000&pagenum=1";

const response = await fetch(leaderboardUrl, {
  headers: {
    "user-agent":
      "DugoutValueAgingAudit/1.0 (public FanGraphs season-level data)",
  },
});
if (!response.ok)
  throw new Error(`FanGraphs aging-audit download failed: ${response.status}`);
const payload = await response.json();
const rows = payload.data ?? [];

const byPlayerSeason = new Map(
  rows.map((row) => [`${row.playerid}:${row.Season}`, row]),
);

const ageBand = (age) =>
  age <= 26
    ? "through 26"
    : age <= 29
      ? "27-29"
      : age <= 32
        ? "30-32"
        : age <= 35
          ? "33-35"
          : age <= 38
            ? "36-38"
            : "39+";

const positionGroup = (position) => {
  const tokens = String(position ?? "")
    .split(/[\/,-]/)
    .map((token) => token.trim());
  if (tokens.includes("C")) return "catcher";
  if (tokens.some((token) => ["SS", "2B", "CF"].includes(token)))
    return "up-the-middle";
  return "corner/DH";
};

const weightedMean = (values, valueKey, weightKey) => {
  const denominator = values.reduce(
    (sum, value) => sum + Math.max(0, value[weightKey]),
    0,
  );
  if (!denominator) return 0;
  return (
    values.reduce(
      (sum, value) =>
        sum + value[valueKey] * Math.max(0, value[weightKey]),
      0,
    ) / denominator
  );
};

const quantile = (values, percentile) => {
  const sorted = values.toSorted((left, right) => left - right);
  if (!sorted.length) return 0;
  const index = (sorted.length - 1) * percentile;
  const lower = Math.floor(index);
  const fraction = index - lower;
  return sorted[lower + 1] === undefined
    ? sorted[lower]
    : sorted[lower] + fraction * (sorted[lower + 1] - sorted[lower]);
};

const transitions = [];
for (const row of rows) {
  const pa = Number(row.PA) || 0;
  const age = Number(row.Age);
  const season = Number(row.Season);
  if (
    pa < 250 ||
    !Number.isFinite(age) ||
    season >= 2025 ||
    season === 2020 ||
    season + 1 === 2020
  )
    continue;
  const next = byPlayerSeason.get(`${row.playerid}:${season + 1}`);
  const nextPa = Number(next?.PA) || 0;
  const nextWar = Number(next?.WAR) || 0;
  const war = Number(row.WAR) || 0;
  const survived = nextPa >= 150;
  const transition = {
    age: age + 1,
    ageBand: ageBand(age + 1),
    positionGroup: positionGroup(row.positionDB || row.position),
    war,
    nextWar,
    totalDelta: nextWar - war,
    pa,
    nextPa,
    retention: Math.min(1.25, nextPa / pa),
    survived,
    rateDelta: survived
      ? (nextWar / nextPa - war / pa) * 600
      : null,
    weight: survived ? Math.min(pa, nextPa, 600) : Math.min(pa, 600),
  };
  transitions.push(transition);
}

const summarize = (label, values) => {
  const survivors = values.filter((value) => value.survived);
  return {
    group: label,
    n: values.length,
    survivorRate: Number(
      (values.filter((value) => value.nextPa >= 150).length / values.length).toFixed(
        3,
      ),
    ),
    medianPaRetention: Number(
      quantile(
        values.map((value) => value.retention),
        0.5,
      ).toFixed(3),
    ),
    meanTotalWarDelta: Number(
      weightedMean(values, "totalDelta", "weight").toFixed(3),
    ),
    survivorWarPer600Delta: Number(
      weightedMean(survivors, "rateDelta", "weight").toFixed(3),
    ),
  };
};

const ageSummaries = [...new Set(transitions.map((row) => row.ageBand))].map(
  (band) => summarize(band, transitions.filter((row) => row.ageBand === band)),
);
const positionSummaries = ["up-the-middle", "catcher", "corner/DH"].flatMap(
  (position) =>
    ["30-32", "33-35", "36-38"].map((band) =>
      summarize(
        `${position} ${band}`,
        transitions.filter(
          (row) => row.positionGroup === position && row.ageBand === band,
        ),
      ),
    ),
);
const establishedPlayerSummaries = ["30-32", "33-35", "36-38"].flatMap(
  (band) =>
    [
      ["2+ WAR", (row) => row.war >= 2],
      ["3+ WAR", (row) => row.war >= 3],
      [
        "up-the-middle 2+ WAR",
        (row) => row.positionGroup === "up-the-middle" && row.war >= 2,
      ],
    ].map(([label, predicate]) =>
      summarize(
        `${label} ${band}`,
        transitions.filter((row) => row.ageBand === band && predicate(row)),
      ),
    ),
);

console.log(
  JSON.stringify(
    {
      sourceRows: rows.length,
      transitions: transitions.length,
      ageSummaries,
      positionSummaries,
      establishedPlayerSummaries,
    },
    null,
    2,
  ),
);
