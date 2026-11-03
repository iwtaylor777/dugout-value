const normalize = (value) => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/-/g, " ").trim();

export const PROJECTION_POSITIONS = [
  ["C", "Catcher"], ["1B", "First base"], ["2B", "Second base"],
  ["3B", "Third base"], ["SS", "Shortstop"], ["LF", "Left field"],
  ["CF", "Center field"], ["RF", "Right field"], ["OF", "Outfield"],
  ["DH", "Designated hitter"], ["SP", "Starting pitcher"], ["RP", "Relief pitcher"],
];

const aliases = new Map();
for (const [position, label] of PROJECTION_POSITIONS) {
  aliases.set(position.toLowerCase(), position);
  aliases.set(normalize(label), position);
}
for (const [position, words] of Object.entries({
  C: ["catchers"], "1B": ["first baseman", "first basemen"],
  "2B": ["second baseman", "second basemen"], "3B": ["third baseman", "third basemen"],
  SS: ["shortstops"], LF: ["left fielder", "left fielders"],
  CF: ["center fielder", "center fielders", "centre field", "centre fielder"],
  RF: ["right fielder", "right fielders"], OF: ["outfielder", "outfielders"],
  DH: ["designated hitters"], SP: ["starting pitchers", "starter", "starters"],
  RP: ["relief pitchers", "reliever", "relievers"], P: ["pitcher", "pitchers", "p"],
  position: ["hitter", "hitters", "position player", "position players"],
  "two-way": ["two way", "two way player", "two way players", "twp"],
})) for (const word of words) aliases.set(word, position);

export function matchesProjectionRole(player, filter) {
  if (filter === "all") return true;
  const positions = String(player.position ?? "").toUpperCase().split(/[\s/,]+/);
  const role = player.role ?? (positions.some(p => ["P", "SP", "RP"].includes(p)) ? "starter" : "position");
  if (["position", "starter", "reliever", "two-way"].includes(filter)) return role === filter;
  if (filter === "OF") return positions.some(p => ["LF", "CF", "RF", "OF"].includes(p));
  if (filter === "P") return positions.some(p => ["P", "SP", "RP", "TWP"].includes(p)) || ["starter", "reliever", "two-way"].includes(role);
  if (filter === "SP" && positions.includes("P")) return role === "starter";
  if (filter === "RP" && positions.includes("P")) return role === "reliever";
  return positions.includes(filter);
}

// Match position words as complete terms, not substrings of player/team names.
// Longest phrases are consumed first, so "Boston first baseman" works too.
export function matchesProjectionSearch(player, query, teamName = "") {
  const text = normalize(`${player.name} ${player.team} ${teamName}`);
  const words = normalize(query).split(/\s+/).filter(Boolean);
  for (let i = 0; i < words.length;) {
    let position;
    let length = 0;
    for (let n = Math.min(3, words.length - i); n > 0; n--) {
      const match = aliases.get(words.slice(i, i + n).join(" "));
      if (match) { position = match; length = n; break; }
    }
    if (position) {
      if (!matchesProjectionRole(player, position)) return false;
      i += length;
    } else {
      if (!text.includes(words[i])) return false;
      i++;
    }
  }
  return true;
}

export function laterProjectionWar(war) {
  const values = [2029, 2030, 2031].map(year => war?.[year]);
  return values.every(value => typeof value === "number" && Number.isFinite(value))
    ? values.reduce((sum, value) => sum + value, 0) : null;
}
