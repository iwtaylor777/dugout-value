export const DISCOVERY_POSITIONS = Object.freeze([
  { id: "C", label: "Catcher", shortLabel: "C", slots: 1 },
  { id: "1B", label: "First base", shortLabel: "1B", slots: 1 },
  { id: "2B", label: "Second base", shortLabel: "2B", slots: 1 },
  { id: "3B", label: "Third base", shortLabel: "3B", slots: 1 },
  { id: "SS", label: "Shortstop", shortLabel: "SS", slots: 1 },
  { id: "OF", label: "Outfield", shortLabel: "OF", slots: 3 },
  { id: "SP", label: "Rotation", shortLabel: "SP", slots: 5 },
  { id: "RP", label: "Bullpen", shortLabel: "RP", slots: 7 },
]);

const positionById = new Map(
  DISCOVERY_POSITIONS.map((position) => [position.id, position]),
);
const outfieldTokens = new Set(["OF", "LF", "CF", "RF"]);

const positionTokens = (player) =>
  String(player?.position ?? "")
    .toUpperCase()
    .split(/[\/,]/)
    .map((token) => token.trim())
    .filter(Boolean);

export function playerFitsPosition(player, position) {
  if (!player || player.kind !== "mlb" || !positionById.has(position))
    return false;
  if (position === "SP")
    return player.role === "starter" || positionTokens(player).includes("SP");
  if (position === "RP")
    return player.role === "reliever" || positionTokens(player).includes("RP");
  if (player.role === "starter" || player.role === "reliever") return false;
  const tokens = positionTokens(player);
  if (position === "OF") return tokens.some((token) => outfieldTokens.has(token));
  return tokens.includes(position);
}

export function primaryPositionGroup(player) {
  if (!player || player.kind !== "mlb") return null;
  const hasDepthAssignment = Boolean(player.depthPosition);
  const depthTokens = positionTokens({
    position: player.depthPosition ?? player.position,
  });
  for (const token of depthTokens) {
    if (token === "SP" || token === "RP") return token;
    if (outfieldTokens.has(token)) return "OF";
    if (["C", "1B", "2B", "3B", "SS"].includes(token)) return token;
  }
  if (hasDepthAssignment) return null;
  if (player.role === "starter") return "SP";
  if (player.role === "reliever") return "RP";
  const tokens = positionTokens(player);
  for (const token of tokens) {
    if (outfieldTokens.has(token)) return "OF";
    if (["C", "1B", "2B", "3B", "SS"].includes(token)) return token;
  }
  return null;
}

export function restOfSeasonWar(player, baseYear) {
  if (!player || player.kind !== "mlb") return 0;
  const season = (player.seasons ?? []).find(
    (candidate) => Number(candidate.year) === Number(baseYear),
  );
  return Number(season?.war) || 0;
}

export function seasonToDateWar(player, baseYear) {
  if (!player || player.kind !== "mlb") return 0;
  if (Number.isFinite(Number(player.seasonToDateWar)))
    return Number(player.seasonToDateWar);
  // Older snapshots stored projected full-season WAR as platformWar. Back out
  // the explicit rest-of-season component to recover season-to-date WAR.
  return (Number(player.platformWar) || 0) - restOfSeasonWar(player, baseYear);
}

const rounded = (value) => Number(value.toFixed(2));

function positionProfile(players, team, position, baseYear) {
  const group = players.filter(
    (player) =>
      player.kind === "mlb" &&
      player.team === team &&
      primaryPositionGroup(player) === position,
  );
  return {
    position,
    seasonToDateWar: rounded(
      group.reduce((sum, player) => sum + seasonToDateWar(player, baseYear), 0),
    ),
    restOfSeasonWar: rounded(
      group.reduce((sum, player) => sum + restOfSeasonWar(player, baseYear), 0),
    ),
    playerCount: group.length,
  };
}

const descendingRank = (value, values) =>
  1 + values.filter((candidate) => candidate > value + 0.0001).length;

