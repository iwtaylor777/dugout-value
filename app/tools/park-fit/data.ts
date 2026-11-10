import data from "../../data/park-fit.json";

export type Season = 2026 | 2025;
export type Mode = "adjusted" | "standard";
export type Park = { id: string; name: string; venue: number; distances: number[]; heights: number[] };
type Line = { slash: number[]; woba: number; hits: number[] };
type ReplayLine = Line & { runs: number; hrFlags: number };
export type Range = number[];
export type Play = {
  id: string; date: string; result: string; ev: number; la: number; spray: number; distance: number | null;
  clears: Record<Mode, string[]>; inPlay: Partial<Record<string, number[]>>;
};
export type Profile = {
  id: string; name: string; year: number; home: string; homePa: number; totalHomePa: number;
  samplePa: number; measuredContact: number; roadPa: number; wobaDen: number; actual: Line;
  generic: number[]; points: number[][]; plays: Play[];
  modes: Record<Mode, { parks: ReplayLine[]; ranges: Range[]; extraRanges: Range[] }>;
};
type ParkPlayer = { id: string; name: string; seasons: Season[] };
export type Selection = { player: string; year: Season; from: string; to: string; pa: number; mode: Mode };
export type Switch = { play: Play; gained: boolean; staysAt: Park; chances: number[]; runs: number };
export const playingTime = [400, 500, 600, 700];
export const defaultSelection: Selection = { player: "673548", year: 2026, from: "", to: "bos", pa: 600, mode: "adjusted" };
export const parkPlayers = data.players as ParkPlayer[];
export const parkSeasons = data.seasons as Season[];
export const availableSeasons = (player: string) => parkPlayers.find(option => option.id === player)?.seasons ?? parkSeasons;
export const parksFor = (year: Season): Park[] => data.parks[year];
export const dateLabel = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
export const battingLine = (slash: number[]) => slash.map(value => value.toFixed(3).replace(/^0/, "")).join(" / ");

export function signed(value: number, precision = 0) {
  const magnitude = Math.abs(value).toFixed(precision);
  return Number(magnitude) ? `${value < 0 ? "−" : "+"}${magnitude}` : magnitude;
}

export function rangeLabel(range: Range, multiplier = 1, precision = 0) {
  return `${signed(range[0] * multiplier, precision)} to ${signed(range[1] * multiplier, precision)}`;
}

export function readSelection(params: URLSearchParams): Selection {
  const player = parkPlayers.find(option => option.id === params.get("p"))?.id ?? defaultSelection.player;
  const requested = Number(params.get("year")) === 2025 ? 2025 : 2026;
  const seasons = availableSeasons(player);
  const year = seasons.includes(requested) ? requested : seasons[0];
  const parks = parksFor(year);
  const from = params.get("from");
  const to = params.get("to");
  const pa = Number(params.get("pa"));
  return {
    player,
    year,
    from: parks.find(park => park.id === from)?.id ?? "",
    to: parks.find(park => park.id === to)?.id ?? defaultSelection.to,
    pa: playingTime.includes(pa) ? pa : defaultSelection.pa,
    mode: params.get("mode") === "standard" ? "standard" : "adjusted",
  };
}

export function selectionUrl(selection: Selection, href: string) {
  const url = new URL(href);
  const values = { p: selection.player, year: String(selection.year), from: selection.from, to: selection.to,
    pa: String(selection.pa), mode: selection.mode };
  for (const [key, value] of Object.entries(values)) {
    if (value) url.searchParams.set(key, value);
    else url.searchParams.delete(key);
  }
  return url;
}

export function parkRange(ranges: Range[], count: number, from: number, to: number) {
  if (from === to) return [0, 0];
  const lower = Math.min(from, to), higher = Math.max(from, to);
  const i = lower * (2 * count - lower - 1) / 2 + higher - lower - 1;
  const [lo, hi] = ranges[i];
  return from < to ? [lo, hi] : [-hi, -lo];
}

export function compare(profile: Profile, mode: Mode, from: number, to: number, pa = data.referencePa) {
  const replay = profile.modes[mode];
  const base = replay.parks[from], target = replay.parks[to];
  const scale = pa / data.referencePa;
  const runs = (target.runs - base.runs) * scale;
  const generic = (profile.generic[to] - profile.generic[from]) * scale;
  const range = parkRange(replay.ranges, replay.parks.length, from, to).map(bound => bound * scale);
  const extraRange = parkRange(replay.extraRanges, replay.parks.length, from, to).map(bound => bound * scale);
  return {
    runs, generic, extra: runs - generic, range, extraRange,
    wobaPoints: (target.woba - base.woba) * 1000,
    runsToWobaPoints: data.wobaScale * 1000 / (profile.wobaDen * scale),
    wins: runs / data.runsPerWin, runsToWins: 1 / data.runsPerWin,
    hits: target.hits.map((hits, i) => (hits - base.hits[i]) * scale),
    base, target, scale,
  };
}

export function switchesFor(profile: Profile, mode: Mode, from: Park, to: Park) {
  const switched: Switch[] = [];
  for (const play of profile.plays) {
    const before = play.clears[mode].includes(from.id);
    const after = play.clears[mode].includes(to.id);
    if (before === after) continue;
    const staysAt = after ? from : to;
    const chances = play.inPlay[staysAt.id]!;
    const inPlayRuns = chances.reduce((sum, p, i) => sum + p * data.runWeights[i], 0);
    const runs = data.runWeights[4] - inPlayRuns;
    switched.push({ play, gained: after, staysAt, chances, runs: after ? runs : -runs });
  }
  return switched.sort((a, b) => Math.abs(b.runs) - Math.abs(a.runs));
}
