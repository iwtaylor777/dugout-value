import { readFile } from "node:fs/promises";

const BASE_YEAR = 2026;
const database = JSON.parse(
  await readFile(new URL("../app/data/player-database.json", import.meta.url)),
);

const leaderUrl = (stats) =>
  `https://www.fangraphs.com/api/leaders/major-league/data?pos=all&stats=${stats}&lg=all&qual=0&type=8&season=${BASE_YEAR - 1}&season1=${BASE_YEAR - 1}&ind=1&pageitems=10000&pagenum=1`;

async function loadLeaders(stats) {
  const response = await fetch(leaderUrl(stats), {
    headers: {
      "user-agent":
        "DugoutValueCalibration/1.0 (public-source model validation)",
    },
  });
  if (!response.ok)
    throw new Error(`FanGraphs ${stats} leaders: ${response.status}`);
  return (await response.json()).data ?? [];
}

function solve(matrix, vector) {
  const augmented = matrix.map((row, index) => [...row, vector[index]]);
  for (let column = 0; column < augmented.length; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < augmented.length; row += 1) {
      if (
        Math.abs(augmented[row][column]) >
        Math.abs(augmented[pivot][column])
      )
        pivot = row;
    }
    [augmented[column], augmented[pivot]] = [
      augmented[pivot],
      augmented[column],
    ];
    const divisor = augmented[column][column] || 1e-9;
    for (let index = column; index <= augmented.length; index += 1)
      augmented[column][index] /= divisor;
    for (let row = 0; row < augmented.length; row += 1) {
      if (row === column) continue;
      const multiplier = augmented[row][column];
      for (let index = column; index <= augmented.length; index += 1)
        augmented[row][index] -= multiplier * augmented[column][index];
    }
  }
  return augmented.map((row) => row[augmented.length]);
}

function fit(rows, keys, lambda = 0) {
  const means = keys.map(
    (key) =>
      rows.reduce((sum, row) => sum + (Number(row.stats[key]) || 0), 0) /
      rows.length,
  );
  const deviations = keys.map(
    (key, index) =>
      Math.sqrt(
        rows.reduce(
          (sum, row) =>
            sum +
            Math.pow((Number(row.stats[key]) || 0) - means[index], 2),
          0,
        ) / rows.length,
      ) || 1,
  );
  const inputs = rows.map((row) => [
    1,
    ...keys.map(
      (key, index) =>
        ((Number(row.stats[key]) || 0) - means[index]) / deviations[index],
    ),
  ]);
  const outputs = rows.map((row) => row.salary);
  const matrix = Array.from({ length: inputs[0].length }, (_, left) =>
    Array.from(
      { length: inputs[0].length },
      (_, right) =>
        inputs.reduce(
          (sum, input) => sum + input[left] * input[right],
          0,
        ) + (left === right && left > 0 ? lambda : 0),
    ),
  );
  const vector = Array.from({ length: inputs[0].length }, (_, index) =>
    inputs.reduce(
      (sum, input, rowIndex) => sum + input[index] * outputs[rowIndex],
      0,
    ),
  );
  const coefficients = solve(matrix, vector);
  const predict = (row) =>
    coefficients[0] +
    keys.reduce(
      (sum, key, index) =>
        sum +
        coefficients[index + 1] *
          (((Number(row.stats[key]) || 0) - means[index]) /
            deviations[index]),
      0,
    );
  return { coefficients, deviations, means, predict };
}

function mae(rows, predict) {
  return (
    rows.reduce(
      (sum, row) => sum + Math.abs(Math.max(0.8, predict(row)) - row.salary),
      0,
    ) / rows.length
  );
}

function leaveOneOut(rows, keys, lambda) {
  return (
    rows.reduce((sum, row, index) => {
      const model = fit(
        rows.filter((_, rowIndex) => rowIndex !== index),
        keys,
        lambda,
      );
      return (
        sum + Math.abs(Math.max(0.8, model.predict(row)) - row.salary)
      );
    }, 0) / rows.length
  );
}