export function rankTeamNeeds(players, teams, team, baseYear) {
  const teamIds = teams.map((candidate) =>
    typeof candidate === "string" ? candidate : candidate.abbr,
  );
  const profiles = new Map(
    teamIds.map((teamId) => [
      teamId,
      new Map(
        DISCOVERY_POSITIONS.map((position) => [
          position.id,
          positionProfile(players, teamId, position.id, baseYear),
        ]),
      ),
    ]),
  );
  const denominator = Math.max(1, teamIds.length - 1);
  return DISCOVERY_POSITIONS.map((position) => {
    const current = profiles.get(team)?.get(position.id) ?? {
      position: position.id,
      seasonToDateWar: 0,
      restOfSeasonWar: 0,
      playerCount: 0,
    };
    const seasonToDateValues = teamIds.map(
      (teamId) => profiles.get(teamId)?.get(position.id)?.seasonToDateWar ?? 0,
    );
    const restOfSeasonValues = teamIds.map(
      (teamId) => profiles.get(teamId)?.get(position.id)?.restOfSeasonWar ?? 0,
    );
    const seasonToDateRank = descendingRank(
      current.seasonToDateWar,
      seasonToDateValues,
    );
    const restOfSeasonRank = descendingRank(
      current.restOfSeasonWar,
      restOfSeasonValues,
    );
    const needScore =
      100 *
      (0.45 * ((seasonToDateRank - 1) / denominator) +
        0.55 * ((restOfSeasonRank - 1) / denominator));
    return {
      ...position,
      ...current,
      seasonToDateRank,
      restOfSeasonRank,
      needScore: rounded(needScore),
      needLabel:
        needScore >= 72
          ? "Clear need"
          : needScore >= 52
            ? "Worth a look"
            : "Relative strength",
    };
  }).sort(
    (left, right) =>
      right.needScore - left.needScore ||
      right.restOfSeasonRank - left.restOfSeasonRank,
  );
}

export function incumbentRestOfSeasonWar(players, team, position, baseYear) {
  const slots = positionById.get(position)?.slots ?? 1;
  const teamPlayers = players.filter(
    (player) => player.kind === "mlb" && player.team === team,
  );
  const assigned = teamPlayers.filter(
    (player) => primaryPositionGroup(player) === position,
  );
  const options = (assigned.length
    ? assigned
    : teamPlayers.filter((player) => playerFitsPosition(player, position))
  )
    .map((player) => restOfSeasonWar(player, baseYear))
    .sort((left, right) => right - left);
  return rounded(options[slots - 1] ?? 0);
}

export function findTradeTargets({
  players,
  values,
  buyerTeam,
  position,
  playoffOdds,
  sellerThreshold = 35,
  baseYear,
  limit = 12,
}) {
  const incumbentWar = incumbentRestOfSeasonWar(
    players,
    buyerTeam,
    position,
    baseYear,
  );
  return players
    .filter(
      (player) =>
        !player.custom &&
        player.kind === "mlb" &&
        player.team !== buyerTeam &&
        Number(playoffOdds[player.team]) <= sellerThreshold &&
        playerFitsPosition(player, position),
    )
    .map((player) => {
      const playerWar = restOfSeasonWar(player, baseYear);
      const improvement = playerWar - incumbentWar;
      const controlThrough = Math.max(
        baseYear,
        ...(player.seasons ?? []).map((season) => Number(season.year) || baseYear),
      );
      const controlYears = Math.max(1, controlThrough - baseYear + 1);
      const controlFactor =
        controlYears === 1
          ? 1.35
          : controlYears === 2
            ? 1.15
            : controlYears === 3
              ? 1
              : controlYears === 4
                ? 0.8
                : 0.55;
      const ageFactor = Number(player.age) >= 30 ? 1.08 : Number(player.age) <= 25 ? 0.88 : 1;
      const consentFactor = player.tradeProtection === "full" ? 0.6 : 1;
      const healthFactor = player.availability ? 0.72 : 1;
      const coreFactor = (Number(values[player.id]?.total) || 0) >= 75 ? 0.85 : 1;
      return {
        id: player.id,
        player,
        incumbentWar,
        restOfSeasonWar: rounded(playerWar),
        improvement: rounded(improvement),
        playoffOdds: Number(playoffOdds[player.team]) || 0,
        tradeValue: rounded(Number(values[player.id]?.total) || 0),
        controlThrough,
        controlYears,
        deadlineLabel:
          controlYears === 1
            ? "Rental"
            : controlYears === 2
              ? "Short control"
              : controlYears <= 4
                ? "Controllable"
                : "Long-term control",
        deadlineFit: rounded(
          improvement *
            controlFactor *
            ageFactor *
            consentFactor *
            healthFactor *
            coreFactor,
        ),
      };
    })
    .filter((target) => target.improvement > 0.05)
    .sort(
      (left, right) =>
        right.deadlineFit - left.deadlineFit ||
        right.improvement - left.improvement ||
        left.playoffOdds - right.playoffOdds ||
        right.tradeValue - left.tradeValue,
    )
    .slice(0, limit);
}

