const recognizedPositions = new Set([
  "C",
  "1B",
  "2B",
  "3B",
  "SS",
  "LF",
  "CF",
  "RF",
  "OF",
  "DH",
  "SP",
  "RP",
  "TWP",
]);

const positionTokens = (value) =>
  String(value ?? "")
    .toUpperCase()
    .split(/[\/,]/)
    .map((token) => token.trim())
    .filter((token) => recognizedPositions.has(token));

const rosterPriority = (row) => {
  const type = String(row?.type ?? "").toLowerCase();
  if (["mlb-sl", "mlb-sp", "mlb-bp"].includes(type)) return 100;
  if (type === "mlb-bn") return 95;
  if (type.startsWith("il-")) return 90;
  if (String(row?.role ?? "").toUpperCase() === "DFA") return 85;
  if (type.startsWith("aaa-")) return 70;
  if (type.startsWith("aa-")) return 60;
  return 50;
};

const preciseDepthPosition = (row, eligibleTokens) => {
  const listed = String(row?.position ?? "").toUpperCase().trim();
  if (recognizedPositions.has(listed)) return listed;
  return eligibleTokens[0] ?? null;
};

export function rosterAssignmentsFromDepthChart(rows, team) {
  const assignments = new Map();
  for (const row of rows ?? []) {
    const id = String(row?.mlbamid ?? row?.mlbamid1 ?? row?.mlbamid2 ?? "");
    if (!id) continue;
    const eligibleTokens = positionTokens(row?.position1 ?? row?.position);
    const depthPosition = preciseDepthPosition(row, eligibleTokens);
    if (!depthPosition && !eligibleTokens.length) continue;
    const priority = rosterPriority(row);
    const existing = assignments.get(id);
    if (existing && existing.priority > priority) continue;
    assignments.set(id, {
      team,
      depthPosition: depthPosition ?? eligibleTokens[0],
      eligiblePosition:
        eligibleTokens.join("/") || depthPosition || String(row?.position ?? ""),
      playerName: row?.playerNameDisplay || row?.player || row?.playerName,
      playerId: String(row?.playerid ?? row?.playerid1 ?? row?.playerid2 ?? ""),
      age: Number(row?.age1 ?? row?.age) || null,
      serviceTime: Number.parseFloat(row?.servicetime1 ?? row?.servicetime) || 0,
      actualWar: Number(row?.actual_WAR) || 0,
      projectedWar: Number(row?.proj_WAR) || 0,
      activeRoster:
        /^(mlb|il)-/.test(String(row?.type ?? "").toLowerCase()) ||
        String(row?.role ?? "").toUpperCase() === "DFA",
      priority,
    });
  }
  return assignments;
}