function leaveOneOutWithElitePremium(
  rows,
  keys,
  lambda,
  threshold,
  premium,
) {
  return (
    rows.reduce((sum, row, index) => {
      const model = fit(
        rows.filter((_, rowIndex) => rowIndex !== index),
        keys,
        lambda,
      );
      const war = Number(row.stats.WAR) || 0;
      const estimate =
        model.predict(row) +
        premium * Math.pow(Math.max(0, war - threshold), 2);
      return sum + Math.abs(Math.max(0.8, estimate) - row.salary);
    }, 0) / rows.length
  );
}

const [batting, pitching] = await Promise.all([
  loadLeaders("bat"),
  loadLeaders("pit"),
]);
const battingById = new Map(
  batting.map((row) => [String(row.xMLBAMID), row]),
);
const pitchingById = new Map(
  pitching.map((row) => [String(row.xMLBAMID), row]),
);
const groups = { position: [], starter: [], reliever: [] };

for (const player of database.players.filter((item) => item.kind === "mlb")) {
  const nextSeason = player.seasons.find(
    (season) =>
      season.year === BASE_YEAR + 1 &&
      String(season.salaryMode).startsWith("arb"),
  );
  const currentSeason = player.seasons.find(
    (season) => season.year === BASE_YEAR,
  );
  const priorArbYear = Number(nextSeason?.salaryMode.slice(3)) - 1;
  if (!currentSeason || priorArbYear !== 1) continue;
  const id = player.id.replace(/^mlb-/, "");
  const stats =
    player.role === "position"
      ? battingById.get(id)
      : pitchingById.get(id);
  if (!stats || !groups[player.role]) continue;
  groups[player.role].push({
    name: player.name,
    salary: currentSeason.annualSalary,
    stats,
  });
}

const specifications = {
  position: [
    ["WAR"],
    ["PA", "HR", "RBI", "SB", "AVG"],
    ["PA", "HR", "RBI", "SB", "AVG", "WAR"],
  ],
  starter: [
    ["WAR"],
    ["IP", "GS", "W", "ERA", "SO"],
    ["IP", "GS", "W", "ERA", "SO", "WAR"],
  ],
  reliever: [
    ["WAR"],
    ["IP", "G", "SV", "HLD", "ERA", "SO"],
    ["IP", "G", "SV", "HLD", "ERA", "SO", "WAR"],
  ],
};

const allFirstYearRows = Object.values(groups).flat();
const legacyMae = mae(allFirstYearRows, (row) =>
  Math.max(2.5, Math.min(12, 1.5 + 1.8 * Math.max(0, Number(row.stats.WAR) || 0))),
);
console.log(
  `Legacy WAR-only formula · ${allFirstYearRows.length} salaries · $${legacyMae.toFixed(2)}M MAE`,
);

for (const [role, rows] of Object.entries(groups)) {
  console.log(`\n${role} · ${rows.length} first-year arbitration salaries`);
  for (const keys of specifications[role]) {
    for (const lambda of [0, 2, 5, 10]) {
      const model = fit(rows, keys, lambda);
      console.log({
        inputs: keys.join(", "),
        lambda,
        trainingMae: Number(mae(rows, model.predict).toFixed(3)),
        leaveOneOutMae: Number(
          leaveOneOut(rows, keys, lambda).toFixed(3),
        ),
        coefficients: model.coefficients.map((value) =>
          Number(value.toFixed(4)),
        ),
        means: model.means.map((value) => Number(value.toFixed(3))),
        deviations: model.deviations.map((value) =>
          Number(value.toFixed(3)),
        ),
      });
    }
  }
  if (role !== "reliever") {
    const keys = specifications[role][2];
    console.log("Elite-performance sensitivity");
    for (const threshold of [3, 3.5, 4]) {
      for (const premium of [0, 0.25, 0.5, 0.75, 1])
        console.log({
          threshold,
          premium,
          leaveOneOutMae: Number(
            leaveOneOutWithElitePremium(
              rows,
              keys,
              10,
              threshold,
              premium,
            ).toFixed(3),
          ),
        });
    }
  }
}