function currentSalaryMode(player, baseYear) {
  return String(
    (player.seasons ?? []).find(
      (season) => Number(season.year) === Number(baseYear),
    )?.salaryMode ?? "",
  );
}

function offerAssetPool(players, values, buyerTeam, holePosition, baseYear, target) {
  const maximumAssetValue = Math.max(target * 1.35, target + 5);
  return players
    .filter((player) => !player.custom && player.team === buyerTeam)
    .filter((player) => {
      if (player.kind === "prospect") return true;
      const mode = currentSalaryMode(player, baseYear);
      const costControlled = mode === "prearb" || mode.startsWith("arb");
      return (
        costControlled &&
        Number(player.age) <= 29 &&
        !playerFitsPosition(player, holePosition)
      );
    })
    .map((player) => ({
      id: player.id,
      player,
      value: Number(values[player.id]?.total) || 0,
    }))
    .filter(
      (asset) => asset.value >= 0.5 && asset.value <= maximumAssetValue,
    )
    .sort((left, right) => right.value - left.value)
    .slice(0, 60);
}

function offerCombinations(pool, target) {
  const combinations = [];
  const add = (assets) => {
    const total = assets.reduce((sum, asset) => sum + asset.value, 0);
    const difference = Math.abs(total - target) / Math.max(1, target);
    const overpay = Math.max(0, total - target) / Math.max(1, target);
    combinations.push({
      assets,
      assetIds: assets.map((asset) => asset.id),
      total: rounded(total),
      gap: rounded(total - target),
      score: difference + overpay * 0.18 + assets.length * 0.008,
    });
  };
  for (let first = 0; first < pool.length; first += 1) {
    add([pool[first]]);
    for (let second = first + 1; second < pool.length; second += 1) {
      add([pool[first], pool[second]]);
      for (let third = second + 1; third < pool.length; third += 1)
        add([pool[first], pool[second], pool[third]]);
    }
  }
  return combinations.sort((left, right) => left.score - right.score);
}

const offerShape = (offer) => {
  if (offer.assets.length === 1) return "One-for-one";
  const largestShare = Math.max(...offer.assets.map((asset) => asset.value)) / offer.total;
  if (offer.assets.every((asset) => asset.player.kind === "prospect"))
    return "Prospect package";
  if (largestShare >= 0.65) return "Headliner + piece";
  return "Depth package";
};

export function generateOfferPackages({
  players,
  values,
  buyerTeam,
  holePosition,
  targetValue,
  baseYear,
  limit = 3,
}) {
  const target = Math.max(1, Number(targetValue) || 0);
  const pool = offerAssetPool(
    players,
    values,
    buyerTeam,
    holePosition,
    baseYear,
    target,
  );
  if (!pool.length) return [];
  if (Number(targetValue) <= 0) {
    const asset = [...pool].sort((left, right) => left.value - right.value)[0];
    return [
      {
        label: "Salary-relief framework",
        assetIds: [asset.id],
        assets: [asset],
        total: rounded(asset.value),
        gap: rounded(asset.value - Number(targetValue || 0)),
        salaryRelief: true,
      },
    ];
  }

  const combinations = offerCombinations(pool, target);
  const viable = combinations.filter(
    (offer) => Math.abs(offer.gap) / Math.max(1, target) <= 0.3,
  );
  const preferredShapes = [
    {
      label: "Prospect-led",
      matches: (offer) =>
        offer.assets.length >= 2 &&
        offer.assets.every((asset) => asset.player.kind === "prospect"),
    },
    {
      label: "Headliner + piece",
      matches: (offer) =>
        offer.assets.length === 2 &&
        Math.max(...offer.assets.map((asset) => asset.value)) / offer.total >= 0.65,
    },
    {
      label: "Depth package",
      matches: (offer) =>
        offer.assets.length === 3 &&
        Math.max(...offer.assets.map((asset) => asset.value)) / offer.total < 0.7,
    },
  ];
  const selected = [];
  const signatures = new Set();
  for (const shape of preferredShapes) {
    const offer = viable.find(
      (candidate) =>
        shape.matches(candidate) &&
        !signatures.has([...candidate.assetIds].sort().join("|")),
    );
    if (!offer) continue;
    signatures.add([...offer.assetIds].sort().join("|"));
    selected.push({ ...offer, label: shape.label, salaryRelief: false });
  }
  for (const offer of viable) {
    if (selected.length >= limit) break;
    const signature = [...offer.assetIds].sort().join("|");
    if (signatures.has(signature)) continue;
    signatures.add(signature);
    selected.push({ ...offer, label: offerShape(offer), salaryRelief: false });
  }
  return selected.slice(0, limit);
}
