"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import databaseJson from "./data/player-database.json";
import playoffOddsJson from "./data/playoff-odds.json";
import {
  effectiveSeasons,
  initialSettings as modelInitialSettings,
  prospectValues as modelProspectValues,
  valuePlayer,
} from "../lib/value-model.mjs";
import { SnapshotNotice } from "./site-shell";
import { buildTradeShareUrl, decodeTradeState, isLegacySettingsLink, restoreSharedSettings, sharedModelWarning, sharedSnapshotWarning, TRADE_SHARE_MODEL_VERSION } from "../lib/trade-share.mjs";
import {
  MAX_CASH_AMOUNT,
  normalizeCashAmount,
  packageConsolidation,
  packageRange,
} from "../lib/trade-package.mjs";
import {
  DISCOVERY_POSITIONS,
  findTradeTargets,
  generateOfferPackages,
  rankTeamNeeds,
} from "../lib/trade-discovery.mjs";
import type {
  DiscoveryOffer,
  DiscoveryOfferAsset,
  DiscoveryPosition,
  DiscoveryTarget,
} from "../lib/trade-discovery.mjs";

type SalaryMode =
  | "fixed"
  | "prearb"
  | "arb1"
  | "arb2"
  | "arb3"
  | "arb4"
  | "clubOption"
  | "playerOption"
  | "mutualOption"
  | "vestingOption";
type ProspectType = "Hitter" | "Pitcher";
type RookieMode = "projection" | "blend" | "prospect";
type ProspectRosterContext = "none" | "rule5" | "on40" | "crunch";
type TradeProtection = "none" | "partial" | "full";
type Availability = {
  status: string;
  injury: string;
  latestUpdate: string;
  eligibleDate?: string;
  returnDate?: string;
  riskAdjustment: number;
};
type Provenance = { projection: string; contract: string; refreshed: string };
type ArbitrationMetrics = Partial<{
  pa: number;
  hr: number;
  rbi: number;
  sb: number;
  avg: number;
  ip: number;
  gs: number;
  g: number;
  w: number;
  sv: number;
  hld: number;
  era: number;
  so: number;
  war: number;
}>;
type TalentProviderChange = {
  name: string;
  unitLabel: string;
  baselineRate: number;
  updatedRate: number;
  changeRate: number;
  rawChangeRate?: number;
  offenseChangeRate?: number | null;
  nonoffenseChangeRate?: number | null;
  roleGuarded?: boolean;
};
type TalentUpdate = {
  method: string;
  unitLabel: string;
  rateChange: number | null;
  capped: boolean;
  roleGuarded?: boolean;
  providers: TalentProviderChange[];
};
type AgingModel = {
  method: string;
  role: "position" | "starter" | "reliever";
  profile:
    | "up-the-middle"
    | "catcher"
    | "corner"
    | "starter"
    | "reliever"
    | "two-way";
  unitLabel: string;
  baseAge: number;
  rateTrend: number | null;
  workloadRetention: number | null;
  anchorYear: number;
};
type ThreeYearProjectionSeason = {
  year: number;
  war: number;
  projectionBaselineWar?: number;
  inSeasonAdjustment?: number;
  signalPersistence?: number;
};
type MLBSeason = {
  year: number;
  war: number;
  projectionBaselineWar?: number;
  inSeasonAdjustment?: number;
  signalPersistence?: number;
  salary: number;
  annualSalary?: number;
  expectedIncentives?: number;
  salaryMode: SalaryMode;
  contractType?: SalaryMode;
  ros?: boolean;
  optionBuyout?: number;
  optionProbability?: number;
  arbMetrics?: ArbitrationMetrics;
};
type LastProspect = {
  fv: string;
  rank: number | null;
  year: number;
  serviceTime: number;
  risk: string | null;
};
type ContractScenarioOption = {
  id: string;
  label: string;
  description: string;
  seasons: MLBSeason[];
};
type ContractScenario = {
  startYear: number;
  selectedId: string;
  note: string;
  options: ContractScenarioOption[];
};
type FutureProjectionUpdate = {
  provider: "ZiPS";
  series: string;
  rank: number;
  sourceUrl: string;
  projections: Record<string, number>;
};
type MLBPlayer = {
  id: string;
  kind: "mlb";
  name: string;
  team: string;
  position: string;
  depthPosition?: string;
  role?: "position" | "starter" | "reliever" | "two-way";
  age: number;
  source: Provenance;
  risk: number;
  tradeProtection?: TradeProtection;
  availability?: Availability;
  seasons: MLBSeason[];
  contractScenario?: ContractScenario;
  talentUpdate?: TalentUpdate;
  futureProjectionUpdate?: FutureProjectionUpdate;
  agingModel?: AgingModel;
  threeYearProjection?: ThreeYearProjectionSeason[];
  seasonToDateWar?: number;
  platformWar?: number;
  rookieMode?: RookieMode;
  lastProspect?: LastProspect | null;
  custom?: boolean;
};
type ProspectPlayer = {
  id: string;
  kind: "prospect";
  name: string;
  team: string;
  position: string;
  age: number;
  source: Provenance;
  prospectType: ProspectType;
  fv: string;
  eta: number;
  adjustment: number;
  rosterContext?: ProspectRosterContext;
  riskLabel?: string | null;
  rank?: number | null;
  futureProjectionUpdate?: FutureProjectionUpdate;
  custom?: boolean;
};
type Player = MLBPlayer | ProspectPlayer;
type PositionDisplayPlayer = {
  kind: "mlb" | "prospect";
  position: string;
  role?: "position" | "starter" | "reliever" | "two-way";
};
type Team = { abbr: string; name: string };
type ModelSettings = {
  dollarsPerWar: number;
  regularRosterWar: number;
  relieverRosterWar: number;
  timingPreference: number;
  starPremium: number;
  starThreshold: number;
  deadlineBoost: number;
  postseasonStarterBaselineWar: number;
  postseasonEquivalentSeason: number;
  relieverPremium: number;
  inflation: number;
  minimumSalary: number;
  valuationView: "offseason" | "deadline";
};
type ValueResult = {
  total: number;
  low: number;
  high: number;
  valuationView?: "offseason" | "deadline";
  controlThrough?: number | null;
  clubControlThrough?: number | null;
  playerOptionThrough?: number | null;
  clubControlWar?: number | null;
  clubControlSalary?: number | null;
  totalWar?: number | null;
  totalSalary?: number | null;
  extrapolatedValue?: number;
  extrapolatedShare?: number | null;
  excludedRosValue?: number;
  pendingFreeAgent?: boolean;
  fgTradeValueRank?: number | null;
  valuationBasis?:
    | "projection"
    | "projection blended with prospect grade"
    | "prospect grade";
  prospectWeight?: number;
  expectedWar?: number;
  starOdds?: number;
  projectionTotal?: number;
  prospectTotal?: number;
  rookieAdjustment?: number;
  deadlineAdjustment?: number;
  deadlineCurrentWinAdjustment?: number;
  octoberAdjustment?: number;
  horizonRisk?: number;
  rangeUncertainty?: number;
  prospectRankAdjustment?: number;
  rows: Array<{
    year: number;
    war: number;
    market: number;
    salary: number;
    surplus: number;
    deadlineAdjustment?: number;
    deadlineCurrentWinAdjustment?: number;
    octoberAdjustment?: number;
    excluded?: boolean;
    excludedSurplus?: number;
    extrapolated?: boolean;
    optionBlock?: boolean;
    optedOut?: boolean;
  }>;
};
type Database = {
  meta: {
    refreshed: string;
    baseYear: number;
    mlbCount: number;
    prospectCount: number;
    projectionPriority: string[];
    seasonRemainingFraction?: number;
  };
  teams: Team[];
  players: Player[];
};
type ShareStatus = "idle" | "loaded" | "copied" | "error";
type ActiveTab = "trade" | "discover" | "projections" | "rankings";
type ProjectionRoleFilter =
  | "all"
  | "position"
  | "starter"
  | "reliever"
  | "two-way";
type ProjectionSort = "total" | "2026" | "2027" | "2028" | "change" | "name";
type PlayoffOddsData = {
  refreshed: string;
  source: string;
  sourceUrl: string;
  mode: string;
  odds: Record<string, number>;
};
type SharedTradeState = {
  v: 1;
  snapshot?: string;
  modelVersion: string;
  leftTeam: string;
  rightTeam: string;
  leftIds: string[];
  rightIds: string[];
  leftCash: number;
  rightCash: number;
  selectedId?: string;
  settings: ModelSettings;
  overrides: Player[];
};

const database = databaseJson as unknown as Database;
const playoffOddsData = playoffOddsJson as PlayoffOddsData;
const BASE_YEAR = database.meta.baseYear;
const PROJECTION_YEARS = [BASE_YEAR, BASE_YEAR + 1, BASE_YEAR + 2];
const initialPlayers = Object.fromEntries(
  database.players.map((player) => [player.id, player]),
);
const initialSettings = modelInitialSettings as ModelSettings;
const TAB_PATHS: Record<ActiveTab, string> = {
  trade: "/tools/trade",
  discover: "/tools/finder",
  projections: "/tools/projections",
  rankings: "/tools/rankings",
};
const TAB_TITLES: Record<ActiveTab, string> = {
  trade: "Trade builder",
  discover: "Trade finder",
  projections: "Player projections",
  rankings: "Value rankings",
};
const prospectValues = modelProspectValues as Record<
  string,
  Record<ProspectType, { value: number; war: number; star: number }>
>;
const INITIAL_DISCOVERY_POSITION = (rankTeamNeeds(
  database.players,
  database.teams,
  "SEA",
  BASE_YEAR,
  { valuationView: initialSettings.valuationView },
)[0]?.id ?? "SP") as DiscoveryPosition;

const money = (value: number) =>
  `${value < 0 ? "−" : ""}$${Math.abs(value).toFixed(1)}M`;
// An en dash next to a minus sign reads as "−$191.9M–−$125.9M", so ranges that
// cross below zero use "to".
const rangeText = (low: number, high: number) =>
  low < 0 || high < 0
    ? `${money(low)} to ${money(high)}`
    : `${money(low)}–${money(high)}`;
const signedPercent = (value: number) =>
  `${value >= 0 ? "+" : "−"}${Math.abs(value).toFixed(1)}%`;
const signedWar = (value: number, digits = 1) =>
  `${value >= 0 ? "+" : "−"}${Math.abs(value).toFixed(digits)}`;
const shortNumber = (value: number) =>
  Number(value.toFixed(1)).toLocaleString("en-US");
const deepCopy = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const isAdjusted = (player?: Player) =>
  Boolean(
    player &&
      !player.custom &&
      initialPlayers[player.id] &&
      JSON.stringify(player) !== JSON.stringify(initialPlayers[player.id]),
  );
const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);
const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);
const isMlbSeason = (value: unknown): value is MLBSeason =>
  isRecord(value) &&
  isFiniteNumber(value.year) &&
  isFiniteNumber(value.war) &&
  isFiniteNumber(value.salary) &&
  typeof value.salaryMode === "string";
const isSharedPlayer = (value: unknown): value is Player => {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.name !== "string" ||
    typeof value.team !== "string" ||
    typeof value.position !== "string" ||
    !isFiniteNumber(value.age) ||
    !isRecord(value.source)
  )
    return false;
  if (value.kind === "mlb") {
    return (
      isFiniteNumber(value.risk) &&
      (value.tradeProtection === undefined ||
        ["none", "partial", "full"].includes(
          String(value.tradeProtection),
        )) &&
      Array.isArray(value.seasons) &&
      value.seasons.every(isMlbSeason)
    );
  }
  return (
    value.kind === "prospect" &&
    (value.prospectType === "Hitter" || value.prospectType === "Pitcher") &&
    typeof value.fv === "string" &&
    Boolean(prospectValues[value.fv]) &&
    isFiniteNumber(value.eta) &&
    isFiniteNumber(value.adjustment)
  );
};
const sharedSettings = (value: unknown): ModelSettings =>
  restoreSharedSettings(value, initialSettings) as ModelSettings;
const prettyDate = (date: string) =>
  new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
const displayPosition = (player: PositionDisplayPlayer) =>
  player.kind === "mlb" && player.position === "P"
    ? player.role === "reliever"
      ? "RP"
      : player.role === "starter"
        ? "SP"
        : "P"
    : player.position;
const projectionRoleFor = (player: MLBPlayer): Exclude<ProjectionRoleFilter, "all"> =>
  player.role ?? (player.position === "P" ? "starter" : "position");
const rosterContextLabel = (player: ProspectPlayer) =>
  ({
    none: "",
    rule5: "Rule 5 decision",
    on40: "40-man roster",
    crunch: "roster crunch",
  })[player.rosterContext ?? "none"] ?? "";
const tradeProtectionLabel = (player: MLBPlayer) =>
  ({
    none: "No listed protection",
    partial: "Trade list applies",
    full: "Player approval required",
  })[player.tradeProtection ?? "none"] ?? "No listed protection";
const availabilityLabel = (player: MLBPlayer) =>
  player.availability
    ? `${player.availability.status} · ${player.availability.injury}`
    : "Active roster";
const contractLabel = (player: MLBPlayer, result?: ValueResult) => {
  const seasons = effectiveSeasons(player) as MLBSeason[];
  const firstPlayerDecision = seasons.find((season) =>
    ["playerOption", "mutualOption"].includes(
      season.contractType ?? season.salaryMode,
    ),
  );
  const controlledSeasons = firstPlayerDecision
    ? seasons.filter((season) => season.year < firstPlayerDecision.year)
    : seasons;
  const finalControlledYear = controlledSeasons.at(-1)?.year;
  if (!finalControlledYear) return "No club control listed";
  if (!firstPlayerDecision) return `Club control through ${finalControlledYear}`;
  const optionKind =
    (firstPlayerDecision.contractType ?? firstPlayerDecision.salaryMode) ===
    "mutualOption"
      ? "mutual option"
      : "player option";
  return result?.playerOptionThrough
    ? `Club control through ${finalControlledYear} · ${optionKind} through ${result.playerOptionThrough}`
    : `Club control through ${finalControlledYear} · then player decision`;
};

/* Implementer C: valuation view, discount presets, sensitivity, audit, export */
const MODEL_VERSION = `dugout-value model ${TRADE_SHARE_MODEL_VERSION}`;
const PROJECTION_PAGE = 50;
const PENDING_FREE_AGENT_LABEL = `Pending free agent: no club control after ${BASE_YEAR}`;
const ARB_ESTIMATE_NOTE = "Estimated by the model; error not yet published";
const NOT_MODELED_NOTE =
  "Not modeled: option years, service time / 10-and-5 rights, 40-man spot, qualifying offer.";
const DEADLINE_SCENARIO_REASON = `Not available in the offseason view: the scenario adjusts rest-of-${BASE_YEAR} value, which that view excludes.`;
const DISCOUNT_PRESETS = [
  { value: 0, label: "No discount", note: "Future wins count equally" },
  { value: 10, label: "Market default, 10%/yr", note: "FanGraphs’ rate" },
  { value: 20, label: "Win-now, 20%/yr", note: "20% less per future year" },
];
const discountLabel = (rate: number) =>
  rate === 0
    ? { short: "no discount", long: "No discount" }
    : rate === 10
      ? { short: "10% a year", long: "Market default · 10% / year" }
      : rate === 20
        ? { short: "win-now 20% a year", long: "Win-now · 20% / year" }
        : { short: `custom ${rate}% a year`, long: `Custom · ${rate}% / year` };
const viewLabel = (view: ModelSettings["valuationView"]) =>
  view === "offseason" ? `Offseason view (${BASE_YEAR + 1} on)` : "July 31 deadline view";
/* The finder picks teams from July 31 playoff odds and needs from rest-of-2026
   rankings, so it always runs in the July 31 deadline view. */
const DISCOVERY_VIEW = "deadline" as const;
const valuationBasisLabel = (result?: ValueResult) =>
  !result?.valuationBasis || result.valuationBasis === "projection"
    ? ""
    : result.valuationBasis === "prospect grade"
      ? "Prospect grade"
      : "Projection blended with prospect grade";
const CITY_PREFIX =
  /^(Arizona|Atlanta|Baltimore|Boston|Chicago|Cincinnati|Cleveland|Colorado|Detroit|Houston|Kansas City|Los Angeles|Miami|Milwaukee|Minnesota|New York|Philadelphia|Pittsburgh|San Diego|San Francisco|Seattle|St\. Louis|Tampa Bay|Texas|Toronto|Washington)\s+/;
const teamNickname = (name: string) => name.replace(CITY_PREFIX, "");
const salaryBasisLabel = (season?: MLBSeason) => {
  if (!season) return "";
  if (season.salaryMode.startsWith("arb")) return "arb est.";
  const mode = season.contractType ?? season.salaryMode;
  if (mode.endsWith("Option")) return "option";
  if (mode === "prearb") return "pre-arb (league minimum)";
  return "guaranteed";
};
const fwarSourceLabel = (
  player: MLBPlayer,
  season: MLBSeason,
  extrapolated?: boolean,
) => {
  if (player.custom) return "Manual entry";
  if (season.ros) return "FanGraphs Depth Charts rest of season";
  if (extrapolated) return "Dugout Value aging model";
  if (player.futureProjectionUpdate?.projections?.[String(season.year)] !== undefined)
    return "ZiPS, FanGraphs Trade Value Series";
  if (season.projectionBaselineWar !== undefined)
    return season.inSeasonAdjustment
      ? "ZiPS plus in-season bridge"
      : "ZiPS";
  return player.source.projection;
};
const SETTING_LABELS: Record<
  keyof ModelSettings,
  [string, (value: number | string) => string]
> = {
  dollarsPerWar: ["Dollars per win", (v) => `$${v}M`],
  regularRosterWar: ["Roster-spot allowance, hitters / SP", (v) => `${v} WAR`],
  relieverRosterWar: ["Roster-spot allowance, relievers", (v) => `${v} WAR`],
  timingPreference: ["Discount rate", (v) => `${v}% a year`],
  starPremium: ["Star premium", (v) => `${v}%`],
  starThreshold: ["Star premium starts after", (v) => `${v} net WAR`],
  deadlineBoost: ["July deadline scenario", (v) => `${v}%`],
  postseasonStarterBaselineWar: ["October SP benchmark", (v) => `${v} WAR / 180`],
  postseasonEquivalentSeason: ["October workload equivalent", (v) => `${v}% season`],
  relieverPremium: ["Reliever premium", (v) => `${v}%`],
  inflation: ["WAR-price inflation", (v) => `${v}%`],
  minimumSalary: ["Minimum salary", (v) => `$${v}M`],
  valuationView: [
    "Valuation view",
    (v) => viewLabel(v as ModelSettings["valuationView"]),
  ],
};
const changedSettings = (settings: ModelSettings) =>
  (Object.keys(SETTING_LABELS) as Array<keyof ModelSettings>)
    .filter((key) => settings[key] !== initialSettings[key])
    .map((key) => {
      const [label, format] = SETTING_LABELS[key];
      return `${label}: ${format(settings[key])} (default ${format(initialSettings[key])})`;
    });
const PLAYER_FIELD_LABELS: Record<string, string> = {
  risk: "uncertainty",
  tradeProtection: "trade protection",
  rookieMode: "value basis",
  fv: "FV",
  prospectType: "player type",
  eta: "ETA",
  adjustment: "scout adjustment",
  riskLabel: "scouting risk",
  rosterContext: "roster situation",
  age: "age",
  war: "fWAR",
  salary: "salary",
  salaryMode: "pay type",
  contractType: "contract type",
  year: "year",
};
const describeChange = (field: string, value: unknown) =>
  value === undefined || value === null || value === ""
    ? "unset"
    : field === "salary"
      ? money(Number(value))
      : field === "war"
        ? Number(value).toFixed(1)
        : String(value);
const describePlayerChanges = (player: Player, base?: Player): string[] => {
  if (!base || player.custom) return ["Custom player added to the trade"];
  const changes: string[] = [];
  const record = (a: unknown, b: unknown, field: string, prefix = "") => {
    if (a === b) return;
    changes.push(
      `${prefix}${PLAYER_FIELD_LABELS[field] ?? field}: ${describeChange(field, a)} → ${describeChange(field, b)}`,
    );
  };
  for (const field of [
    "risk",
    "tradeProtection",
    "rookieMode",
    "fv",
    "prospectType",
    "eta",
    "adjustment",
    "riskLabel",
    "rosterContext",
    "age",
  ]) {
    record(
      (base as unknown as Record<string, unknown>)[field],
      (player as unknown as Record<string, unknown>)[field],
      field,
    );
  }
  const compareSeasons = (
    before: MLBSeason[] = [],
    after: MLBSeason[] = [],
    prefix = "",
  ) => {
    for (let index = 0; index < Math.max(before.length, after.length); index += 1) {
      const a = before[index];
      const b = after[index];
      if (!a && b) changes.push(`${prefix}Added ${b.year} season`);
      else if (a && !b) changes.push(`${prefix}Removed ${a.year} season`);
      else if (a && b) {
        for (const field of ["year", "war", "salary", "salaryMode", "contractType"]) {
          record(
            (a as unknown as Record<string, unknown>)[field],
            (b as unknown as Record<string, unknown>)[field],
            field,
            `${a.year} `,
          );
        }
      }
    }
  };
  if (player.kind === "mlb" && base.kind === "mlb") {
    compareSeasons(base.seasons, player.seasons);
    if (player.contractScenario && base.contractScenario) {
      record(
        base.contractScenario.selectedId,
        player.contractScenario.selectedId,
        "contract path",
      );
      for (const option of player.contractScenario.options) {
        const before = base.contractScenario.options.find(
          (item) => item.id === option.id,
        );
        compareSeasons(before?.seasons, option.seasons, `${option.label}, `);
      }
    }
  }
  return changes.length ? changes : ["Other inputs changed"];
};
const playerDriverSentence = (player: Player, result: ValueResult) => {
  if (player.kind === "prospect")
    return `${player.fv} FV ${player.prospectType.toLowerCase()} · ETA ${player.eta} · ${(result.expectedWar ?? 0).toFixed(1)} expected fWAR → ${money(result.total)} surplus value.`;
  if (result.pendingFreeAgent)
    return `No control years after ${BASE_YEAR} → ${money(result.total)} surplus value.`;
  const clubThrough = result.clubControlThrough ?? result.controlThrough;
  const clubRows = result.rows.filter(
    (row) =>
      !row.excluded &&
      !row.optedOut &&
      (clubThrough == null || row.year <= clubThrough),
  );
  const years = clubRows.length;
  const clubSurplus = clubRows.reduce((sum, row) => sum + row.surplus, 0);
  const optionSurplus = result.total - clubSurplus;
  const firstDecision = (effectiveSeasons(player) as MLBSeason[]).find(
    (season) =>
      ["playerOption", "mutualOption"].includes(
        season.contractType ?? season.salaryMode,
      ),
  );
  const optionWord =
    (firstDecision?.contractType ?? firstDecision?.salaryMode) ===
    "mutualOption"
      ? "Mutual-option"
      : "Player-option";
  const span = `${(clubThrough ?? BASE_YEAR) + 1}–${result.playerOptionThrough}`;
  const optionTail = !result.playerOptionThrough
    ? ""
    : Math.abs(optionSurplus) < 0.05
      ? ` ${optionWord} years ${span} add no surplus.`
      : ` ${optionWord} years ${span} ${optionSurplus < 0 ? "subtract" : "add"} ${money(Math.abs(optionSurplus))}. Total: ${money(result.total)}.`;
  const headline = result.playerOptionThrough ? clubSurplus : result.total;
  return `${years} club-control ${years === 1 ? "year" : "years"} through ${clubThrough ?? "—"} · ${(result.clubControlWar ?? result.totalWar ?? 0).toFixed(1)} projected fWAR · ${money(result.clubControlSalary ?? result.totalSalary ?? 0)} salary → ${money(headline)} surplus value.${optionTail}`;
};
const csvCell = (value: string | number | null | undefined) => {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "number")
    return Number.isFinite(value) ? String(Number(value.toFixed(3))) : "";
  let text = value.replace(/[\r\n]+/g, " ");
  if (/^[=+\-@\t]/.test(text)) text = `'${text}`;
  return /[",]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};
const csvComment = (text: string) => `# ${text.replace(/[\r\n]+/g, " ")}`;
const buildTradeCsv = ({
  players,
  values,
  settings,
  leftTeam,
  rightTeam,
  leftIds,
  rightIds,
  leftCash,
  rightCash,
  changes,
}: {
  players: Record<string, Player>;
  values: Record<string, ValueResult>;
  settings: ModelSettings;
  leftTeam: string;
  rightTeam: string;
  leftIds: string[];
  rightIds: string[];
  leftCash: number;
  rightCash: number;
  changes: string[];
}) => {
  const lines: string[] = [
    csvComment("Dugout Value trade export"),
    csvComment(`Model version: ${MODEL_VERSION}`),
    csvComment(`Snapshot date: ${database.meta.refreshed} (player data as of this date)`),
    csvComment(
      `Valuation view: ${settings.valuationView} (${viewLabel(settings.valuationView)})`,
    ),
    csvComment(
      `Settings: ${(Object.keys(SETTING_LABELS) as Array<keyof ModelSettings>)
        .map((key) => `${key}=${settings[key]}`)
        .join("; ")}`,
    ),
    csvComment(
      `Changed from defaults: ${changes.length ? changes.join(" | ") : "none"}`,
    ),
    csvComment(
      `Trade: ${leftTeam} sends ${leftIds.map((id) => players[id]?.name).join(", ") || "no players"}${leftCash > 0 ? ` plus $${leftCash}M cash` : ""}; ${rightTeam} sends ${rightIds.map((id) => players[id]?.name).join(", ") || "no players"}${rightCash > 0 ? ` plus $${rightCash}M cash` : ""}`,
    ),
    csvComment(
      "Dollar columns are $M. Surplus value is discounted at the stated rate and sums to each player's total in the model.",
    ),
    [
      "player",
      "team",
      "season",
      "fWAR",
      "fWAR source",
      "market value ($M)",
      "salary ($M)",
      "salary basis",
      "included or excluded",
      "surplus value ($M)",
      "note",
    ].join(","),
  ];
  const row = (cells: Array<string | number | null | undefined>) =>
    lines.push(cells.map(csvCell).join(","));
  const seen = new Set<string>();
  for (const id of [...leftIds, ...rightIds]) {
    if (seen.has(id)) continue;
    seen.add(id);
    const player = players[id];
    const result = values[id];
    if (!player || !result) continue;
    if (player.kind === "prospect") {
      row([
        player.name,
        player.team,
        player.eta,
        result.expectedWar ?? null,
        `FanGraphs FV table (${player.fv} FV)`,
        null,
        null,
        "prospect grade",
        "included",
        result.total,
        "Expected value by ETA; no season-by-season rows",
      ]);
      continue;
    }
    const seasons = effectiveSeasons(player) as MLBSeason[];
    seasons.forEach((season, index) => {
      const valueRow = result.rows[index];
      if (!valueRow) return;
      const excluded = Boolean(valueRow.excluded || valueRow.optedOut);
      const notes = [
        valueRow.excluded
          ? `Rest of ${season.year} excluded in the offseason view (would add ${money(valueRow.excludedSurplus ?? 0)})`
          : "",
        valueRow.optedOut ? "Player option settled as opted out" : "",
        !excluded &&
        !valueRow.optedOut &&
        salaryBasisLabel(season) === "option" &&
        Math.abs(valueRow.surplus) < 0.0005
          ? "Option settled at zero: the side holding it declines when the contract is worse for them"
          : "",
        valueRow.extrapolated ? "Extrapolated (aging model)" : "",
        season.ros ? `Rest of ${season.year} only` : "",
      ].filter(Boolean);
      row([
        player.name,
        player.team,
        season.year,
        season.war,
        fwarSourceLabel(player, season, valueRow.extrapolated),
        valueRow.market,
        valueRow.salary,
        salaryBasisLabel(season),
        excluded ? "excluded" : "included",
        valueRow.surplus,
        notes.join("; "),
      ]);
    });
    if (
      result.valuationBasis === "projection blended with prospect grade" &&
      Math.abs(result.rookieAdjustment ?? 0) > 0.0005
    ) {
      row([
        player.name,
        player.team,
        "prospect-grade blend",
        null,
        `FanGraphs FV table (${Math.round((result.prospectWeight ?? 0) * 100)}% weight)`,
        null,
        null,
        "prospect grade",
        "included",
        result.rookieAdjustment ?? 0,
        "Adjustment from blending the projection with the last prospect grade",
      ]);
    }
  }
  for (const [team, cash] of [
    [leftTeam, leftCash],
    [rightTeam, rightCash],
  ] as const) {
    if (cash > 0)
      row([
        "Cash / salary retained",
        team,
        null,
        null,
        null,
        null,
        null,
        "cash",
        "included",
        cash,
        "Added dollar for dollar",
      ]);
  }
  return `${lines.join("\r\n")}\r\n`;
};

function TradeSensitivity({
  players,
  settings,
  leftIds,
  rightIds,
  leftCash,
  rightCash,
  leftTeam,
  rightTeam,
}: {
  players: Record<string, Player>;
  settings: ModelSettings;
  leftIds: string[];
  rightIds: string[];
  leftCash: number;
  rightCash: number;
  leftTeam: string;
  rightTeam: string;
}) {
  const items = useMemo(() => {
    const otherView = settings.valuationView === "offseason" ? "deadline" : "offseason";
    // A preset that equals the current setting would repeat the headline, so
    // it falls back to the default value instead.
    const dollars = settings.dollarsPerWar === 10 ? initialSettings.dollarsPerWar : 10;
    const starPremium = settings.starPremium === 0 ? initialSettings.starPremium : 0;
    const timing = settings.timingPreference === 20 ? initialSettings.timingPreference : 20;
    const scenarios: Array<{ label: string; changes: Partial<ModelSettings> }> = [
      { label: `$${dollars}M per win`, changes: { dollarsPerWar: dollars } },
      {
        label: starPremium === 0 ? "No star premium" : `${starPremium}% star premium`,
        changes: { starPremium },
      },
      {
        label: timing === 20 ? "Win-now 20%" : "Market default 10%",
        changes: { timingPreference: timing },
      },
      {
        label: viewLabel(otherView),
        changes: { valuationView: otherView },
      },
    ];
    const gapFor = (alt: ModelSettings) => {
      const altValues: Record<string, ValueResult> = {};
      for (const id of new Set([...leftIds, ...rightIds])) {
        if (players[id])
          altValues[id] = valuePlayer(players[id], alt, database) as ValueResult;
      }
      const left = packageRange(leftIds, leftCash, altValues).total;
      const right = packageRange(rightIds, rightCash, altValues).total;
      return { gap: left - right, negative: left < -0.05 || right < -0.05 };
    };
    const baseGap = gapFor(settings).gap;
    return scenarios.map(({ label, changes }) => {
      const { gap, negative } = gapFor({ ...settings, ...changes });
      return {
        label,
        gap,
        negative,
        flips:
          Math.abs(gap) >= 0.05 &&
          Math.abs(baseGap) >= 0.05 &&
          Math.sign(gap) !== Math.sign(baseGap),
      };
    });
  }, [players, settings, leftIds, rightIds, leftCash, rightCash]);
  const nameFor = (abbr: string) =>
    teamNickname(
      database.teams.find((team) => team.abbr === abbr)?.name ?? abbr,
    );
  if (!leftIds.length && !rightIds.length) return null;
  return (
    <p className="trade-sensitivity" aria-label="How the result changes under other settings">
      <strong>Does the order hold?</strong>{" "}
      {items.map((item, index) => (
        <span key={item.label}>
          {index > 0 && <span aria-hidden="true"> · </span>}
          {item.label}:{" "}
          <b className={item.flips ? "flips" : ""}>
            {Math.abs(item.gap) < 0.05
              ? "even"
              : item.negative
                ? `the ${nameFor(item.gap > 0 ? leftTeam : rightTeam)} come out ${money(Math.abs(item.gap))} behind`
                : `the ${nameFor(item.gap > 0 ? leftTeam : rightTeam)} give up ${money(Math.abs(item.gap))} more`}
            {item.flips ? " (order flips)" : ""}
          </b>
        </span>
      ))}
    </p>
  );
}


function NumericField({
  value,
  onChange,
  step = 0.1,
  min,
  max,
  label,
  disabled,
}: {
  value: number;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
  max?: number;
  label: string;
  disabled?: boolean;
}) {
  return (
    <input
      aria-label={label}
      className="compact-input"
      type="number"
      value={value}
      step={step}
      min={min}
      max={max}
      disabled={disabled}
      onChange={(event) => onChange(Number(event.target.value))}
    />
  );
}

export default function TradeWorkspace({ initialTab = "trade" }: { initialTab?: ActiveTab }) {
  const [players, setPlayers] = useState<Record<string, Player>>(() =>
    deepCopy(initialPlayers),
  );
  const [leftTeam, setLeftTeam] = useState("SEA");
  const [rightTeam, setRightTeam] = useState("PIT");
  const [leftIds, setLeftIds] = useState<string[]>(["mlb-677594"]);
  const [rightIds, setRightIds] = useState<string[]>(["mlb-694973"]);
  const [leftCash, setLeftCash] = useState(0);
  const [rightCash, setRightCash] = useState(0);
  const [selectedId, setSelectedId] = useState("mlb-694973");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [settings, setSettings] = useState(initialSettings);
  const [showMethod, setShowMethod] = useState(false);
  const [leftSearch, setLeftSearch] = useState("");
  const [rightSearch, setRightSearch] = useState("");
  const [openPicker, setOpenPicker] = useState<"left" | "right" | null>(null);
  const [pickerIndex, setPickerIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<ActiveTab>(initialTab);
  const [rankingType, setRankingType] = useState<"all" | "mlb" | "prospect">(
    "all",
  );
  const [rankingTeam, setRankingTeam] = useState("ALL");
  const [rankingSearch, setRankingSearch] = useState("");
  const [projectionTeam, setProjectionTeam] = useState("ALL");
  const [projectionRole, setProjectionRole] =
    useState<ProjectionRoleFilter>("all");
  const [projectionSearch, setProjectionSearch] = useState("");
  const [projectionSort, setProjectionSort] =
    useState<ProjectionSort>("total");
  const [projectionVisible, setProjectionVisible] = useState(PROJECTION_PAGE);
  const [driversOrigin, setDriversOrigin] = useState<{
    id: string;
    from: "rankings" | "projections";
    previousId: string;
  } | null>(null);
  const [shareStatus, setShareStatus] = useState<ShareStatus>("idle");
  const [snapshotWarning, setSnapshotWarning] = useState<string | null>(null);
  const [finderNotice, setFinderNotice] = useState<string | null>(null);
  const [discoveryTeam, setDiscoveryTeam] = useState("SEA");
  const [discoveryPosition, setDiscoveryPosition] =
    useState<DiscoveryPosition>(INITIAL_DISCOVERY_POSITION);
  const [sellerThreshold, setSellerThreshold] = useState(35);
  const [selectedDiscoveryTargetId, setSelectedDiscoveryTargetId] =
    useState("");

  const goToTab = (tab: ActiveTab) => {
    setActiveTab(tab);
    const url = new URL(TAB_PATHS[tab], window.location.origin);
    window.history.pushState(null, "", url);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  useEffect(() => {
    const onPopState = () => {
      const route = Object.entries(TAB_PATHS).find(([, path]) => path === window.location.pathname);
      if (route) setActiveTab(route[0] as ActiveTab);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    document.title = `${TAB_TITLES[activeTab]} | Dugout Value`;
  }, [activeTab]);

  useEffect(() => {
    if (window.location.hash !== "#methodology") return;
    let scrollTimer = 0;
    const openTimer = window.setTimeout(() => {
      setShowMethod(true);
      scrollTimer = window.setTimeout(() => {
        const method = document.getElementById("methodology");
        method?.scrollIntoView({ block: "start" });
        method?.focus({ preventScroll: true });
      }, 50);
    }, 0);
    return () => {
      window.clearTimeout(openTimer);
      window.clearTimeout(scrollTimer);
    };
  }, []);

  useEffect(() => {
    const payload = new URLSearchParams(window.location.search).get("trade");
    const shared = decodeTradeState(payload ?? "");
    const unreadableLink = () => {
      if (!payload) return undefined;
      const timer = window.setTimeout(
        () => setSnapshotWarning("This trade link couldn’t be read. Showing the example trade."),
        0,
      );
      return () => window.clearTimeout(timer);
    };
    if (!isRecord(shared)) return unreadableLink();
    const teams = new Set(database.teams.map((team) => team.abbr));
    if (
      typeof shared.leftTeam !== "string" ||
      typeof shared.rightTeam !== "string" ||
      shared.leftTeam === shared.rightTeam ||
      !teams.has(shared.leftTeam) ||
      !teams.has(shared.rightTeam) ||
      !Array.isArray(shared.leftIds) ||
      !Array.isArray(shared.rightIds)
    )
      return unreadableLink();
    const restoredLeftTeam = shared.leftTeam;
    const restoredRightTeam = shared.rightTeam;

    const overrides = Array.isArray(shared.overrides)
      ? shared.overrides.filter(isSharedPlayer)
      : [];
    const restoredPlayers = deepCopy(initialPlayers);
    for (const player of overrides) {
      const official = initialPlayers[player.id];
      if (
        (official && official.kind === player.kind) ||
        (!official && player.custom)
      ) {
        restoredPlayers[player.id] = deepCopy(player);
      }
    }
    const validIds = (ids: unknown[], team: string) =>
      Array.from(
        new Set(
          ids.filter(
            (id): id is string =>
              typeof id === "string" && restoredPlayers[id]?.team === team,
          ),
        ),
      );
    const restoredLeftIds = validIds(shared.leftIds, restoredLeftTeam);
    const restoredRightIds = validIds(shared.rightIds, restoredRightTeam);
    const packageIds = [...restoredLeftIds, ...restoredRightIds];
    const restoredSelectedId =
      typeof shared.selectedId === "string" &&
      packageIds.includes(shared.selectedId)
        ? shared.selectedId
        : (packageIds[0] ?? "");
    const restoredSettings = sharedSettings(shared.settings);
    const restoredLeftCash = normalizeCashAmount(shared.leftCash);
    const restoredRightCash = normalizeCashAmount(shared.rightCash);

    const restoreTimer = window.setTimeout(() => {
      setPlayers(restoredPlayers);
      setLeftTeam(restoredLeftTeam);
      setRightTeam(restoredRightTeam);
      setLeftIds(restoredLeftIds);
      setRightIds(restoredRightIds);
      setLeftCash(restoredLeftCash);
      setRightCash(restoredRightCash);
      setSelectedId(restoredSelectedId);
      setAdvancedOpen(Boolean(restoredSelectedId));
      setSettings(restoredSettings);
      setLeftSearch("");
      setRightSearch("");
      setOpenPicker(null);
      setPickerIndex(0);
      setShowMethod(false);
      setActiveTab("trade");
      setShareStatus("loaded");
      setSnapshotWarning(
        [
          sharedSnapshotWarning(shared.snapshot, database.meta.refreshed),
          sharedModelWarning(shared.modelVersion),
          isLegacySettingsLink(shared)
            ? "This link was saved before October 16, 2026 and uses the July 31 deadline view with no discount. New trades open in the offseason view with a 10% discount."
            : restoredSettings.valuationView === "deadline"
              ? "This link was saved in the July 31 deadline view, which counts rest-of-season 2026 value. New trades open in the offseason view."
              : null,
        ]
          .filter(Boolean)
          .join(" ") || null,
      );
    }, 0);
    return () => window.clearTimeout(restoreTimer);
  }, []);

  const teamName = (abbr: string) =>
    database.teams.find((team) => team.abbr === abbr)?.name ?? abbr;
  const values = useMemo(
    () =>
      Object.fromEntries(
        Object.values(players).map((player) => [
          player.id,
          valuePlayer(player, settings, database) as ValueResult,
        ]),
      ),
    [players, settings],
  );
  const playerList = useMemo(() => Object.values(players), [players]);
  // The finder always values in the July 31 deadline view. When the builder is
  // in the offseason view, price the finder's players separately (only while
  // the finder is open) so its trade values match its rest-of-season WAR.
  const discoveryValues = useMemo(() => {
    if (settings.valuationView === DISCOVERY_VIEW) return values;
    if (activeTab !== "discover") return {} as Record<string, ValueResult>;
    const deadlineSettings = { ...settings, valuationView: DISCOVERY_VIEW };
    return Object.fromEntries(
      Object.values(players).map((player) => [
        player.id,
        valuePlayer(player, deadlineSettings, database) as ValueResult,
      ]),
    );
  }, [activeTab, players, settings, values]);
  const discoveryNeeds = useMemo(
    () =>
      rankTeamNeeds(
        playerList,
        database.teams,
        discoveryTeam,
        BASE_YEAR,
        { valuationView: DISCOVERY_VIEW },
      ),
    [discoveryTeam, playerList],
  );
  const selectedDiscoveryNeed =
    discoveryNeeds.find((need) => need.id === discoveryPosition) ??
    discoveryNeeds[0];
  const discoveryTargets = useMemo(
    () =>
      findTradeTargets({
        players: playerList,
        values: discoveryValues,
        buyerTeam: discoveryTeam,
        position: discoveryPosition,
        playoffOdds: playoffOddsData.odds,
        sellerThreshold,
        baseYear: BASE_YEAR,
        valuationView: DISCOVERY_VIEW,
      }),
    [
      discoveryPosition,
      discoveryTeam,
      playerList,
      sellerThreshold,
      discoveryValues,
    ],
  );
  const activeDiscoveryTarget =
    discoveryTargets.find(
      (target) => target.id === selectedDiscoveryTargetId,
    ) ?? discoveryTargets[0];
  const discoveryOffers = useMemo(
    () =>
      activeDiscoveryTarget
        ? generateOfferPackages({
            players: playerList,
            values: discoveryValues,
            buyerTeam: discoveryTeam,
            holePosition: discoveryPosition,
            targetValue: activeDiscoveryTarget.tradeValue,
            baseYear: BASE_YEAR,
            valuationView: DISCOVERY_VIEW,
          })
        : [],
    [
      activeDiscoveryTarget,
      discoveryPosition,
      discoveryTeam,
      playerList,
      discoveryValues,
    ],
  );
  const leftPackage = packageRange(leftIds, leftCash, values);
  const rightPackage = packageRange(rightIds, rightCash, values);
  const { total: leftTotal, low: leftLow, high: leftHigh } = leftPackage;
  const { total: rightTotal, low: rightLow, high: rightHigh } = rightPackage;
  const difference = leftTotal - rightTotal;
  const hasPlayers = leftIds.length + rightIds.length > 0;
  const rangesOverlap = leftLow <= rightHigh && rightLow <= leftHigh;
  const leftFilled = leftIds.length > 0 || leftCash > 0;
  const rightFilled = rightIds.length > 0 || rightCash > 0;
  const verdictState: "empty" | "oneSide" | "even" | "overlap" | "clear" =
    !leftFilled && !rightFilled
      ? "empty"
      : !leftFilled || !rightFilled
        ? "oneSide"
        : Math.abs(difference) < 0.05
          ? "even"
          : rangesOverlap
            ? "overlap"
            : "clear";
  const givesUpMoreTeam = difference > 0 ? leftTeam : rightTeam;
  const emptySideTeam = leftFilled ? rightTeam : leftTeam;
  const filledSideTeam = leftFilled ? leftTeam : rightTeam;
  const filledSideTotal = leftFilled ? leftTotal : rightTotal;
  const largerSideTotal = Math.max(leftTotal, rightTotal);
  // A package below zero is a contract expected to cost more than it returns.
  // The team that sends the larger package comes out behind either way, but
  // "give up more" reads backwards when it is taking on a bad contract.
  const hasNegativePackage = leftTotal < -0.05 || rightTotal < -0.05;
  const gapWar = Math.abs(difference) / settings.dollarsPerWar;
  const gapShareText =
    leftTotal > 0 && rightTotal > 0
      ? `${((Math.abs(difference) / largerSideTotal) * 100).toFixed(1)}% of the larger side`
      : null;
  const gapDetailText = [
    gapShareText,
    `${gapWar < 0.05 ? "under 0.1" : `about ${gapWar.toFixed(1)}`} wins at $${settings.dollarsPerWar}M a win`,
  ]
    .filter(Boolean)
    .join(" · ");
  const verdictStamp =
    verdictState === "empty"
      ? "Add players"
      : verdictState === "oneSide"
        ? "One side only"
        : verdictState === "clear"
          ? "Ranges don’t overlap"
          : "Ranges overlap";
  const negativePackageNote =
    "A negative package is a contract expected to cost more than its projected production.";
  const verdictHeadline =
    verdictState === "empty"
      ? "Add a player to each side"
      : verdictState === "oneSide"
        ? `Add a player to the ${teamName(emptySideTeam)}’ side`
        : verdictState === "even"
          ? "Even at the midpoint"
          : hasNegativePackage
            ? `${teamName(givesUpMoreTeam)} come out ${money(Math.abs(difference))} behind at the midpoint`
            : `${teamName(givesUpMoreTeam)} give up ${money(Math.abs(difference))} more at the midpoint`;
  const verdictSentence =
    verdictState === "empty"
      ? "Search a roster below, or load the Rodríguez–Skenes example."
      : verdictState === "oneSide"
        ? filledSideTotal < -0.05
          ? `${teamName(filledSideTeam)} send a package worth ${money(filledSideTotal)} so far. ${negativePackageNote} Add what comes back to see the gap.`
          : `${teamName(filledSideTeam)} give up ${money(filledSideTotal)} so far. Add what comes back to see the gap.`
        : verdictState === "even"
          ? `The two sides match at the midpoint. ${hasNegativePackage ? negativePackageNote + " " : ""}Check the year-by-year table: equal totals can hide very different timelines.`
          : `${hasNegativePackage ? negativePackageNote + " " : ""}${
              verdictState === "overlap"
                ? "The ranges overlap, so the gap is small next to the model’s allowances. Change the assumption you trust least and see whether the order holds."
                : "The ranges don’t overlap. Under these assumptions that’s a real gap in surplus value. It isn’t a prediction of what either club would accept."
            }`;
  const consolidation = packageConsolidation(
    leftIds,
    leftCash,
    rightIds,
    rightCash,
    values,
  );
  const selected = players[selectedId];
  const selectedAdjusted = isAdjusted(selected);
  const selectedValue = selected ? values[selected.id] : undefined;
  const showDriversBanner =
    Boolean(driversOrigin && selected) &&
    driversOrigin?.id === selectedId &&
    !leftIds.includes(selectedId) &&
    !rightIds.includes(selectedId);
  const baselineChanges = useMemo(
    () => [
      ...changedSettings(settings),
      ...Object.values(players)
        .filter((player) => player.custom || isAdjusted(player))
        .flatMap((player) => {
          const lines = describePlayerChanges(player, initialPlayers[player.id]);
          const shown = lines.slice(0, 8);
          const extra = lines.length - shown.length;
          const inTrade = [...leftIds, ...rightIds].includes(player.id);
          return [
            `${player.name}${inTrade ? "" : " (not in the trade, so not saved in the link)"}: ${shown.join("; ")}${extra > 0 ? `; +${extra} more` : ""}`,
          ];
        }),
    ],
    [players, settings, leftIds, rightIds],
  );
  const downloadCsv = () => {
    const csv = buildTradeCsv({
      players,
      values,
      settings,
      leftTeam,
      rightTeam,
      leftIds,
      rightIds,
      leftCash,
      rightCash,
      changes: baselineChanges,
    });
    const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `dugout-value-${leftTeam.toLowerCase()}-${rightTeam.toLowerCase()}-${settings.valuationView}-${database.meta.refreshed}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const protectedPackagePlayers = Array.from(
    new Set([...leftIds, ...rightIds]),
  )
    .map((id) => players[id])
    .filter(
      (player): player is MLBPlayer =>
        player?.kind === "mlb" &&
        ["partial", "full"].includes(player.tradeProtection ?? "none"),
    );
  const fullProtectionNames = protectedPackagePlayers
    .filter((player) => player.tradeProtection === "full")
    .map((player) => player.name);
  const partialProtectionNames = protectedPackagePlayers
    .filter((player) => player.tradeProtection === "partial")
    .map((player) => player.name);
  const tradeProtectionSummary = [
    fullProtectionNames.length === 1
      ? `${fullProtectionNames[0]} can block this trade`
      : fullProtectionNames.length > 1
        ? `${fullProtectionNames.length} players can block this trade`
        : "",
    partialProtectionNames.length === 1
      ? `${partialProtectionNames[0]} has a limited no-trade list`
      : partialProtectionNames.length > 1
        ? `${partialProtectionNames.length} players have limited no-trade lists`
        : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const unavailablePackagePlayers = Array.from(
    new Set([...leftIds, ...rightIds]),
  )
    .map((id) => players[id])
    .filter(
      (player): player is MLBPlayer =>
        player?.kind === "mlb" && Boolean(player.availability),
    );
  const availabilitySummary =
    unavailablePackagePlayers.length === 1
      ? `${unavailablePackagePlayers[0].name} was listed on the ${unavailablePackagePlayers[0].availability?.status} on July 31`
      : unavailablePackagePlayers.length > 1
        ? `${unavailablePackagePlayers.length} players in this trade were listed on the IL on July 31`
        : "";
  const selectedSeasons =
    selected?.kind === "mlb"
      ? (effectiveSeasons(selected) as MLBSeason[])
      : [];
  const rankedPlayers = useMemo(() => {
    const query = rankingSearch.trim().toLowerCase();
    return Object.values(players)
      .filter((player) => !player.custom)
      .filter((player) => !values[player.id]?.pendingFreeAgent)
      .filter((player) => rankingType === "all" || player.kind === rankingType)
      .filter((player) => rankingTeam === "ALL" || player.team === rankingTeam)
      .filter((player) =>
        query
          ? `${player.name} ${player.team} ${displayPosition(player)} ${
              player.kind === "prospect" ? player.fv : "mlb"
            } ${
              player.kind === "mlb"
                ? `${player.availability?.status ?? "active"} ${player.availability?.injury ?? ""}`
                : ""
            }`
              .toLowerCase()
              .includes(query)
          : true,
      )
      .sort((a, b) => (values[b.id]?.total ?? 0) - (values[a.id]?.total ?? 0))
      .slice(0, 100);
  }, [players, rankingSearch, rankingTeam, rankingType, values]);
  const projectedPlayers = useMemo(() => {
    const query = projectionSearch.trim().toLowerCase();
    return Object.values(players)
      .filter(
        (player): player is MLBPlayer =>
          player.kind === "mlb" &&
          !player.custom &&
          player.threeYearProjection?.length === PROJECTION_YEARS.length,
      )
      .filter(
        (player) =>
          projectionTeam === "ALL" || player.team === projectionTeam,
      )
      .filter(
        (player) =>
          projectionRole === "all" ||
          projectionRoleFor(player) === projectionRole,
      )
      .filter((player) =>
        query
          ? `${player.name} ${player.team} ${displayPosition(player)}`
              .toLowerCase()
              .includes(query)
          : true,
      )
      .map((player) => {
        const seasons = Object.fromEntries(
          (player.threeYearProjection ?? []).map((season) => [
            season.year,
            season,
          ]),
        ) as Record<number, ThreeYearProjectionSeason>;
        const total = PROJECTION_YEARS.reduce(
          (sum, year) => sum + Number(seasons[year]?.war ?? 0),
          0,
        );
        const change = PROJECTION_YEARS.slice(1).reduce(
          (sum, year) =>
            sum + Number(seasons[year]?.inSeasonAdjustment ?? 0),
          0,
        );
        return { player, seasons, total, change };
      })
      .sort((left, right) => {
        if (projectionSort === "name")
          return left.player.name.localeCompare(right.player.name);
        if (projectionSort === "change") return right.change - left.change;
        if (projectionSort === "total") return right.total - left.total;
        const year = Number(projectionSort);
        return (
          Number(right.seasons[year]?.war ?? 0) -
          Number(left.seasons[year]?.war ?? 0)
        );
      });
  }, [
    players,
    projectionRole,
    projectionSearch,
    projectionSort,
    projectionTeam,
  ]);
  const allYears = Array.from(
    new Set(
      [...leftIds, ...rightIds].flatMap(
        (id) =>
          values[id]?.rows.map((row) => row.year) ??
          (players[id]?.kind === "prospect" ? [players[id].eta] : []),
      ),
    ),
  ).sort();
  const sideYearValue = (ids: string[], year: number) =>
    ids.reduce((sum, id) => {
      const player = players[id],
        result = values[id];
      if (!player || !result) return sum;
      if (player.kind === "prospect")
        return sum + (player.eta === year ? result.total : 0);
      const annual = result.rows.find((row) => row.year === year)?.surplus ?? 0;
      return (
        sum + annual + (year === BASE_YEAR ? (result.rookieAdjustment ?? 0) : 0)
      );
    }, 0);
  // The rest-of-2026 row is "not counted" in the offseason view; label it
  // instead of drawing $0.0M, and drop trailing years where both sides are 0.
  const yearIsExcluded = (year: number) => {
    const rows = [...leftIds, ...rightIds].flatMap((id) =>
      (values[id]?.rows ?? []).filter((row) => row.year === year),
    );
    return rows.length > 0 && rows.every((row) => row.excluded);
  };
  const isZeroYear = (year: number) =>
    !yearIsExcluded(year) &&
    Math.abs(sideYearValue(leftIds, year)) < 0.05 &&
    Math.abs(sideYearValue(rightIds, year)) < 0.05;
  let lastLedgerIndex = allYears.length - 1;
  while (lastLedgerIndex > 0 && isZeroYear(allYears[lastLedgerIndex]))
    lastLedgerIndex -= 1;
  const ledgerYears = allYears.slice(0, lastLedgerIndex + 1);
  const barWidth = (value: number) =>
    Math.abs(value) < 0.05 ? 0 : Math.max(2, (Math.abs(value) / maxYearValue) * 96);
  const maxYearValue = Math.max(
    1,
    leftCash,
    rightCash,
    ...allYears.flatMap((year) => [
      Math.abs(sideYearValue(leftIds, year)),
      Math.abs(sideYearValue(rightIds, year)),
    ]),
  );
  const updatePlayer = (id: string, updater: (player: Player) => Player) =>
    setPlayers((current) => ({
      ...current,
      [id]: updater(deepCopy(current[id])),
    }));
  const updateMlbSeasonAt = (
    id: string,
    index: number,
    updater: (season: MLBSeason) => MLBSeason,
  ) =>
    updatePlayer(id, (player) => {
      if (player.kind !== "mlb") return player;
      if (index < player.seasons.length) {
        return {
          ...player,
          seasons: player.seasons.map((season, seasonIndex) =>
            seasonIndex === index ? updater(season) : season,
          ),
        };
      }
      const scenario = player.contractScenario;
      if (!scenario) return player;
      const branchIndex = index - player.seasons.length;
      return {
        ...player,
        contractScenario: {
          ...scenario,
          options: scenario.options.map((option) =>
            option.id === scenario.selectedId
              ? {
                  ...option,
                  seasons: option.seasons.map((season, seasonIndex) =>
                    seasonIndex === branchIndex ? updater(season) : season,
                  ),
                }
              : option,
          ),
        },
      };
    });
  const addMlbSeason = (id: string) =>
    updatePlayer(id, (player) => {
      if (player.kind !== "mlb") return player;
      const seasons = effectiveSeasons(player) as MLBSeason[];
      const nextSeason: MLBSeason = {
        year:
          Math.max(BASE_YEAR, ...seasons.map((season) => season.year)) + 1,
        war: 2,
        salary: 1,
        salaryMode: "fixed",
      };
      if (!player.contractScenario) {
        return { ...player, seasons: [...player.seasons, nextSeason] };
      }
      return {
        ...player,
        contractScenario: {
          ...player.contractScenario,
          options: player.contractScenario.options.map((option) =>
            option.id === player.contractScenario?.selectedId
              ? { ...option, seasons: [...option.seasons, nextSeason] }
              : option,
          ),
        },
      };
    });
  const libraryFor = (team: string, used: string[]) =>
    Object.values(players)
      .filter((player) => player.team === team && !used.includes(player.id))
      .sort(
        (a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name),
      );

  const addPlayer = (side: "left" | "right", id: string) => {
    if (!id) return;
    (side === "left" ? setLeftIds : setRightIds)((ids) =>
      ids.includes(id) ? ids : [...ids, id],
    );
    setSelectedId(id);
    setAdvancedOpen(true);
  };
  const openPlayerEditor = (
    id: string,
    from?: "rankings" | "projections",
  ) => {
    if (from) {
      setDriversOrigin((current) => ({
        id,
        from,
        previousId:
          current && current.id === selectedId
            ? current.previousId
            : selectedId,
      }));
    } else {
      setDriversOrigin(null);
    }
    setSelectedId(id);
    setAdvancedOpen(true);
    if (from) goToTab("trade");
    window.setTimeout(() => {
      if (window.innerWidth <= 1250) {
        document
          .getElementById(from ? "drivers-banner" : "player-editor")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 0);
  };
  const backFromDrivers = () => {
    if (!driversOrigin) return;
    const { from, previousId } = driversOrigin;
    setDriversOrigin(null);
    if (players[previousId]) setSelectedId(previousId);
    goToTab(from);
  };
  const removePlayer = (side: "left" | "right", id: string) => {
    (side === "left" ? setLeftIds : setRightIds)((ids) =>
      ids.filter((item) => item !== id),
    );
    if (selectedId === id) {
      const remaining = [...leftIds, ...rightIds].filter((item) => item !== id);
      setSelectedId(remaining[0] ?? "");
    }
  };
  const changeTeam = (side: "left" | "right", team: string) => {
    if (
      (side === "left" && team === rightTeam) ||
      (side === "right" && team === leftTeam)
    )
      return;
    const clearedIds = side === "left" ? leftIds : rightIds;
    const retainedIds = side === "left" ? rightIds : leftIds;
    if (side === "left") {
      setLeftTeam(team);
      setLeftIds([]);
      setLeftCash(0);
      setLeftSearch("");
    } else {
      setRightTeam(team);
      setRightIds([]);
      setRightCash(0);
      setRightSearch("");
    }
    setOpenPicker(null);
    setPickerIndex(0);
    if (clearedIds.includes(selectedId)) {
      setSelectedId(retainedIds[0] ?? "");
    }
  };
  const addCustom = (side: "left" | "right", kind: "mlb" | "prospect") => {
    const id = `custom-${Date.now()}`;
    const team = side === "left" ? leftTeam : rightTeam;
    const source = {
      projection: "Manual entry",
      contract: "Manual entry",
      refreshed: database.meta.refreshed,
    };
    const player: Player =
      kind === "mlb"
        ? {
            id,
            kind,
            custom: true,
            name: "Custom MLB player",
            team,
            position: "UTIL",
            age: 27,
            source,
            risk: 8,
            tradeProtection: "none",
            seasons: [
              { year: BASE_YEAR, war: 2.5, salary: 1, salaryMode: "fixed" },
            ],
          }
        : {
            id,
            kind,
            custom: true,
            name: "Custom prospect",
            team,
            position: "SS",
            age: 20,
            source,
            prospectType: "Hitter",
            fv: "50",
            eta: BASE_YEAR + 1,
            adjustment: 0,
            rosterContext: "none",
            riskLabel: "Med",
          };
    setPlayers((current) => ({ ...current, [id]: player }));
    addPlayer(side, id);
  };
  const clearSharedTradeUrl = () => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("trade")) return;
    url.searchParams.delete("trade");
    window.history.replaceState(null, "", url);
  };
  const resetTrade = () => {
    clearSharedTradeUrl();
    setPlayers(deepCopy(initialPlayers));
    setLeftTeam("SEA");
    setRightTeam("PIT");
    setLeftIds(["mlb-677594"]);
    setRightIds(["mlb-694973"]);
    setLeftCash(0);
    setRightCash(0);
    setSelectedId("mlb-694973");
    setAdvancedOpen(false);
    setSettings(initialSettings);
    setLeftSearch("");
    setRightSearch("");
    setOpenPicker(null);
    setPickerIndex(0);
    setShowMethod(false);
    goToTab("trade");
    setShareStatus("idle");
    setSnapshotWarning(null);
    setFinderNotice(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const newTrade = () => {
    clearSharedTradeUrl();
    setPlayers(deepCopy(initialPlayers));
    setLeftTeam("SEA");
    setRightTeam("PIT");
    setLeftIds([]);
    setRightIds([]);
    setLeftCash(0);
    setRightCash(0);
    setSelectedId("");
    setAdvancedOpen(false);
    setSettings(initialSettings);
    setLeftSearch("");
    setRightSearch("");
    setOpenPicker(null);
    setPickerIndex(0);
    setShowMethod(false);
    goToTab("trade");
    setShareStatus("idle");
    setSnapshotWarning(null);
    setFinderNotice(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const changeDiscoveryTeam = (team: string) => {
    const topNeed = rankTeamNeeds(
      playerList,
      database.teams,
      team,
      BASE_YEAR,
      { valuationView: DISCOVERY_VIEW },
    )[0]?.id as DiscoveryPosition | undefined;
    setDiscoveryTeam(team);
    if (topNeed) setDiscoveryPosition(topNeed);
    setSelectedDiscoveryTargetId("");
  };
  const loadDiscoveryOffer = (
    target: DiscoveryTarget,
    offer: DiscoveryOffer,
  ) => {
    clearSharedTradeUrl();
    setLeftTeam(discoveryTeam);
    setLeftIds(offer.assetIds);
    setLeftCash(0);
    setRightTeam(target.player.team);
    setRightIds([target.id]);
    setRightCash(0);
    setSelectedId(target.id);
    setAdvancedOpen(true);
    setLeftSearch("");
    setRightSearch("");
    setOpenPicker(null);
    setPickerIndex(0);
    setShowMethod(false);
    setShareStatus("idle");
    setSnapshotWarning(null);
    // The finder runs in the July 31 deadline view, so its offers are priced
    // there. Load them into the builder in the same view and say so.
    setSettings((current) => ({ ...current, valuationView: DISCOVERY_VIEW }));
    setFinderNotice(
      `Opened from the Trade finder in the ${viewLabel(DISCOVERY_VIEW)}, which counts rest-of-${BASE_YEAR} value. Switch views under Model assumptions.`,
    );
    goToTab("trade");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const openMethod = () => {
    setShowMethod(true);
    window.setTimeout(() => {
      const method = document.getElementById("methodology");
      method?.scrollIntoView({ behavior: "smooth", block: "start" });
      method?.focus({ preventScroll: true });
    }, 0);
  };
  const swapTeams = () => {
    const team = leftTeam;
    const ids = leftIds;
    const cash = leftCash;
    setLeftTeam(rightTeam);
    setLeftIds(rightIds);
    setLeftCash(rightCash);
    setRightTeam(team);
    setRightIds(ids);
    setRightCash(cash);
    setLeftSearch("");
    setRightSearch("");
    setOpenPicker(null);
    setPickerIndex(0);
  };
  const copyTradeLink = async () => {
    const packageIds = Array.from(new Set([...leftIds, ...rightIds]));
    const overrides = packageIds
      .map((id) => players[id])
      .filter((player): player is Player => Boolean(player))
      .filter(
        (player) =>
          player.custom ||
          !initialPlayers[player.id] ||
          JSON.stringify(player) !== JSON.stringify(initialPlayers[player.id]),
      );
    const state: SharedTradeState = {
      v: 1,
      snapshot: database.meta.refreshed,
      modelVersion: TRADE_SHARE_MODEL_VERSION,
      leftTeam,
      rightTeam,
      leftIds,
      rightIds,
      leftCash,
      rightCash,
      selectedId: packageIds.includes(selectedId) ? selectedId : undefined,
      settings,
      overrides,
    };
    try {
      const url = buildTradeShareUrl(window.location.href, state);
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const textarea = document.createElement("textarea");
        try {
          textarea.value = url;
          textarea.style.position = "fixed";
          textarea.style.opacity = "0";
          document.body.appendChild(textarea);
          textarea.select();
          if (!document.execCommand("copy")) throw new Error("Copy failed");
        } finally {
          textarea.remove();
        }
      }
      setShareStatus("copied");
    } catch {
      setShareStatus("error");
    }
  };

  const renderCard = (id: string, side: "left" | "right") => {
    const player = players[id],
      result = values[id];
    if (!player || !result) return null;
    const adjusted = isAdjusted(player);
    return (
      <article
        className={`player-card ${selectedId === id ? "is-selected" : ""}`}
        key={id}
      >
        <button
          className="player-main"
          onClick={() => openPlayerEditor(id)}
          aria-label={`Edit ${player.name}`}
        >
          <span className="player-avatar" aria-hidden="true">
            {player.name
              .split(" ")
              .map((part) => part[0])
              .slice(0, 2)
              .join("")}
          </span>
          <span className="player-copy">
            <span className="player-name-row">
              <strong>{player.name}</strong>
              {adjusted && <b className="adjusted-badge">Adjusted</b>}
            </span>
            <small>
              {displayPosition(player)} · Age {player.age} ·{" "}
              {player.kind === "prospect"
                ? `${player.fv} FV · ${
                    player.riskLabel?.toLowerCase() === "med"
                      ? "medium"
                      : (player.riskLabel ?? "medium").toLowerCase()
                  } risk${
                    rosterContextLabel(player)
                      ? ` · ${rosterContextLabel(player)}`
                      : ""
                  }`
                : result.pendingFreeAgent
                  ? PENDING_FREE_AGENT_LABEL
                  : contractLabel(player, result)}
              {player.kind === "mlb" && player.availability
                ? ` · ${player.availability.status} on July 31`
                : ""}
              {player.kind === "mlb" &&
              player.tradeProtection &&
              player.tradeProtection !== "none"
                ? ` · ${tradeProtectionLabel(player).toLowerCase()}`
                : ""}
            </small>
            <span className="value-range">
              Range {rangeText(result.low, result.high)}
            </span>
          </span>
          <span className="player-value">
            {money(result.total)}
            <small>surplus</small>
          </span>
        </button>
        <button
          className="remove-button"
          onClick={() => removePlayer(side, id)}
          aria-label={`Remove ${player.name}`}
        >
          ×
        </button>
      </article>
    );
  };

  const renderTeamSide = ({
    side,
    team,
    ids,
    total,
  }: {
    side: "left" | "right";
    team: string;
    ids: string[];
    total: number;
  }) => {
    const available = libraryFor(team, ids);
    const search = side === "left" ? leftSearch : rightSearch;
    const setSearch = side === "left" ? setLeftSearch : setRightSearch;
    const cash = side === "left" ? leftCash : rightCash;
    const setCash = side === "left" ? setLeftCash : setRightCash;
    const query = search.trim().toLowerCase();
    const matches = available
      .filter((player) =>
        query
          ? `${player.name} ${displayPosition(player)} ${
              player.kind === "prospect"
                ? `${player.fv} fv prospect`
                : `mlb ${player.availability?.status ?? "active"} ${player.availability?.injury ?? ""}`
            }`
              .toLowerCase()
              .includes(query)
          : true,
      )
      .sort((a, b) => (values[b.id]?.total ?? 0) - (values[a.id]?.total ?? 0))
      .slice(0, 12);
    const choosePlayer = (player: Player) => {
      addPlayer(side, player.id);
      setSearch("");
      setOpenPicker(null);
      setPickerIndex(0);
    };
    return (
      <section className={`trade-side ${side}-side`}>
        <div className="side-heading">
          <div>
            <span>Team</span>
            <select
              className="team-select"
              aria-label={`${side} trading team`}
              value={team}
              onChange={(event) => changeTeam(side, event.target.value)}
            >
              {database.teams.map((item) => (
                <option
                  key={item.abbr}
                  value={item.abbr}
                  disabled={
                    item.abbr === (side === "left" ? rightTeam : leftTeam)
                  }
                >
                  {item.name}
                </option>
              ))}
            </select>
            <small>{teamName(team)} send</small>
          </div>
          <strong>{money(total)}</strong>
        </div>
        <div className="player-stack">
          {ids.length ? (
            ids.map((id) => renderCard(id, side))
          ) : (
            <div className="package-empty">
              No players added. Search the {teamName(team)} organization to
              begin.
            </div>
          )}
        </div>
        <label className={`cash-adjustment ${cash > 0 ? "has-cash" : ""}`}>
          <span>Cash sent / salary retained by {team}</span>
          <span className="cash-input">
            <b>$</b>
            <input
              aria-label={`${teamName(team)} cash or retained salary sent`}
              type="number"
              min="0"
              max={MAX_CASH_AMOUNT}
              step="0.1"
              value={cash || ""}
              placeholder="0.0"
              onChange={(event) =>
                setCash(normalizeCashAmount(event.target.value))
              }
            />
            <em>M</em>
          </span>
          {cash > 0 && (
            <small>
              Added dollar-for-dollar; CBT and payment timing are not modeled.
            </small>
          )}
        </label>
        <div className="add-row">
          <div className="player-picker">
            <input
              role="combobox"
              aria-autocomplete="list"
              aria-label={`Search ${teamName(team)} players`}
              aria-expanded={openPicker === side}
              aria-controls={`${side}-player-results`}
              placeholder={`Search ${teamName(team)} players…`}
              value={search}
              aria-activedescendant={
                openPicker === side && matches[pickerIndex]
                  ? `${side}-player-${matches[pickerIndex].id}`
                  : undefined
              }
              onFocus={() => {
                setOpenPicker(side);
                setPickerIndex(0);
              }}
              onBlur={() => window.setTimeout(() => setOpenPicker(null), 120)}
              onChange={(event) => {
                setSearch(event.target.value);
                setOpenPicker(side);
                setPickerIndex(0);
              }}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown" && matches.length) {
                  event.preventDefault();
                  setPickerIndex((index) =>
                    Math.min(index + 1, matches.length - 1),
                  );
                }
                if (event.key === "ArrowUp" && matches.length) {
                  event.preventDefault();
                  setPickerIndex((index) => Math.max(index - 1, 0));
                }
                if (event.key === "Enter" && matches[pickerIndex]) {
                  event.preventDefault();
                  choosePlayer(matches[pickerIndex]);
                }
                if (event.key === "Escape") setOpenPicker(null);
              }}
            />
            {openPicker === side && (
              <div
                className="picker-menu"
                id={`${side}-player-results`}
                role="listbox"
              >
                <span className="picker-heading">
                  {query ? "Search results" : "Top suggestions · type to search all"}
                </span>
                {matches.length ? (
                  matches.map((player, index) => (
                    <button
                      type="button"
                      role="option"
                      aria-selected={pickerIndex === index}
                      key={player.id}
                      id={`${side}-player-${player.id}`}
                      className={pickerIndex === index ? "is-active" : ""}
                      onMouseEnter={() => setPickerIndex(index)}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => choosePlayer(player)}
                    >
                      <span>
                        <strong>{player.name}</strong>
                        <small>
                          {displayPosition(player)} · {player.kind === "prospect" ? `${player.fv} FV prospect` : "MLB"}
                          {values[player.id]?.pendingFreeAgent
                            ? " · Pending free agent"
                            : ""}
                        </small>
                      </span>
                      <b>{money(values[player.id]?.total ?? 0)}</b>
                    </button>
                  ))
                ) : (
                  <p>No matching players in this organization.</p>
                )}
              </div>
            )}
          </div>
          <button onClick={() => addCustom(side, "mlb")}>Custom MLB</button>
          <button onClick={() => addCustom(side, "prospect")}>
            Custom prospect
          </button>
        </div>
      </section>
    );
  };

  const renderDiscovery = () => (
    <section className="discovery-panel" aria-label="Trade discovery tool">
      <header className="discovery-heading">
        <div>
          <span>Trade finder</span>
          <h2>Turn a roster hole into a short list</h2>
          <p>
            Pick a club, choose one of its weakest position groups, and compare
            upgrades from teams with low July 31 playoff odds. Then open a
            value-matched offer in the trade builder.
          </p>
        </div>
        <b>July 2026 board</b>
      </header>
      <p className="finder-banner" role="note">
        <strong>
          Deadline archive: July 31, 2026 rosters, playoff odds and
          rest-of-season needs. Not an offseason trade list.
        </strong>
        <span>
          The finder always uses the {viewLabel(DISCOVERY_VIEW)}, because its
          low-odds teams come from July 31 playoff odds. That view counts the
          rest of {BASE_YEAR}. Offers you open in the builder switch it to the
          same view.
        </span>
      </p>

      <div className="discovery-controls">
        <label>
          <span>Your team</span>
          <select
            value={discoveryTeam}
            onChange={(event) => changeDiscoveryTeam(event.target.value)}
          >
            {database.teams.map((team) => (
              <option key={team.abbr} value={team.abbr}>
                {team.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Teams by July playoff odds</span>
          <select
            value={sellerThreshold}
            onChange={(event) => {
              setSellerThreshold(Number(event.target.value));
              setSelectedDiscoveryTargetId("");
            }}
          >
            <option value="20">20% odds or lower</option>
            <option value="35">35% odds or lower</option>
            <option value="50">50% odds or lower</option>
          </select>
        </label>
        <div className="discovery-source">
          <span>July playoff context</span>
          <strong>{playoffOddsData.mode}</strong>
          <a href={playoffOddsData.sourceUrl} target="_blank" rel="noreferrer">
            FanGraphs odds · {prettyDate(playoffOddsData.refreshed)} ↗
          </a>
        </div>
      </div>

      <div className="discovery-explainer">
        <span>How needs are ranked</span>
        <p>
          Each of the {DISCOVERY_POSITIONS.length} position groups is compared
          with the same position on every other club: 45% season-to-date fWAR
          rank and 55% Depth Charts rest-of-season fWAR rank. fWAR means FanGraphs
          wins above replacement; these are July 2026 rankings. Rotation,
          bullpen, and outfield are evaluated as multi-player units. The
          estimated upgrade compares a target with the selected team&apos;s marginal
          starter. Targets are then sorted by fit, which weighs control, age,
          health, and trade protection. These inputs do not establish availability.
        </p>
      </div>

      <div className="discovery-columns">
        <section className="need-board">
          <div className="discovery-section-title">
            <span>1</span>
            <div>
              <h3>Choose a need</h3>
              <p>{teamName(discoveryTeam)} position-group rankings</p>
            </div>
          </div>
          <div className="need-list">
            {discoveryNeeds.map((need) => (
              <button
                type="button"
                key={need.id}
                className={need.id === discoveryPosition ? "is-active" : ""}
                aria-pressed={need.id === discoveryPosition}
                onClick={() => {
                  setDiscoveryPosition(need.id as DiscoveryPosition);
                  setSelectedDiscoveryTargetId("");
                }}
              >
                <span className="need-identity">
                  <strong>{need.shortLabel}</strong>
                  <small>{need.label}</small>
                </span>
                <span className="need-metric">
                  <b>{need.seasonToDateWar.toFixed(1)}</b>
                  <small>
                    Season to date · {need.seasonToDateRank} of {database.teams.length}
                  </small>
                </span>
                <span className="need-metric">
                  <b>{need.restOfSeasonWar.toFixed(1)}</b>
                  <small>
                    Rest of season · {need.restOfSeasonRank} of {database.teams.length}
                  </small>
                </span>
                <span className={`need-status ${need.needScore >= 72 ? "urgent" : ""}`}>
                  {need.needLabel}
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="target-board">
          <div className="discovery-section-title">
            <span>2</span>
            <div>
              <h3>{selectedDiscoveryNeed?.label ?? discoveryPosition} targets</h3>
              <p>
                Estimated rest-of-season improvement, sorted by fit: veterans
                and short control move up; core players, injured players, and
                players with no-trade rights move down
              </p>
            </div>
          </div>
          <div className="target-list">
            {discoveryTargets.map((target) => {
              return (
                <button
                  type="button"
                  key={target.id}
                  className={
                    target.id === activeDiscoveryTarget?.id ? "is-active" : ""
                  }
                  aria-pressed={target.id === activeDiscoveryTarget?.id}
                  onClick={() => setSelectedDiscoveryTargetId(target.id)}
                >
                  <span className="target-player">
                    <strong>{target.player.name}</strong>
                    <small>
                      {teamName(target.player.team)} · {displayPosition(target.player)} ·{" "}
                      {contractLabel(players[target.id] as MLBPlayer, discoveryValues[target.id])}
                    </small>
                    {(target.player.availability ||
                      target.player.tradeProtection === "full") && (
                      <em>
                        {target.player.availability
                          ? `${target.player.availability.status} on July 31`
                          : "Player approval required"}
                      </em>
                    )}
                  </span>
                  <span className="target-upgrade">
                    <strong>+{target.improvement.toFixed(1)} WAR</strong>
                    <small>estimated remaining-season gain</small>
                  </span>
                  <span className="target-market">
                    <b>{shortNumber(target.playoffOdds)}%</b>
                    <small>playoff odds</small>
                  </span>
                  <span className="target-value">
                    <b>{money(target.tradeValue)}</b>
                    <small>trade value</small>
                  </span>
                </button>
              );
            })}
            {!discoveryTargets.length && (
              <div className="discovery-empty">
                <strong>No clear upgrades under this July odds filter.</strong>
                <p>Try a wider playoff-odds threshold or another position.</p>
              </div>
            )}
          </div>
        </section>
      </div>

      {activeDiscoveryTarget && (
        <section className="offer-board">
          <div className="discovery-section-title">
            <span>3</span>
            <div>
              <h3>Possible offers for {activeDiscoveryTarget.player.name}</h3>
              <p>
                Alternative package shapes matched to a {money(activeDiscoveryTarget.tradeValue)} midpoint
              </p>
            </div>
          </div>
          <div className="offer-grid">
            {discoveryOffers.map((offer, index) => (
              <article key={`${offer.label}-${index}`}>
                <div className="offer-heading">
                  <span>{offer.label}</span>
                  <strong>{money(offer.total)}</strong>
                </div>
                <ul>
                  {offer.assets.map((asset: DiscoveryOfferAsset) => (
                    <li key={asset.id}>
                      <span>
                        <strong>{asset.player.name}</strong>
                        <small>
                          {asset.player.kind === "prospect"
                            ? `${asset.player.fv} FV · ${displayPosition(asset.player)}`
                            : `${displayPosition(asset.player)} · MLB`}
                        </small>
                      </span>
                      <b>{money(asset.value)}</b>
                    </li>
                  ))}
                </ul>
                <p>
                  {offer.salaryRelief
                    ? "The target has non-positive surplus value; retained salary or cash would determine the final shape."
                    : offer.gap === 0
                      ? "The midpoints match exactly."
                      : `${money(Math.abs(offer.gap))} ${offer.gap > 0 ? "above" : "below"} the target’s midpoint.`}
                </p>
                <button
                  type="button"
                  onClick={() =>
                    loadDiscoveryOffer(activeDiscoveryTarget, offer)
                  }
                >
                  Open in trade builder
                </button>
              </article>
            ))}
            {!discoveryOffers.length && (
              <div className="offer-empty">
                <strong>No compact value match.</strong>
                <p>
                  This farm system cannot build a one-to-three-player package
                  within 30% of the target’s midpoint. Try another target
                  or construct a larger framework manually.
                </p>
              </div>
            )}
          </div>
          <small className="offer-disclaimer">
            Starting points, not rumors. Packages use positive-value prospects
            and cost-controlled MLB players, avoid trading an incumbent from the
            selected hole, and show only one-to-three-player combinations within
            30% of the current model—not a club’s private preferences.
          </small>
        </section>
      )}
    </section>
  );

  return (
    <div className="tool-workspace">
      <div className="page" id="top">
        <section className="intro">
          <div>
            <p className="kicker">Dugout Value tools</p>
            <h1>
              {activeTab === "trade"
                ? "Trade builder"
                : activeTab === "discover"
                  ? "Trade finder"
                  : activeTab === "projections"
                    ? "Player projections"
                    : "Value rankings"}
            </h1>
            <p className="lede">
              {activeTab === "trade"
                ? "Put two packages side by side. See each one’s surplus value by year, then change the assumptions you disagree with."
                : activeTab === "discover"
                  ? "Pick a team, find its weakest position as of July 31, and see which players on low-odds clubs would fill it."
                  : activeTab === "projections"
                    ? `fWAR for ${PROJECTION_YEARS[0]} through ${PROJECTION_YEARS[2]} for ${database.meta.mlbCount.toLocaleString("en-US")} major leaguers, as of July 31. Every in-season adjustment to ZiPS is shown.`
                    : "The 100 players and prospects with the most surplus value, as of July 31."}
            </p>
          </div>
        </section>
        <div className="workspace-bar">
          <nav className="workspace-tabs" aria-label="Analysis tools">
            {(["trade", "discover", "projections", "rankings"] as const).map((tab) => (
              <a
                key={tab}
                href={TAB_PATHS[tab]}
                aria-current={activeTab === tab ? "page" : undefined}
                className={activeTab === tab ? "is-active" : ""}
                onClick={(event) => {
                  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                  event.preventDefault();
                  goToTab(tab);
                }}
              >
                <span className="tab-long">{tab === "trade" ? "Trade builder" : tab === "discover" ? "Trade finder" : tab === "projections" ? "Player projections" : "Value rankings"}</span>
                <span className="tab-short" aria-hidden="true">{tab === "trade" ? "Trade" : tab === "discover" ? "Finder" : tab === "projections" ? "Projections" : "Rankings"}</span>
              </a>
            ))}
          </nav>
          {activeTab === "trade" && (
            <div className="tool-toolbar" role="group" aria-label="Trade actions">
              <button type="button" className="toolbar-button" onClick={openMethod}>
                Calculation
              </button>
              <button type="button" className="toolbar-button" onClick={resetTrade}>
                Load example
              </button>
              <button type="button" className="toolbar-button primary" onClick={newTrade}>
                New trade
              </button>
            </div>
          )}
        </div>
        <SnapshotNotice />
        {snapshotWarning && <p className="snapshot-warning" role="alert">{snapshotWarning}</p>}
        {activeTab === "trade" &&
          finderNotice &&
          settings.valuationView === DISCOVERY_VIEW && (
            <p className="view-notice" role="status">{finderNotice}</p>
          )}
        {activeTab === "trade" ? (
          <>
        <details className="assumptions">
          <summary>Model assumptions · {viewLabel(settings.valuationView)} · {discountLabel(settings.timingPreference).short} · edit values</summary>
        <section className="model-strip">
          <div>
            <span>Value per projected win</span>
            <strong>
              ${settings.dollarsPerWar}M + {settings.starPremium}% above{" "}
              {settings.starThreshold} net WAR
            </strong>
          </div>
          <div>
            <span>Valuation view</span>
            <strong>{viewLabel(settings.valuationView)}</strong>
          </div>
          <div>
            <span>Roster-spot allowance</span>
            <strong>
              {settings.regularRosterWar.toFixed(1)} /{" "}
              {settings.relieverRosterWar.toFixed(1)} fWAR by role
            </strong>
          </div>
          <div>
            <span>Discount rate</span>
            <strong>{discountLabel(settings.timingPreference).long}</strong>
          </div>
          <button
            type="button"
            className={`deadline-toggle ${settings.valuationView === "deadline" && settings.deadlineBoost > 0 ? "is-active" : ""}`}
            aria-pressed={settings.valuationView === "deadline" && settings.deadlineBoost > 0}
            disabled={settings.valuationView === "offseason"}
            title={
              settings.valuationView === "offseason"
                ? DEADLINE_SCENARIO_REASON
                : undefined
            }
            onClick={() =>
              setSettings({
                ...settings,
                deadlineBoost: settings.deadlineBoost > 0 ? 0 : 15,
              })
            }
          >
            <span>July deadline scenario</span>
            <strong>
              {settings.valuationView === "offseason"
                ? "Off · July 31 deadline view only"
                : settings.deadlineBoost > 0
                  ? "On · current wins + October"
                  : "Off · baseline value"}
            </strong>
          </button>
        </section>
          <section className="assumption-panel">
            <div className="timing-presets view-presets">
              <span>Valuation view</span>
              <div>
                <button
                  type="button"
                  className={
                    settings.valuationView === "offseason" ? "is-active" : ""
                  }
                  aria-pressed={settings.valuationView === "offseason"}
                  onClick={() =>
                    setSettings({ ...settings, valuationView: "offseason" })
                  }
                >
                  {viewLabel("offseason")}
                  <small>Drops the rest of {BASE_YEAR}; pending free agents leave the board</small>
                </button>
                <button
                  type="button"
                  className={
                    settings.valuationView === "deadline" ? "is-active" : ""
                  }
                  aria-pressed={settings.valuationView === "deadline"}
                  onClick={() =>
                    setSettings({ ...settings, valuationView: "deadline" })
                  }
                >
                  {viewLabel("deadline")}
                  <small>Includes rest of {BASE_YEAR}. The view the database was built for</small>
                </button>
              </div>
            </div>
            <div className="timing-presets discount-presets">
              <span>Discount rate</span>
              <div>
                {DISCOUNT_PRESETS.map((preset) => (
                  <button
                    type="button"
                    key={preset.value}
                    className={
                      settings.timingPreference === preset.value
                        ? "is-active"
                        : ""
                    }
                    aria-pressed={settings.timingPreference === preset.value}
                    onClick={() =>
                      setSettings({
                        ...settings,
                        timingPreference: preset.value,
                      })
                    }
                  >
                    {preset.label}
                    <small>{preset.note}</small>
                  </button>
                ))}
              </div>
            </div>
            <div className="timing-presets deadline-presets">
              <span>July deadline scenario</span>
              <div>
                <button
                  type="button"
                  disabled={settings.valuationView === "offseason"}
                  className={
                    settings.valuationView === "deadline" &&
                    settings.deadlineBoost === 0
                      ? "is-active"
                      : ""
                  }
                  onClick={() =>
                    setSettings({ ...settings, deadlineBoost: 0 })
                  }
                >
                  Off
                  <small>No deadline adjustment</small>
                </button>
                <button
                  type="button"
                  disabled={settings.valuationView === "offseason"}
                  className={
                    settings.valuationView === "deadline" &&
                    settings.deadlineBoost > 0
                      ? "is-active"
                      : ""
                  }
                  onClick={() =>
                    setSettings({ ...settings, deadlineBoost: 15 })
                  }
                >
                  On
                  <small>Current wins + October SP value</small>
                </button>
              </div>
              {settings.valuationView === "offseason" && (
                <small className="preset-reason">
                  {DEADLINE_SCENARIO_REASON}
                </small>
              )}
            </div>
            <label>
              <span>Base dollars per WAR</span>
              <NumericField
                label="Dollars per WAR"
                value={settings.dollarsPerWar}
                min={0}
                onChange={(value) =>
                  setSettings({ ...settings, dollarsPerWar: value })
                }
              />
            </label>
            <label>
              <span>Star premium</span>
              <NumericField
                label="Star premium"
                value={settings.starPremium}
                min={0}
                onChange={(value) =>
                  setSettings({ ...settings, starPremium: value })
                }
              />
              <em>%</em>
            </label>
            <label>
              <span>Premium starts after</span>
              <NumericField
                label="Net WAR before the star premium begins"
                value={settings.starThreshold}
                min={0}
                onChange={(value) =>
                  setSettings({ ...settings, starThreshold: value })
                }
              />
              <em>net WAR</em>
            </label>
            <label>
              <span>Roster-spot allowance: hitters / SP</span>
              <NumericField
                label="Roster-spot allowance for position players and starters"
                value={settings.regularRosterWar}
                min={0}
                onChange={(value) =>
                  setSettings({ ...settings, regularRosterWar: value })
                }
              />
              <em>WAR</em>
            </label>
            <label>
              <span>Roster-spot allowance: relievers</span>
              <NumericField
                label="Roster-spot allowance for relievers"
                value={settings.relieverRosterWar}
                min={0}
                onChange={(value) =>
                  setSettings({ ...settings, relieverRosterWar: value })
                }
              />
              <em>WAR</em>
            </label>
            <label>
              <span>Custom discount rate</span>
              <NumericField
                label="Custom discount rate, percent per year"
                value={settings.timingPreference}
                min={0}
                max={100}
                onChange={(value) =>
                  setSettings({ ...settings, timingPreference: value })
                }
              />
              <em>%</em>
            </label>
            <label>
              <span>Optional reliever premium</span>
              <NumericField
                label="Reliever market premium"
                value={settings.relieverPremium}
                min={0}
                onChange={(value) =>
                  setSettings({ ...settings, relieverPremium: value })
                }
              />
              <em>%</em>
            </label>
            <label>
              <span>Custom deadline boost</span>
              <NumericField
                label="Custom deadline boost"
                value={settings.deadlineBoost}
                disabled={settings.valuationView === "offseason"}
                min={0}
                max={50}
                onChange={(value) =>
                  setSettings({ ...settings, deadlineBoost: value })
                }
              />
              <em>%</em>
            </label>
            <label>
              <span>October SP benchmark</span>
              <NumericField
                label="Net displaced starter baseline"
                disabled={settings.valuationView === "offseason"}
                value={settings.postseasonStarterBaselineWar}
                min={0}
                max={10}
                onChange={(value) =>
                  setSettings({
                    ...settings,
                    postseasonStarterBaselineWar: value,
                  })
                }
              />
              <em>WAR / 180</em>
            </label>
            <label>
              <span>October workload equivalent</span>
              <NumericField
                label="Postseason equivalent share of a season"
                disabled={settings.valuationView === "offseason"}
                value={settings.postseasonEquivalentSeason}
                min={0}
                max={100}
                onChange={(value) =>
                  setSettings({
                    ...settings,
                    postseasonEquivalentSeason: value,
                  })
                }
              />
              <em>% season</em>
            </label>
            <label>
              <span>WAR-price inflation</span>
              <NumericField
                label="WAR inflation"
                value={settings.inflation}
                min={0}
                onChange={(value) =>
                  setSettings({ ...settings, inflation: value })
                }
              />
              <em>%</em>
            </label>
            <label>
              <span>2026 minimum salary</span>
              <NumericField
                label="Minimum salary"
                value={settings.minimumSalary}
                min={0}
                onChange={(value) =>
                  setSettings({ ...settings, minimumSalary: value })
                }
              />
              <em>M</em>
            </label>
            <p>
              Net fWAR subtracts the role’s roster-spot allowance, then the
              first two wins use the base rate and additional wins receive the
              star premium. FanGraphs pitcher WAR already includes a leverage
              adjustment, so the extra reliever premium stays an optional team
              preference rather than a hidden assumption. The discount rate
              divides each season’s surplus by (1 + rate) for every year after{" "}
              {BASE_YEAR}; FanGraphs uses 10%, and its prospect values already
              include it. The offseason view drops the rest of {BASE_YEAR},
              whose regular season is over. The July deadline scenario applies to the
              July 31 deadline view only: it raises the market value of
              rest-of-{BASE_YEAR} production and gives top starters an October
              rotation term above a two-WAR net benchmark. It never changes
              salary, option costs, future seasons, or prospect values.
            </p>
          </section>
        </details>

        {showDriversBanner && selected && driversOrigin && (
          <div className="drivers-banner" id="drivers-banner" role="status">
            <p>
              {`Showing ${selected.name}'s value drivers. He isn't part of the trade below.`}
            </p>
            <button type="button" onClick={backFromDrivers}>
              ← Back to {driversOrigin.from}
            </button>
          </div>
        )}
        <section
          className={`trade-shell${showDriversBanner ? " drivers-mode" : ""}`}
        >
          <div className="trade-board">
            <div className="package-explainer">
              <span>How to read this</span>
              <strong>Each column is what that team gives up.</strong>
            </div>
            <div className="trade-sides">
              {renderTeamSide({
                side: "left",
                team: leftTeam,
                ids: leftIds,
                total: leftTotal,
              })}
              {renderTeamSide({
                side: "right",
                team: rightTeam,
                ids: rightIds,
                total: rightTotal,
              })}
              <div
                className="trade-verdict"
                aria-label="Trade comparison scoreboard"
              >
                <div className="scoreboard-line">
                  <div className="scoreboard-team">
                    <span>{leftTeam} package</span>
                    <strong>{money(leftTotal)}</strong>
                    <small>
                      Range {rangeText(leftLow, leftHigh)}
                    </small>
                  </div>
                  <div className="scoreboard-center">
                    <strong>{verdictHeadline}</strong>
                    {(verdictState === "overlap" || verdictState === "clear") && (
                      <small className="gap-share">{gapDetailText}</small>
                    )}
                    <span
                      className={`verdict-stamp ${verdictState === "clear" ? "" : "balanced"}`}
                    >
                      {verdictStamp}
                    </span>
                    <p>{verdictSentence}</p>
                  </div>
                  <div className="scoreboard-team scoreboard-team-right">
                    <span>{rightTeam} package</span>
                    <strong>{money(rightTotal)}</strong>
                    <small>
                      Range {rangeText(rightLow, rightHigh)}
                    </small>
                  </div>
                </div>
                {(verdictState === "even" || verdictState === "overlap" || verdictState === "clear") && (
                  <>
                    <p className="scoreboard-range-note">
                      Each range adds a set allowance for player risk, injury, and years of control. It isn’t a confidence interval, and it doesn’t say whether a club would agree. To test a setting, change it in the assumptions panel above.
                    </p>
                    <p className="scoreboard-links">
                      <button type="button" className="text-button" onClick={openMethod}>
                        Why this result? →
                      </button>
                      <Link href="/analysis/how-to-read-value-ranges">How to read ranges →</Link>
                    </p>
                  </>
                )}
                {(tradeProtectionSummary || availabilitySummary) && (
                  <div className="scoreboard-context">
                    {tradeProtectionSummary && (
                      <p className="trade-caveat">
                        {tradeProtectionSummary}. {protectedPackagePlayers.length === 1 ? "His value isn’t reduced for it." : "Their values aren’t reduced for it."}
                      </p>
                    )}
                    {availabilitySummary && (
                      <p className="trade-caveat availability-caveat">
                        {availabilitySummary}. The range is wider. The projection already accounts for missed time, so the midpoint isn’t cut again.
                      </p>
                    )}
                  </div>
                )}
                {consolidation && (
                  <div className="package-shape-note">
                    <span>Package shape</span>
                    <strong>
                      {teamName(
                        consolidation.headlinerSide === "left"
                          ? leftTeam
                          : rightTeam,
                      )} give up the best player in the deal
                    </strong>
                    <p>
                      The totals are close, but the other side is paying in
                      quantity. Teams usually want a premium for the best
                      player in a deal, and this model doesn’t add one. A close
                      total here probably understates what{" "}
                      {teamName(
                        consolidation.headlinerSide === "left"
                          ? leftTeam
                          : rightTeam,
                      )} would ask for.
                    </p>
                  </div>
                )}
                <div className="scoreboard-actions">
                  <div className="trade-actions">
                    <button onClick={swapTeams}>Swap teams</button>
                    <button className="share-trade" onClick={copyTradeLink}>
                      Copy trade link
                    </button>
                  </div>
                  <small className="share-status" aria-live="polite">
                    {shareStatus === "loaded"
                      ? "Shared trade loaded"
                      : shareStatus === "copied"
                        ? "Link copied"
                        : shareStatus === "error"
                          ? "Couldn’t copy link"
                          : "Link saves players, cash, and any edits."}
                  </small>
                </div>
              </div>
            </div>
            <TradeSensitivity
              players={players}
              settings={settings}
              leftIds={leftIds}
              rightIds={rightIds}
              leftCash={leftCash}
              rightCash={rightCash}
              leftTeam={leftTeam}
              rightTeam={rightTeam}
            />
            <section className="year-ledger">
              <div className="section-title">
                <div>
                  <span>Control years</span>
                  <h2>Value by control year</h2>
                </div>
              </div>
              {allYears.length || leftCash > 0 || rightCash > 0 ? (
                  <div className="ledger-table">
                    <div className="ledger-row ledger-head">
                      <span>Year</span>
                      <span>{leftTeam} package</span>
                      <span>Annual comparison</span>
                      <span>{rightTeam} package</span>
                    </div>
                    {ledgerYears.map((year) => {
                      const lv = sideYearValue(leftIds, year),
                        rv = sideYearValue(rightIds, year);
                      if (yearIsExcluded(year))
                        return (
                          <div className="ledger-row ledger-excluded" key={year}>
                            <strong>{year}</strong>
                            <span>—</span>
                            <small>Not counted: the {year} regular season is over</small>
                            <span>—</span>
                          </div>
                        );
                      return (
                        <div className="ledger-row" key={year}>
                          <strong>{year}</strong>
                          <span>{money(lv)}</span>
                          <div className="year-bars">
                            <i
                              className={`left-bar ${lv < 0 ? "negative" : ""}`}
                              style={{ width: `${barWidth(lv)}%` }}
                            />
                            <b />
                            <i
                              className={`right-bar ${rv < 0 ? "negative" : ""}`}
                              style={{ width: `${barWidth(rv)}%` }}
                            />
                          </div>
                          <span>{money(rv)}</span>
                        </div>
                      );
                    })}
                    {(leftCash > 0 || rightCash > 0) && (
                      <div className="ledger-row cash-ledger-row">
                        <strong>Cash / relief</strong>
                        <span>{money(leftCash)}</span>
                        <div className="year-bars">
                          <i
                            className="left-bar"
                            style={{
                              width: `${leftCash > 0 ? Math.max(2, (leftCash / maxYearValue) * 96) : 0}%`,
                            }}
                          />
                          <b />
                          <i
                            className="right-bar"
                            style={{
                              width: `${rightCash > 0 ? Math.max(2, (rightCash / maxYearValue) * 96) : 0}%`,
                            }}
                          />
                        </div>
                        <span>{money(rightCash)}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="empty-ledger">
                    Add players to compare the packages.
                  </p>
                )}
            </section>
          </div>

          <aside className="editor" id="player-editor">
            {selected ? (
              <>
                <div className="editor-heading">
                  <div>
                    <span>Adjust valuation</span>
                    <h2>{selected.name}</h2>
                  </div>
                  {selectedAdjusted && (
                    <div className="editor-adjustment">
                      <b>Adjusted</b>
                      <button
                        type="button"
                        onClick={() =>
                          setPlayers((current) => ({
                            ...current,
                            [selected.id]: deepCopy(initialPlayers[selected.id]),
                          }))
                        }
                      >
                        Reset to source
                      </button>
                    </div>
                  )}
                </div>
                {selectedValue?.pendingFreeAgent && (
                  <p className="pending-fa-note">{PENDING_FREE_AGENT_LABEL}</p>
                )}
                <p className="editor-summary">
                  {selectedValue ? playerDriverSentence(selected, selectedValue) : ""}
                </p>
                <p className="editor-range-line">
                  {selectedValue?.pendingFreeAgent
                    ? ""
                    : `Range ${rangeText(selectedValue?.low ?? 0, selectedValue?.high ?? 0)} around the ${money(selectedValue?.total ?? 0)} midpoint. `}
                  {selectedValue && selectedValue.excludedRosValue
                    ? `Excludes ${money(selectedValue.excludedRosValue)} of rest-of-${BASE_YEAR} value. `
                    : ""}
                  {selected.kind === "mlb" &&
                  selectedValue?.extrapolatedShare != null &&
                  selectedValue.extrapolatedShare > 0.2
                    ? `${Math.round(selectedValue.extrapolatedShare * 100)}% of the value comes from seasons after ${selected.agingModel?.anchorYear ?? "the last published ZiPS season"}, which the aging model extrapolates. `
                    : ""}
                  {valuationBasisLabel(selectedValue)
                    ? `Valued on ${valuationBasisLabel(selectedValue).toLowerCase()}.`
                    : ""}
                </p>
                {selected.kind === "mlb" && (
                  <p className="not-modeled-note">{NOT_MODELED_NOTE}</p>
                )}
                <details
                  className="editor-advanced"
                  open={advancedOpen}
                  onToggle={(event) => setAdvancedOpen(event.currentTarget.open)}
                >
                  <summary>Advanced player inputs and source breakdown</summary>
                {selected.custom ? (
                  <div className="form-grid two-col">
                    <label>
                      <span>Name</span>
                      <input
                        value={selected.name}
                        onChange={(event) =>
                          updatePlayer(selected.id, (player) => ({
                            ...player,
                            name: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <label>
                      <span>Position</span>
                      <input
                        value={selected.position}
                        onChange={(event) =>
                          updatePlayer(selected.id, (player) => ({
                            ...player,
                            position: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <label>
                      <span>Age</span>
                      <NumericField
                        label="Age"
                        value={selected.age}
                        step={1}
                        min={15}
                        onChange={(value) =>
                          updatePlayer(selected.id, (player) => ({
                            ...player,
                            age: value,
                          }))
                        }
                      />
                    </label>
                  </div>
                ) : (
                  <div className="identity-card">
                    <span>{selected.team}</span>
                    <strong>{displayPosition(selected)}</strong>
                    <small>
                      Age {selected.age}
                      {selected.kind === "prospect" && selected.rank
                        ? ` · No. ${selected.rank} on The Board`
                        : ""}
                    </small>
                  </div>
                )}
                <div
                  className="provenance-card"
                  aria-label="Built-in data sources"
                >
                  <div>
                    <span>Projection</span>
                    <strong>{selected.source.projection}</strong>
                  </div>
                  <div>
                    <span>
                      {selected.kind === "mlb"
                        ? "Contract / control"
                        : "Prospect grades"}
                    </span>
                    <strong>{selected.source.contract}</strong>
                  </div>
                  <small>Source snapshot {prettyDate(selected.source.refreshed)}</small>
                </div>
                {selected.kind === "mlb" && (
                  <div
                    className={`tradeability-card ${selected.tradeProtection ?? "none"}`}
                  >
                    <div>
                      <span>Tradeability</span>
                      <strong>{tradeProtectionLabel(selected)}</strong>
                    </div>
                    <select
                      aria-label="Trade protection"
                      value={selected.tradeProtection ?? "none"}
                      onChange={(event) =>
                        updatePlayer(selected.id, (player) =>
                          player.kind === "mlb"
                            ? {
                                ...player,
                                tradeProtection: event.target
                                  .value as TradeProtection,
                              }
                            : player,
                        )
                      }
                    >
                      <option value="none">No listed protection</option>
                      <option value="partial">Limited trade list</option>
                      <option value="full">Player approval required</option>
                    </select>
                    <small>
                      {(selected.tradeProtection ?? "none") === "none"
                        ? "No clause is listed in the contract feed; confirm 10-and-5 rights before a real deal."
                        : "A consent constraint, not a discount to the player’s underlying baseball value."}
                    </small>
                  </div>
                )}
                {selected.kind === "mlb" && selected.availability && (
                  <div className="availability-card">
                    <div>
                      <span>Availability in July 31 snapshot</span>
                      <strong>{availabilityLabel(selected)}</strong>
                    </div>
                    <b>
                      Range ±
                      {shortNumber(
                        selected.availability.riskAdjustment / 2,
                      )}{" "}
                      pts
                    </b>
                    <small>
                      {selected.availability.latestUpdate}
                      {selected.availability.eligibleDate
                        ? ` · Listed eligible ${selected.availability.eligibleDate}`
                        : ""}
                      . This injury adds {selected.availability.riskAdjustment}{" "}
                      risk points; every two points widen each side of the
                      value range by one percentage point, up to the model cap.
                      The midpoint stays unchanged because Depth Charts RoS
                      already accounts for expected missed time.
                    </small>
                  </div>
                )}
                {selected.kind === "mlb" && selected.lastProspect && (
                  <div className="rookie-valuation">
                    <div>
                      <span>Early-career valuation</span>
                      <strong>
                        {selected.lastProspect.year} FanGraphs:{" "}
                        {selected.lastProspect.fv} FV
                        {selected.lastProspect.rank
                          ? ` · No. ${selected.lastProspect.rank}`
                          : ""}
                      </strong>
                      <small>
                        {selected.lastProspect.serviceTime.toFixed(3)} years of
                        service at last ranking
                      </small>
                    </div>
                    <label>
                      <span>Value basis</span>
                      <select
                        value={selected.rookieMode ?? "projection"}
                        onChange={(event) =>
                          updatePlayer(selected.id, (player) =>
                            player.kind === "mlb"
                              ? {
                                  ...player,
                                  rookieMode: event.target.value as RookieMode,
                                }
                              : player,
                          )
                        }
                      >
                        <option value="blend">
                          Blend projection + last FV
                        </option>
                        <option value="projection">MLB projection only</option>
                        <option value="prospect">Last prospect FV only</option>
                      </select>
                    </label>
                    <div className="rookie-values">
                      <span>
                        Projection{" "}
                        {money(values[selected.id]?.projectionTotal ?? 0)}
                      </span>
                      <span>
                        Last FV {money(values[selected.id]?.prospectTotal ?? 0)}
                        {values[selected.id]?.prospectRankAdjustment
                          ? ` · rank ${signedPercent(values[selected.id]?.prospectRankAdjustment ?? 0)}`
                          : ""}
                      </span>
                    </div>
                    <small className="basis-line">
                      Valued on{" "}
                      {valuationBasisLabel(selectedValue)
                        ? `${valuationBasisLabel(selectedValue).toLowerCase()} (${Math.round((selectedValue?.prospectWeight ?? 0) * 100)}% weight on the prospect grade)`
                        : "projection"}
                      .
                    </small>
                  </div>
                )}
                {selected.kind === "mlb" && (
                  <p className="ros-note">
                    {settings.valuationView === "offseason" ? (
                      <>
                        <strong>
                          The rest of {BASE_YEAR} is excluded in the offseason view.
                        </strong>{" "}
                        That row stays in the table below for reference but
                        adds nothing to value.
                      </>
                    ) : (
                      <>
                        <strong>2026 is rest-of-season only.</strong> fWAR, the
                        free-WAR threshold, and salary are reduced to the
                        remaining season.
                      </>
                    )}{" "}
                    Future arbitration starts from the full-year salary (
                    {money(
                      selectedSeasons[0]?.annualSalary ??
                        selectedSeasons[0]?.salary ??
                        0,
                    )}
                    ). Every arbitration year prices the latest full-season
                    platform stats against the player&apos;s arbitration class. For
                    repeat-eligible players, it also carries the previous award
                    into a performance-based raise path; neither input controls
                    the estimate by itself.
                  </p>
                )}
                {selected.kind === "mlb" &&
                  settings.valuationView === "deadline" &&
                  settings.deadlineBoost > 0 && (
                  <div className="deadline-value-card">
                    <div>
                      <span>July deadline scenario</span>
                      <strong>
                        {money(values[selected.id]?.deadlineAdjustment ?? 0)} added
                      </strong>
                    </div>
                    <b>
                      +{shortNumber(settings.deadlineBoost)}% current wins
                      {(values[selected.id]?.octoberAdjustment ?? 0) > 0
                        ? ` · ${money(values[selected.id]?.octoberAdjustment ?? 0)} October rotation value`
                        : ""}
                    </b>
                    <small>
                      Baseline {money(
                        (values[selected.id]?.total ?? 0) -
                          (values[selected.id]?.deadlineAdjustment ?? 0),
                      )} → deadline {money(values[selected.id]?.total ?? 0)}.
                      This represents extra willingness to pay for current wins,
                      not the buyer&apos;s negotiating power.
                      {(values[selected.id]?.octoberAdjustment ?? 0) > 0
                        ? ` ${money(values[selected.id]?.deadlineCurrentWinAdjustment ?? 0)} comes from the general deadline market and ${money(values[selected.id]?.octoberAdjustment ?? 0)} from concentrated playoff usage above a ${shortNumber(settings.postseasonStarterBaselineWar)}-WAR net rotation benchmark.`
                        : ""} Salary, future control, and option costs are unchanged.
                    </small>
                  </div>
                )}
                {selected.kind === "mlb" ? (
                  <>
                    {selected.contractScenario && (
                      <div className="contract-scenario">
                        <label>
                          <span>Contract path</span>
                          <select
                            value={selected.contractScenario.selectedId}
                            onChange={(event) =>
                              updatePlayer(selected.id, (player) =>
                                player.kind === "mlb" &&
                                player.contractScenario
                                  ? {
                                      ...player,
                                      contractScenario: {
                                        ...player.contractScenario,
                                        selectedId: event.target.value,
                                      },
                                    }
                                  : player,
                              )
                            }
                          >
                            {selected.contractScenario.options.map((option) => (
                              <option key={option.id} value={option.id}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <p>
                          {
                            selected.contractScenario.options.find(
                              (option) =>
                                option.id ===
                                selected.contractScenario?.selectedId,
                            )?.description
                          }
                        </p>
                        <small>{selected.contractScenario.note}</small>
                      </div>
                    )}
                    <div className="risk-field">
                      <label htmlFor="risk">
                        Player uncertainty <strong>{selected.risk} points</strong>
                      </label>
                      <input
                        id="risk"
                        type="range"
                        min="0"
                        max="40"
                        value={selected.risk}
                        onChange={(event) =>
                          updatePlayer(selected.id, (player) =>
                            player.kind === "mlb"
                              ? { ...player, risk: Number(event.target.value) }
                              : player,
                          )
                        }
                      />
                      <small>
                        Two points add one percentage point to each side of the
                        value range. This changes the range, never the
                        midpoint.
                      </small>
                    </div>
                    <div className="projection-title">
                      <div>
                        <span>fWAR by control year</span>
                        <small>
                          2026 is July-snapshot Depth Charts RoS; future ZiPS carries
                          that snapshot&apos;s role-aware ZiPS signal.
                        </small>
                      </div>
                      <button
                        onClick={() => addMlbSeason(selected.id)}
                      >
                        + Year
                      </button>
                    </div>
                    {selected.talentUpdate &&
                      selectedSeasons.some(
                        (season) =>
                          season.projectionBaselineWar !== undefined,
                      ) && (
                        <div className="talent-update-card">
                          <div className="talent-update-head">
                            <div>
                              <span>In-season talent bridge</span>
                              <strong>
                                {selected.talentUpdate.rateChange === null
                                  ? "Hitting + pitching updated separately"
                                  : `${signedWar(selected.talentUpdate.rateChange)} fWAR / ${selected.talentUpdate.unitLabel}`}
                              </strong>
                            </div>
                            <small>Not season-to-date WAR</small>
                          </div>
                          <p>
                            The model carries forward the change in projected
                            talent rate—not the wins already produced.
                          </p>
                          <div className="talent-update-years">
                            {selectedSeasons
                              .filter(
                                (season) =>
                                  season.projectionBaselineWar !== undefined,
                              )
                              .slice(0, 3)
                              .map((season) => {
                                const baseline =
                                  season.projectionBaselineWar ?? season.war;
                                const adjustment =
                                  season.inSeasonAdjustment ?? 0;
                                return (
                                  <div key={season.year}>
                                    <span>{season.year}</span>
                                    <b>{baseline.toFixed(1)} ZiPS</b>
                                    <i>{signedWar(adjustment)} update</i>
                                    <strong>
                                      {(baseline + adjustment).toFixed(1)} fWAR
                                    </strong>
                                  </div>
                                );
                              })}
                          </div>
                          <details>
                            <summary>How was this adjustment built?</summary>
                            <p>
                              Snapshot ZiPS RoS rate is compared with preseason
                              ZiPS. For hitters, an opposing change in projected
                              defense or role is damped when it would overwhelm
                              the offensive update. The result is applied to the
                              future workload, 50% is carried into next season,
                              and that signal decays by 15% per additional year.
                            </p>
                            <div className="talent-provider-list">
                              {selected.talentUpdate.providers.map(
                                (provider) => (
                                  <div key={provider.name}>
                                    <span>{provider.name}</span>
                                    <strong>
                                      {provider.baselineRate.toFixed(1)} →{" "}
                                      {provider.updatedRate.toFixed(1)}
                                    </strong>
                                    <small>
                                      fWAR / {provider.unitLabel} ·{" "}
                                      {signedWar(provider.changeRate)}
                                    </small>
                                    {provider.roleGuarded && (
                                      <small>
                                        Role/defense swing damped · raw{" "}
                                        {signedWar(
                                          provider.rawChangeRate ??
                                            provider.changeRate,
                                        )}
                                      </small>
                                    )}
                                  </div>
                                ),
                              )}
                            </div>
                            {selected.talentUpdate.capped && (
                              <p>
                                A safety cap limited an extreme rate change;
                                the editable fWAR fields remain available for a
                                different judgment.
                              </p>
                            )}
                          </details>
                          {selectedAdjusted && (
                            <small>
                              This is the source breakdown; your edited fWAR is
                              what this snapshot&apos;s trade value uses.
                            </small>
                          )}
                        </div>
                      )}
                    {selected.agingModel &&
                      selectedSeasons.some(
                        (season) => season.year > selected.agingModel!.anchorYear,
                      ) && (
                        <div className="talent-update-card">
                          <div className="talent-update-head">
                            <div>
                              <span>Long-range aging</span>
                              <strong>
                                ZiPS anchored · {selected.agingModel.profile}
                              </strong>
                            </div>
                            <small>
                              Starts after {selected.agingModel.anchorYear}
                            </small>
                          </div>
                          <p>
                            Direct ZiPS seasons stay unchanged. Later years age
                            projected production rate and playing time
                            separately, using a capped portion of ZiPS&apos;s recent
                            player-specific slope plus a nonlinear age and role
                            curve.
                          </p>
                          <details>
                            <summary>What is player-specific here?</summary>
                            <p>
                              {selected.agingModel.profile === "two-way"
                                ? "Hitting and pitching are aged separately with their own ZiPS rates, workloads, and role curves, then recombined."
                                : `The model reads the change between the last two ZiPS seasons in both fWAR per ${selected.agingModel.unitLabel}${selected.agingModel.rateTrend === null ? "" : ` (${signedWar(selected.agingModel.rateTrend)})`}${selected.agingModel.workloadRetention === null ? "." : ` and projected workload (${Math.round(selected.agingModel.workloadRetention * 100)}% retained).`}`}
                              {" "}That signal receives 35% weight in the first
                              added year and fades quickly. The population
                              curve carries the rest, steepening in the
                              mid-to-late 30s and distinguishing position
                              players, starters, and relievers.
                            </p>
                          </details>
                        </div>
                      )}
                    <div className="projection-table">
                      <div className="projection-row projection-head">
                        <span>Year</span>
                        <span>fWAR</span>
                        <span>Pay type</span>
                        <span>Salary</span>
                        <span>Surplus</span>
                      </div>
                      {selectedSeasons.map((season, index) => {
                        const row = values[selected.id]?.rows[index];
                        return (
                          <div
                            className={`projection-row${row?.excluded ? " is-excluded" : ""}${row?.optedOut ? " is-opted-out" : ""}`}
                            key={`${season.year}-${index}`}
                          >
                            <NumericField
                              label="Year"
                              value={season.year}
                              step={1}
                              min={BASE_YEAR}
                              onChange={(value) =>
                                updateMlbSeasonAt(
                                  selected.id,
                                  index,
                                  (item) => ({ ...item, year: value }),
                                )
                              }
                            />
                            <NumericField
                              label="Projected fWAR"
                              value={season.war}
                              onChange={(value) =>
                                updateMlbSeasonAt(
                                  selected.id,
                                  index,
                                  (item) => ({ ...item, war: value }),
                                )
                              }
                            />
                            <select
                              aria-label="Salary type"
                              value={season.contractType ?? season.salaryMode}
                              onChange={(event) =>
                                updateMlbSeasonAt(
                                  selected.id,
                                  index,
                                  (item) => ({
                                    ...item,
                                    salaryMode: event.target
                                      .value as SalaryMode,
                                    contractType: event.target
                                      .value as SalaryMode,
                                  }),
                                )
                              }
                            >
                              <option value="fixed">Fixed</option>
                              <option value="prearb">Pre-arb</option>
                              <option value="arb1">Arb 1</option>
                              <option value="arb2">Arb 2</option>
                              <option value="arb3">Arb 3</option>
                              <option value="arb4">Arb 4</option>
                              <option value="clubOption">Club option</option>
                              <option value="playerOption">
                                Player option
                              </option>
                              <option value="mutualOption">
                                Mutual option
                              </option>
                              <option value="vestingOption">
                                Vesting option
                              </option>
                            </select>
                            {season.salaryMode === "fixed" ||
                            season.salaryMode.endsWith("Option") ? (
                              <span className="salary-input-wrap">
                                <NumericField
                                  label="Salary in millions"
                                  value={season.salary}
                                  min={0}
                                  onChange={(value) =>
                                    updateMlbSeasonAt(
                                      selected.id,
                                      index,
                                      (item) => ({ ...item, salary: value }),
                                    )
                                  }
                                />
                                {!!season.expectedIncentives && (
                                  <small>
                                    incl. {money(season.expectedIncentives)} expected
                                  </small>
                                )}
                              </span>
                            ) : (
                              <span className="modelled-pay">
                                <strong>
                                  {money(row?.salary ?? 0)}
                                  {season.salaryMode.startsWith("arb") && (
                                    <em
                                      className="est-tag"
                                      title={ARB_ESTIMATE_NOTE}
                                    >
                                      {" "}
                                      est.
                                    </em>
                                  )}
                                </strong>
                                <small>
                                  {season.salaryMode === "arb1"
                                    ? "platform stats"
                                    : season.salaryMode.startsWith("arb")
                                      ? "platform + prior pay"
                                      : "league minimum"}
                                </small>
                              </span>
                            )}
                            <strong>
                              {row?.excluded
                                ? "Excluded"
                                : row?.optedOut
                                  ? "Opted out"
                                  : money(row?.surplus ?? 0)}
                            </strong>
                            {(row?.excluded ||
                              row?.optedOut ||
                              row?.extrapolated) && (
                              <small className="row-flag">
                                {row?.excluded
                                  ? `Excluded in the offseason view: rest of ${season.year} (would add ${money(row.excludedSurplus ?? 0)})`
                                  : row?.optedOut
                                    ? "Player option settled as opted out: counts as zero"
                                    : "Extrapolated (aging model)"}
                                {row?.excluded || row?.optedOut
                                  ? row?.extrapolated
                                    ? " · Extrapolated (aging model)"
                                    : ""
                                  : ""}
                              </small>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <div className="math-box">
                      <span>Projected surplus</span>
                      <strong>{money(values[selected.id]?.total ?? 0)}</strong>
                      <p>
                        Range {money(values[selected.id]?.low ?? 0)}–
                        {money(values[selected.id]?.high ?? 0)}
                      </p>
                      {!!values[selected.id]?.horizonRisk && (
                        <small>
                          Includes {values[selected.id]?.horizonRisk?.toFixed(0)}%
                          extra long-range uncertainty
                        </small>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="form-grid two-col prospect-fields">
                      <label>
                        <span>FanGraphs FV</span>
                        <select
                          value={selected.fv}
                          onChange={(event) =>
                            updatePlayer(selected.id, (player) =>
                              player.kind === "prospect"
                                ? { ...player, fv: event.target.value }
                                : player,
                            )
                          }
                        >
                          {Object.keys(prospectValues).map((fv) => (
                            <option key={fv}>{fv}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <span>Player type</span>
                        <select
                          value={selected.prospectType}
                          onChange={(event) =>
                            updatePlayer(selected.id, (player) =>
                              player.kind === "prospect"
                                ? {
                                    ...player,
                                    prospectType: event.target
                                      .value as ProspectType,
                                  }
                                : player,
                            )
                          }
                        >
                          <option>Hitter</option>
                          <option>Pitcher</option>
                        </select>
                      </label>
                      <label>
                        <span>MLB ETA</span>
                        <NumericField
                          label="ETA"
                          value={selected.eta}
                          step={1}
                          min={BASE_YEAR}
                          onChange={(value) =>
                            updatePlayer(selected.id, (player) =>
                              player.kind === "prospect"
                                ? { ...player, eta: value }
                                : player,
                            )
                          }
                        />
                      </label>
                      <label>
                        <span>Scouting risk</span>
                        <select
                          value={
                            selected.riskLabel?.toLowerCase().startsWith("low")
                              ? "Low"
                              : selected.riskLabel
                                    ?.toLowerCase()
                                    .startsWith("high")
                                ? "High"
                                : "Med"
                          }
                          onChange={(event) =>
                            updatePlayer(selected.id, (player) =>
                              player.kind === "prospect"
                                ? { ...player, riskLabel: event.target.value }
                                : player,
                            )
                          }
                        >
                          <option value="Low">Low</option>
                          <option value="Med">Medium</option>
                          <option value="High">High</option>
                        </select>
                        <small>Changes the range, not the FV median.</small>
                      </label>
                      <label>
                        <span>Scout adjustment</span>
                        <span className="percent-field">
                          <NumericField
                            label="Scout adjustment"
                            value={selected.adjustment}
                            step={1}
                            onChange={(value) =>
                              updatePlayer(selected.id, (player) =>
                                player.kind === "prospect"
                                  ? { ...player, adjustment: value }
                                  : player,
                              )
                            }
                          />
                          %
                        </span>
                      </label>
                      <label className="wide-field">
                        <span>Roster situation</span>
                        <select
                          value={selected.rosterContext ?? "none"}
                          onChange={(event) =>
                            updatePlayer(selected.id, (player) =>
                              player.kind === "prospect"
                                ? {
                                    ...player,
                                    rosterContext: event.target
                                      .value as ProspectRosterContext,
                                  }
                                : player,
                            )
                          }
                        >
                          <option value="none">No roster adjustment</option>
                          <option value="rule5">
                            Rule 5 decision soon · −15%
                          </option>
                          <option value="on40">
                            40-man spot before ETA · −10%
                          </option>
                          <option value="crunch">
                            Acute organization crunch · −40%
                          </option>
                        </select>
                        <small>
                          Seeded from signing year and option status. This changes
                          leverage, not the scouting grade.
                        </small>
                      </label>
                    </div>
                    <div className="prospect-output">
                      <div>
                        <span>Expected surplus</span>
                        <strong>
                          {money(values[selected.id]?.total ?? 0)}
                        </strong>
                      </div>
                      <div>
                        <span>Control WAR</span>
                        <strong>
                          {values[selected.id]?.expectedWar?.toFixed(1)}
                        </strong>
                      </div>
                      <div>
                        <span>Star odds</span>
                        <strong>
                          {values[selected.id]?.starOdds?.toFixed(1)}%
                        </strong>
                      </div>
                    </div>
                    <p className="prospect-range-note">
                      {selected.riskLabel ?? "Medium"} scouting risk · range{" "}
                      {money(values[selected.id]?.low ?? 0)}–
                      {money(values[selected.id]?.high ?? 0)}
                      {values[selected.id]?.rangeUncertainty
                        ? ` · ±${values[selected.id]?.rangeUncertainty?.toFixed(0)}%`
                        : ""}
                      {values[selected.id]?.prospectRankAdjustment
                        ? ` · Board rank ${signedPercent(values[selected.id]?.prospectRankAdjustment ?? 0)}`
                        : ""}
                    </p>
                  </>
                )}
                </details>
              </>
            ) : (
              <div className="editor-empty">
                <span className="brand-ball" />
                <h2>Select a player</h2>
                <p>
                  Open a player card to audit and edit its valuation
                  assumptions.
                </p>
              </div>
            )}
          </aside>
        </section>
        <section className="audit-panel" aria-labelledby="audit-title">
          <div className="audit-head">
            <div>
              <span>Audit trail</span>
              <h2 id="audit-title">Changes from baseline</h2>
            </div>
            <button
              type="button"
              className="csv-button"
              onClick={downloadCsv}
              disabled={!hasPlayers}
            >
              Download CSV
            </button>
          </div>
          {baselineChanges.length ? (
            <ul className="audit-list">
              {baselineChanges.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : (
            <p className="audit-none">
              No changes. Settings and players match the defaults.
            </p>
          )}
          <small>
            The CSV has one row per player-season for the players in the trade
            above. Its header records the snapshot date, valuation view,
            settings and model version.
          </small>
        </section>
          </>
        ) : activeTab === "discover" ? (
          renderDiscovery()
        ) : activeTab === "projections" ? (
          <section
            className="projections-panel"
            aria-label="July 2026 three-year player projection snapshot"
          >
            <div className="rankings-heading projections-heading">
              <div>
                <span>2026–2028 forecast board</span>
                <h2>Three-year projection snapshot</h2>
                <p>
                  2026 is FanGraphs Depth Charts rest-of-season fWAR. The 2027
                  and 2028 columns begin with published ZiPS, then carry forward
                  a conservative, role-aware share of the ZiPS in-season talent
                  change. Exception: for the 50 players in FanGraphs’ 2026
                  Trade Value Series, 2027–31 use that series’ published ZiPS
                  as-is, with no Dugout Value adjustment.
                </p>
                <Link
                  className="tool-article-link"
                  href="/analysis/when-a-better-fit-isnt-a-better-forecast"
                >
                  How the projections adjust ZiPS, and the test that failed →
                </Link>
              </div>
              <strong>
                {projectedPlayers.length}{" "}
                {projectedPlayers.length === 1 ? "player" : "players"}
              </strong>
            </div>
            <div className="projection-board-note">
              <div>
                <span>What the small line means</span>
                <strong>Published ZiPS baseline + rolling update</strong>
              </div>
              <p>
                This is a projection table, not a value ranking. Salary,
                service time, roster-spot allowance, and contract control are
                not part of these fWAR totals.
              </p>
            </div>
            <div className="projection-filters">
              <label>
                <span>Find a player</span>
                <input
                  value={projectionSearch}
                  onChange={(event) => {
                    setProjectionSearch(event.target.value);
                    setProjectionVisible(PROJECTION_PAGE);
                  }}
                  placeholder="Name, team, or position…"
                />
              </label>
              <label>
                <span>Team</span>
                <select
                  value={projectionTeam}
                  onChange={(event) => {
                    setProjectionTeam(event.target.value);
                    setProjectionVisible(PROJECTION_PAGE);
                  }}
                >
                  <option value="ALL">All teams</option>
                  {database.teams.map((team) => (
                    <option value={team.abbr} key={team.abbr}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Role</span>
                <select
                  value={projectionRole}
                  onChange={(event) => {
                    setProjectionRole(
                      event.target.value as ProjectionRoleFilter,
                    );
                    setProjectionVisible(PROJECTION_PAGE);
                  }}
                >
                  <option value="all">All roles</option>
                  <option value="position">Position players</option>
                  <option value="starter">Starting pitchers</option>
                  <option value="reliever">Relief pitchers</option>
                  <option value="two-way">Two-way players</option>
                </select>
              </label>
              <label>
                <span>Sort by</span>
                <select
                  value={projectionSort}
                  onChange={(event) => {
                    setProjectionSort(event.target.value as ProjectionSort);
                    setProjectionVisible(PROJECTION_PAGE);
                  }}
                >
                  <option value="total">2026–28 total fWAR</option>
                  <option value="2026">2026 RoS fWAR</option>
                  <option value="2027">2027 fWAR</option>
                  <option value="2028">2028 fWAR</option>
                  <option value="change">Largest in-season risers</option>
                  <option value="name">Player name</option>
                </select>
              </label>
            </div>
            <div className="three-year-table-wrap" tabIndex={0} aria-label="Scrollable three-year projection table">
              <div className="three-year-table">
                <div className="three-year-row three-year-head">
                  <span>Player</span>
                  <span>2026 RoS</span>
                  <span>2027</span>
                  <span>2028</span>
                  <span>2026–28</span>
                  <span>Talent signal</span>
                  <span />
                </div>
                {projectedPlayers.slice(0, projectionVisible).map(
                  ({ player, seasons, total, change }) => (
                    <article className="three-year-row" key={player.id}>
                      <div className="projection-player">
                        <strong>{player.name}</strong>
                        <small>
                          {teamName(player.team)} · {displayPosition(player)} ·
                          Age {player.age}
                        </small>
                      </div>
                      {PROJECTION_YEARS.map((year) => {
                        const season = seasons[year];
                        const adjustment = season?.inSeasonAdjustment ?? 0;
                        return (
                          <div className="projection-war-cell" key={year}>
                            <strong>{season?.war.toFixed(1) ?? "—"}</strong>
                            {year === BASE_YEAR ? (
                              <small>Depth Charts RoS</small>
                            ) : player.futureProjectionUpdate ? (
                              <small>July ZiPS</small>
                            ) : (
                              <small>
                                {season?.projectionBaselineWar?.toFixed(1) ??
                                  "—"}{" "}
                                ZiPS · {signedWar(adjustment)}
                              </small>
                            )}
                          </div>
                        );
                      })}
                      <strong className="projection-total">
                        {total.toFixed(1)}
                        <small>fWAR</small>
                      </strong>
                      <div
                        className={`projection-signal ${change > 0 ? "positive" : change < 0 ? "negative" : ""}`}
                      >
                        <strong>
                          {player.futureProjectionUpdate
                            ? "Official ZiPS"
                            : player.talentUpdate?.rateChange === null
                            ? "Split update"
                            : player.talentUpdate
                              ? `${signedWar(player.talentUpdate.rateChange)} / ${player.talentUpdate.unitLabel}`
                              : "No update"}
                        </strong>
                        <small>
                          {player.futureProjectionUpdate
                            ? `FanGraphs Trade Value #${player.futureProjectionUpdate.rank}`
                            : change === 0
                            ? "future curve unchanged"
                            : `${signedWar(change)} WAR across 2027–28`}
                        </small>
                      </div>
                      <button
                        type="button"
                        onClick={() => openPlayerEditor(player.id, "projections")}
                      >
                        Why this value
                      </button>
                    </article>
                  ),
                )}
                {!projectedPlayers.length && (
                  <p className="ranking-empty">
                    No players match those projection filters.
                  </p>
                )}
              </div>
            </div>
            {projectedPlayers.length > 0 && (
              <div className="show-more-row">
                <p role="status">
                  {projectedPlayers.length > projectionVisible
                    ? `Showing ${projectionVisible} of ${projectedPlayers.length.toLocaleString("en-US")} players`
                    : `Showing all ${projectedPlayers.length.toLocaleString("en-US")} ${projectedPlayers.length === 1 ? "player" : "players"}`}
                </p>
                {projectedPlayers.length > projectionVisible && (
                  <button
                    type="button"
                    onClick={() =>
                      setProjectionVisible((count) => count + PROJECTION_PAGE)
                    }
                  >
                    Show {PROJECTION_PAGE} more
                  </button>
                )}
              </div>
            )}
          </section>
        ) : (
          <section
            className="rankings-panel"
            aria-label="Value rankings"
          >
            <div className="rankings-heading">
              <div>
                <span>Leaguewide board</span>
                <h2>Top 100 by surplus value</h2>
                <p>
                  Model value, not a consensus list. Stars on market-rate deals
                  rank low here by design: their salary absorbs most of their
                  projected value.{" "}
                  {settings.valuationView === "offseason"
                    ? `Values count ${BASE_YEAR + 1} on and `
                    : `Values include the rest of ${BASE_YEAR} and `}
                  {settings.timingPreference === 0
                    ? "do not discount future seasons"
                    : `discount future seasons ${settings.timingPreference}% a year`}
                  {settings.valuationView === "offseason"
                    ? "; pending free agents are left out."
                    : "."}
                </p>
                <Link
                  className="tool-article-link"
                  href="/analysis/what-trade-value-measures"
                >
                  What the board measures →
                </Link>
              </div>
              <strong>Top 100</strong>
            </div>
            <div className="ranking-filters">
              <label>
                <span>Find a player</span>
                <input
                  value={rankingSearch}
                  onChange={(event) => setRankingSearch(event.target.value)}
                  placeholder="Name, position, or FV…"
                />
              </label>
              <label>
                <span>Organization</span>
                <select
                  value={rankingTeam}
                  onChange={(event) => setRankingTeam(event.target.value)}
                >
                  <option value="ALL">All organizations</option>
                  {database.teams.map((team) => (
                    <option value={team.abbr} key={team.abbr}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="ranking-type" aria-label="Player type">
                <span>Player type</span>
                <div>
                  {(["all", "mlb", "prospect"] as const).map((type) => (
                    <button
                      type="button"
                      key={type}
                      className={rankingType === type ? "is-active" : ""}
                      onClick={() => setRankingType(type)}
                    >
                      {type === "all"
                        ? "All"
                        : type === "mlb"
                          ? "MLB"
                          : "Prospects"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="ranking-list" tabIndex={0} aria-label="Scrollable player value rankings">
              <div className="ranking-row ranking-head">
                <span>Rank</span>
                <span>Player</span>
                <span>Type</span>
                <span>Range</span>
                <span>Surplus value</span>
                <span />
              </div>
              {rankedPlayers.map((player, index) => {
                const result = values[player.id];
                const basisLabel = valuationBasisLabel(result);
                const extrapolatedShare = result?.extrapolatedShare ?? 0;
                return (
                  <article className="ranking-row" key={player.id}>
                    <strong className="ranking-number">{index + 1}</strong>
                    <div className="ranking-player">
                      <strong>{player.name}</strong>
                      <small>
                        {teamName(player.team)} · {displayPosition(player)} · Age{" "}
                        {player.age}
                        {player.kind === "prospect" && rosterContextLabel(player)
                          ? ` · ${rosterContextLabel(player)}`
                          : ""}
                        {player.kind === "mlb" &&
                        player.tradeProtection &&
                        player.tradeProtection !== "none"
                          ? ` · ${tradeProtectionLabel(player)}`
                          : ""}
                        {player.kind === "mlb" && player.availability
                          ? ` · ${player.availability.status} on July 31`
                          : ""}
                      </small>
                      <small className="ranking-drivers">
                        {player.kind === "mlb" &&
                        result?.clubControlThrough != null &&
                        result.clubControlWar != null &&
                        result.clubControlSalary != null
                          ? `${contractLabel(player, result)} · ${result.clubControlWar.toFixed(1)} fWAR · ${money(result.clubControlSalary)} salary`
                          : player.kind === "prospect"
                            ? `ETA ${player.eta} · ${(result?.expectedWar ?? 0).toFixed(1)} expected fWAR`
                            : ""}
                      </small>
                      {(result?.fgTradeValueRank ||
                        extrapolatedShare > 0.2 ||
                        basisLabel) && (
                        <span className="ranking-tags">
                          {result?.fgTradeValueRank ? (
                            <b
                              className="fg-chip"
                              title="Rank in FanGraphs’ 2026 Trade Value Series"
                            >
                              FG TV #{result.fgTradeValueRank}
                            </b>
                          ) : null}
                          {extrapolatedShare > 0.2 ? (
                            <em
                              className="extrapolated-note"
                              title={`${Math.round(extrapolatedShare * 100)}% of this value comes from seasons after ${(player.kind === "mlb" && player.agingModel?.anchorYear) || "the last published ZiPS season"}, which the aging model extends`}
                            >
                              extrapolated {Math.round(extrapolatedShare * 100)}%
                            </em>
                          ) : null}
                          {basisLabel ? (
                            <em className="basis-note">{basisLabel}</em>
                          ) : null}
                        </span>
                      )}
                    </div>
                    <span className={`type-pill ${player.kind}`}>
                      {player.kind === "prospect" ? `${player.fv} FV` : "MLB"}
                    </span>
                    <span className="ranking-range">
                      {rangeText(result?.low ?? 0, result?.high ?? 0)}
                    </span>
                    <strong className="ranking-value">
                      {money(result?.total ?? 0)}
                    </strong>
                    <button
                      type="button"
                      onClick={() => openPlayerEditor(player.id, "rankings")}
                    >
                      Why this value
                    </button>
                  </article>
                );
              })}
              {!rankedPlayers.length && (
                <p className="ranking-empty">No players match those filters.</p>
              )}
            </div>
          </section>
        )}

        {showMethod && (
          <section
            className="methodology"
            id="methodology"
            tabIndex={-1}
          >
            <div className="method-article">
              <header className="method-hero">
                <div>
                  <span className="method-kicker">Dugout Value methodology</span>
                  <h2>So what is a baseball player actually worth?</h2>
                  <p className="method-deck">
                    In this model, a player is worth the wins he’ll produce,
                    priced at what wins cost in free agency, minus what he’ll be
                    paid, added up over the years his team controls him. That’s
                    why Francisco Lindor, a star on a $32-million-a-year deal,
                    rates near zero, and why a 2026 rookie like Kevin McGonigle
                    rates first (offseason view, default settings).
                  </p>
                  <p className="method-byline">
                    Model snapshot · {(
                      database.meta.mlbCount + database.meta.prospectCount
                    ).toLocaleString()} players · Data as of {prettyDate(database.meta.refreshed)}
                  </p>
                </div>
                <div className="method-hero-actions">
                  <button type="button" onClick={() => setShowMethod(false)}>
                    Back to the tool
                  </button>
                  <a href="/methods">Full methods and data →</a>
                </div>
              </header>

              <div className="method-short-version">
                <span>The short version</span>
                <p>
                  <strong>Surplus value is expected on-field value minus expected cost.</strong>{" "}
                  Dugout Value estimates that surplus for every year of club
                  control, then shows a range around the answer because
                  projections, health, development, and contracts are never
                  certain.
                </p>
              </div>

              <div className="method-layout">
                <article className="method-story">
                  <section>
                    <span className="method-step">01 · The basic idea</span>
                    <h3>Surplus value, not player quality</h3>
                    <p>
                      A five-win player on a market salary helps his team plenty
                      and is worth little in trade. A three-win player near the
                      league minimum can be worth a fortune. Dugout Value works
                      one control year at a time: estimate the wins,
                      convert them to a public-market price, subtract the salary
                      obligation, and add the seasons together.
                    </p>
                    <div className="method-formula">
                      <span>For each control year</span>
                      <strong>Market value of projected fWAR − expected salary = surplus value</strong>
                    </div>
                    <p>
                      The result is stated in millions of dollars so contracts,
                      prospects, and cash considerations can share one scale. It
                      is a comparison tool—not a prediction of the exact return a
                      general manager will accept.
                    </p>
                    <p>
                      Two defaults shape every number. The offseason view counts
                      2027 onward and excludes the rest of 2026, whose regular
                      season is over; the July 31 deadline view adds it back. And each later
                      season is discounted 10% a year, FanGraphs’ rate, counted
                      from 2026, so 2027 is already divided by 1.10. A player
                      with no club control after 2026 is a pending free agent,
                      worth $0 and left out of the rankings. Both defaults are
                      settings, and the discount can go to 0%.
                    </p>
                  </section>

                  <section>
                    <span className="method-step">02 · Projecting major leaguers</span>
                    <h3>Start with ZiPS, then update it for this season</h3>
                    <p>
                      In the July 31 deadline view, 2026 uses FanGraphs Depth Charts
                      rest-of-season fWAR and only the unpaid portion of the
                      current salary. Depth Charts combines ZiPS and Steamer
                      talent estimates with playing time set by FanGraphs staff.
                      That keeps wins already banked and salary already paid out
                      of the valuation. The offseason view drops that season and
                      starts at 2027.
                    </p>
                    <div className="risk-explainer">
                      <span>How does this season change 2027 and beyond?</span>
                      <strong>Update the estimate of talent, not the ledger of wins.</strong>
                      <p>
                        Exception: for the 50 players in FanGraphs’ 2026 Trade
                        Value Series, 2027–31 use that series’ published ZiPS
                        as-is, with no Dugout Value adjustment. Everything else
                        in this box applies to the other players.
                      </p>
                      <p>
                        The future curve begins with the published ZiPS 2027
                        and 2028 forecasts. For each player, Dugout Value
                        compares ZiPS RoS with preseason ZiPS after normalizing
                        both to 600 PA, 180 starter innings, or 65 relief
                        innings. That measures how ZiPS itself has changed its
                        view of the player. A tiny RoS workload is discarded so
                        a season-ending injury cannot look like a collapse in
                        true talent.
                      </p>
                      <p>
                        If a pitcher&apos;s ZiPS role changes between starting and
                        relieving, no custom bridge is applied. WAR per inning
                        is not directly comparable across those roles, so the
                        published future ZiPS forecast is the safer estimate.
                      </p>
                      <p>
                        For hitters, the bridge also separates the offensive
                        change from the rest of the WAR change. If offense moves
                        one way but a larger defense or positional-role change
                        moves the other way, the contradictory non-offensive
                        portion receives half weight. This keeps a shift between
                        catcher, first base, and DH usage from masquerading as a
                        major change in hitting talent. Otherwise the full ZiPS
                        signal is used.
                      </p>
                      <p>
                        The bridge carries 50% of the resulting change into the
                        next season and 85% of the remaining signal into each
                        later year. ZiPS has already decided how much to learn
                        from strikeouts, walks, contact quality, velocity,
                        defense, and other inputs, so raw season-to-date WAR is
                        never added to a future forecast.
                      </p>
                    </div>
                    <p>
                      The 50% bridge and 15% annual decay are calibration
                      choices, not official ZiPS settings. In a 2025 holdout,
                      the role-aware 50% version cut following-season error (RMSE)
                      1.4% against published ZiPS, with an interval running from about
                      0.8% worse to 3.6% better, so 50% is a conservative choice,
                      not a demonstrated optimum. It limits the risk of
                      permanently carrying a short-term role, health, or
                      defensive signal across an entire contract. The test, and
                      the ridge correction that failed it, are written up in{" "}
                      <Link href="/analysis/when-a-better-fit-isnt-a-better-forecast">
                        A midseason fix for ZiPS made next year’s forecasts worse
                      </Link>.{" "}
                      The player card shows the published ZiPS baseline, the
                      ZiPS rate change, any role guard, the adjustment, and the
                      final fWAR.
                      Two-way players are updated separately as hitters and
                      pitchers before the values are combined.
                    </p>
                    <div className="risk-explainer">
                      <span>How are years beyond public ZiPS aged?</span>
                      <strong>Follow the player&apos;s ZiPS shape, then fade toward an empirical curve.</strong>
                      <p>
                        Published ZiPS is the baseline: 2027–28 for most players,
                        adjusted by the bridge above, and 2027–31 as published
                        for players in FanGraphs’ Trade Value Series. For later
                        contract years, the model converts the final two
                        ZiPS seasons to a common rate: 600 PA for position
                        players, 180 innings for starters, or 65 innings for
                        relievers. It gives 35% weight to that capped,
                        player-specific rate trend in the first added season;
                        the weight then falls by 40% each year.
                      </p>
                      <p>
                        The remaining weight comes from a recent empirical age
                        curve. Production and workload decline separately, the
                        decline becomes gradually steeper after age 35, and
                        catchers and up-the-middle defenders receive a modest
                        extra rate adjustment. This avoids both a sudden aging
                        cliff and the old flat subtraction that treated every
                        hitter and pitcher alike.
                      </p>
                      <p>
                        The curve is intentionally conservative about player
                        typing. ZiPS already builds individualized curves from
                        historical comparables, so Dugout Value uses ZiPS&apos;s
                        own projected slope rather than inventing a scouting
                        category from one season of results. If no second ZiPS
                        season is available, the role-and-age curve carries the
                        forecast by itself. The tools mark every season past the
                        last published ZiPS year as extrapolated: it comes from
                        this curve, not from a published projection.
                      </p>
                    </div>
                    <p>
                      Not every fraction of a win is scarce. The default model
                      treats 0.5 WAR for a position player or starter—and 0.2 WAR
                      for a reliever—as the annual roster-spot allowance. That
                      is the value a club should be able to find simply by using
                      the roster spot. For a partial season, the allowance is
                      scaled to the time remaining.
                    </p>
                    <p>
                      Wins above that allowance are priced at $12 million per
                      WAR. The first two net wins use that base price; each
                      additional win is priced 30% higher, at $15.6 million.
                      Because the roster-spot allowance comes first, the default
                      premium begins at 2.5 projected WAR for a full-season
                      position player or starter—not at 2.0 raw WAR. The cutoff
                      is prorated along with the allowance for the rest of 2026.
                    </p>
                    <div className="risk-explainer">
                      <span>Why a 30% premium after two net WAR?</span>
                      <strong>30% is a calibration choice, not a measured constant.</strong>
                      <p>
                        The premium applies only to the marginal wins above the
                        cutoff, which makes the price curve smooth, with no value
                        cliff. At default settings a 4-WAR season is priced about
                        14% above FanGraphs’ 2026 graduated scale ($47.4 million
                        against $41.5 million), and a 6-WAR season about 16%
                        above it ($78.6 million against $67.5 million). The
                        premium has not been estimated from 2024–26 free-agent
                        contracts.
                      </p>
                    </div>
                    <p>
                      Two net WAR is the default cutoff, equal to 2.5 raw WAR for
                      a full-season position player or starter. It rewards
                      clearly above-average regulars without labeling every
                      useful starter a star. Both the premium and its net-WAR
                      cutoff are editable. The default reliever premium is zero
                      because FanGraphs pitcher WAR already recognizes
                      leverage.
                    </p>
                    <div className="risk-explainer">
                      <span>What does the July deadline scenario do?</span>
                      <strong>It prices current wins and concentrated October roles, not the player&apos;s entire contract.</strong>
                      <p>
                        The July deadline scenario is off by default, and it works
                        only in the July 31 deadline view: the offseason view excludes the
                        rest of 2026, so there is nothing for it to change. When
                        it is on, a 15% scenario raises only the market value of
                        projected 2026 rest-of-season production. Remaining
                        salary, buyouts, future control years, and prospects do
                        not get multiplied. That avoids making an underwater
                        contract more negative or pretending a 2029 win is more
                        valuable because the trade happens in July 2026. The
                        scenario button in the assumptions panel turns it off in
                        one click.
                      </p>
                      <p>
                        A frontline starter also receives an October rotation
                        term. The model converts his rest-of-season projection
                        to a full-season WAR pace, subtracts a two-WAR net
                        playoff-rotation benchmark, and prices 25% of the
                        difference at the star-WAR rate. The two-WAR benchmark
                        represents the fourth starter an ace is most likely to
                        displace, with some of that pitcher&apos;s value retained in
                        a shorter bullpen role. It is not a claim that the
                        displaced pitcher disappears.
                      </p>
                      <p>
                        The 25% season equivalent is a calibration choice for
                        expected postseason workload plus the
                        extra leverage of short series. It is not a literal
                        innings forecast or a guarantee that the acquiring team
                        reaches October. Both inputs are editable, and the
                        player card separates this October term from the general
                        deadline adjustment.
                      </p>
                    </div>
                    <p>
                      Here, contention leverage means that one more win can be
                      especially useful to a team near the playoff bubble, which
                      can increase willingness to pay. It does not mean the buyer
                      has negotiating leverage. A buyer with several substitute
                      targets may bargain the price down; a seller with several
                      bidders may push it up. Because public history does not
                      support one stable league-wide percentage, 15% is an
                      editable scenario rather than a hidden model default.
                    </p>
                  </section>

                  <section>
                    <span className="method-step">03 · Contracts and arbitration</span>
                    <h3>Control is valuable only at the right price</h3>
                    <p>
                      Guaranteed salaries are taken from RosterResource. Club,
                      player, mutual, vesting, and injury-conditional options are
                      not treated as identical. A club option preserves upside
                      while limiting downside to its buyout. A player option does
                      the reverse. A mutual option is valued as its buyout unless
                      both sides have a realistic reason to exercise it, and a
                      vesting option is probability-weighted. Opt-outs remove
                      future club upside without pretending the player must leave
                      if the contract turns unfavorable.
                    </p>
                    <p>
                      Arbitration is modeled separately from the free-agent
                      market. First-year estimates use the traditional statistics
                      panels tend to reward: playing time, power, run production,
                      and steals for hitters; innings, starts, wins, ERA, and
                      strikeouts for starters; and appearances, saves, and holds
                      for relievers. For later years, the model re-estimates what
                      the player&apos;s latest platform season would earn, then compares it
                      with players at the same arbitration stage. For repeat
                      eligibles, a second estimate starts with the previous
                      salary and adds a role- and performance-based raise. The
                      final number blends those two views. That reflects both
                      same-service comparables and the CBA&apos;s explicit instruction
                      to consider past compensation, without blindly compounding
                      a fixed percentage. A poor platform year can still flatten
                      the salary, while a strong early award lifts the later path.
                      Fourth-award estimates remain less certain because only
                      Super Two players reach that stage. The 2027-and-later
                      estimates assume the current arbitration structure
                      continues; a new collective bargaining agreement could
                      change those rules and would require another recalibration.
                      Arbitration salaries are the model’s estimates. The tools
                      mark them as estimates, and the model’s error on them has
                      not been published.
                    </p>
                    <p>
                      Playing-time escalators are probability-weighted. Mutually
                      exclusive award bonuses are not stacked together. When a
                      contract has truly different future paths, the editor shows
                      one complete scenario at a time. Trade protection is shown
                      as a permission constraint, not buried as a value haircut.
                    </p>
                  </section>

                  <section>
                    <span className="method-step">04 · Prospects and recent graduates</span>
                    <h3>Let scouting speak where projections are weakest</h3>
                    <p>
                      Prospect values use FanGraphs’ July 2026 surplus-value table
                      by Future Value grade (
                      <a href="https://blogs.fangraphs.com/introducing-an-updated-method-for-prospect-valuation/">
                        Clemens, “Introducing an Updated Method for Prospect
                        Valuation”
                      </a>
                      ), with small adjustments for Board rank, roster status
                      and arrival. That table gives FanGraphs’ expected surplus
                      for each grade and prices wins on FanGraphs’ graduated
                      scale, which differs from the curve used for major
                      leaguers. It is already discounted at 10% a year, so the
                      tool does not discount it again: a prospect is worth the
                      same at a 0% and a 10% discount rate. FV remains the main
                      signal. Overall Board rank is used only as a small
                      tiebreaker within the same FV grade, ranging from +5% to
                      −5%; an ordinal list never overrules the scouting grade.
                    </p>
                    <p>
                      Roster pressure is kept separate from talent. The editable
                      scenarios apply a 15% Rule 5 adjustment, a 10% 40-man
                      adjustment, or a 40% severe-crunch adjustment. These
                      describe negotiating leverage and roster cost, not a claim
                      that the player became worse. At the default settings,
                      prospect ETA does not reduce the midpoint, but it does
                      widen the range.
                    </p>
                    <p>
                      Very young major leaguers can still be valued partly from
                      their most recent prospect grade. Projection-only, FV-only,
                      and blended views are available. In the blend, the scouting
                      share is capped at 80% and fades quickly as the report ages
                      and the player accumulates service time. This keeps one
                      quiet debut from instantly erasing years of scouting while
                      still allowing major-league performance to take over.
                    </p>
                  </section>

                  <section>
                    <span className="method-step">05 · Risk and ranges</span>
                    <h3>The midpoint is the estimate. The range is a stress test.</h3>
                    <p>
                      MLB ranges begin with 10% model uncertainty. Every two
                      player-risk points add one percentage point to each side of
                      the range. Long-dated control adds up to another 15 points,
                      based on how far into the future the surplus sits. Total MLB
                      uncertainty is capped at 45%.
                    </p>
                    <p>
                      These ranges are fixed allowances, not calibrated confidence
                      intervals. Their historical coverage has not been established,
                      and overlapping ranges do not establish that a trade is fair or likely.
                      Range width depends on role, injury status and how far out
                      the surplus sits. It does not yet depend on age, major
                      league experience or projection sample size, so ranges for
                      recent call-ups are too narrow.
                    </p>
                    <div className="risk-explainer">
                      <span>How to read the range</span>
                      <strong>The midpoint is the estimate. The low and high values show how far it moves under the model’s allowances.</strong>
                      <p>
                        Take a hypothetical $40 million midpoint with a ±25%
                        range. It appears as $30 million–$50 million. Increasing
                        player uncertainty widens those endpoints but leaves the
                        $40 million midpoint and the projected WAR unchanged. In the editor, two
                        player-uncertainty points add one percentage point to
                        each side of the range.
                      </p>
                    </div>
                    <p>
                      IL status in the July snapshot can add 4–14 of those risk points,
                      depending on the injured-list category and public language
                      such as surgery, no timetable, or a season-ending injury.
                      The adjustment widens the range only. Depth Charts RoS
                      already reflects expected missed 2026 playing time, so
                      cutting the midpoint projection again would double-count
                      the injury.
                    </p>
                    <p>
                      Prospects use a separate range: 18%, 24%, or 32% to start
                      for low, medium, or high scouting risk, plus 3.5 points for
                      each year to ETA and five additional points for pitchers,
                      capped at 65%. These inputs change uncertainty, not the FV
                      median.
                    </p>
                  </section>

                  <section>
                    <span className="method-step">06 · Building a package</span>
                    <h3>Add the assets, then check the shape of the deal</h3>
                    <p>
                      Player midpoints and entered cash or retained salary add
                      directly. Package ranges do not simply add every
                      player&apos;s best and worst outcome. The model keeps 40% of
                      player-value errors correlated as shared model risk while
                      diversifying the remaining player-specific risk.
                    </p>
                    <div className="risk-explainer">
                      <span>What shared package uncertainty means</span>
                      <strong>It is a correlation assumption for the range—not a 40% chance of failure or a 40% value haircut.</strong>
                      <p>
                        Projection systems can miss every player in the same
                        direction because the run environment, aging curve, or
                        price of a win was wrong. That is shared risk. Injuries
                        and individual development are more diversifiable. For
                        example, two $20 million players with ±$5 million
                        individual ranges form a $40 million package. Adding the
                        endpoints would give $30 million–$50 million; treating
                        every outcome as independent would give about $33
                        million–$47 million. Keeping a 40% shared component lands
                        between them, at roughly $32 million–$48 million. The
                        package midpoint remains $40 million, and cash adds without
                        uncertainty.
                      </p>
                    </div>
                    <p>
                      The gap between midpoints is the model’s answer. Overlapping
                      ranges only show that the two stress tests share some
                      values. A separate
                      package-shape warning appears when otherwise-close totals
                      exchange one $50 million-plus headliner for several pieces
                      whose best player is at least 35% lower in value. The
                      warning does not change either total; it simply recognizes
                      that elite talent usually carries a consolidation premium.
                    </p>
                  </section>

                  <section>
                    <span className="method-step">07 · Discovering a trade</span>
                    <h3>Find the need first, then search the market</h3>
                    <p>
                      The Trade finder ranks each team against the league at the
                      same position rather than comparing unlike raw totals.
                      Team and position assignments in this snapshot come from
                      RosterResource depth charts, not a player&apos;s legacy
                      projection-page label. The model keeps that snapshot
                      assignment separate from the other positions a player is
                      eligible to play, so a utility player cannot count as the
                      incumbent in several holes at once. Its need score is 45%
                      season-to-date fWAR rank and 55% Depth Charts rest-of-season
                      fWAR rank. Outfield, rotation, and bullpen are treated as
                      multi-player units. A candidate’s estimated upgrade is his
                      rest-of-season WAR above the buyer’s final current starting
                      slot at that position. The finder always runs in the July 31
                      deadline view, because the teams it searches come from July 31
                      playoff odds, so it is an archive of that deadline, not an
                      offseason list. Ordering then
                      applies a deadline-fit score: rentals and veterans rise,
                      while long-term core players, injured players, and players
                      with full trade protection fall. It is a plausibility
                      screen, not a report that anyone is on the market.
                    </p>
                    <p>
                      Candidate team filters come from a user-selected FanGraphs
                      playoff-odds threshold. Offer concepts use the buyer’s
                      positive-value prospects and young cost-controlled major leaguers,
                      exclude MLB incumbents from the selected hole, and search
                      for one-to-three-player packages within 30% of the target’s
                      midpoint value. If none exists, the tool says so rather
                      than inventing a return. These are starting points, not
                      reporting, rumors, or a claim that either club would
                      accept.
                    </p>
                  </section>

                  <section>
                    <span className="method-step">08 · What the model cannot know</span>
                    <h3>A starting point, not a front office in a browser</h3>
                    <p>
                      Public data cannot see a club&apos;s private medical review,
                      pitch-design work, makeup evaluations, player-development
                      plan, payroll budget, competitive window, or the leverage
                      created by other bidders. CBT effects, payment timing,
                      positional fit, and transaction-specific option language
                      can also matter. The best use of Dugout Value is to make
                      assumptions visible, spot obviously uneven proposals, and
                      show exactly which baseball disagreement is driving the
                      result.
                    </p>
                  </section>
                </article>

                <aside className="method-sidebar" aria-label="Model quick reference">
                  <div>
                    <span>Default model card</span>
                    <dl>
                      <div><dt>$12M</dt><dd>Base price per net WAR</dd></div>
                      <div><dt>0.5 / 0.2</dt><dd>Roster-spot allowance by role</dd></div>
                      <div><dt>+30%</dt><dd>Marginal premium above two net WAR</dd></div>
                      <div><dt>10%</dt><dd>Future-year discount, FanGraphs’ rate</dd></div>
                      <div><dt>2027 on</dt><dd>Offseason view: rest of 2026 excluded</dd></div>
                      <div><dt>3%</dt><dd>Annual market inflation</dd></div>
                      <div><dt>Off</dt><dd>July deadline scenario (optional, July 31 deadline view only)</dd></div>
                      <div><dt>40%</dt><dd>Assumed error correlation in package ranges</dd></div>
                    </dl>
                  </div>
                  <div className="method-signal-key">
                    <span>What changes what?</span>
                    <h4>Moves the midpoint</h4>
                    <p>WAR, salary, contract options, FV, roster pressure, cash, the discount rate, the valuation view, and the July deadline scenario.</p>
                    <h4>Moves only the range</h4>
                    <p>Player risk, injury context, forecast horizon, scouting risk, ETA, and pitcher uncertainty.</p>
                    <h4>Adds context only</h4>
                    <p>Trade protection and the quantity-for-quality package warning.</p>
                  </div>
                </aside>
              </div>
            </div>
            <div className="source-list">
              <span>Read the source material</span>
              <a
                href="https://www.fangraphs.com/projections?type=rfangraphsdc&amp;stats=bat&amp;pos=all"
                target="_blank"
                rel="noreferrer"
              >
                FanGraphs Depth Charts RoS ↗
              </a>
              <a
                href="https://www.fangraphs.com/projections?type=rzips&amp;stats=bat&amp;pos=all"
                target="_blank"
                rel="noreferrer"
              >
                FanGraphs ZiPS RoS ↗
              </a>
              <a
                href="https://www.fangraphs.com/projections?type=zipsp1&amp;stats=bat&amp;pos=all"
                target="_blank"
                rel="noreferrer"
              >
                FanGraphs ZiPS 2027 ↗
              </a>
              <a
                href="https://www.fangraphs.com/roster-resource/payroll/mariners"
                target="_blank"
                rel="noreferrer"
              >
                RosterResource contracts ↗
              </a>
              <a
                href="https://www.fangraphs.com/roster-resource/depth-charts/red-sox"
                target="_blank"
                rel="noreferrer"
              >
                RosterResource depth charts ↗
              </a>
              <a
                href="https://www.fangraphs.com/roster-resource/injury-report/dodgers"
                target="_blank"
                rel="noreferrer"
              >
                RosterResource injury report ↗
              </a>
              <a
                href="https://www.fangraphs.com/prospects/the-board/2025-graduates"
                target="_blank"
                rel="noreferrer"
              >
                The Board graduates ↗
              </a>
              <a
                href="https://www.mlb.com/glossary/transactions/salary-arbitration"
                target="_blank"
                rel="noreferrer"
              >
                MLB arbitration rules ↗
              </a>
              <a
                href="https://www.mlbtraderumors.com/2011/10/mlb-trade-rumors-arbitration-projections.html"
                target="_blank"
                rel="noreferrer"
              >
                Arbitration model research ↗
              </a>
              <a
                href="https://blogs.fangraphs.com/what-are-teams-paying-for-a-win-in-free-agency-2026-edition/"
                target="_blank"
                rel="noreferrer"
              >
                2026 free-agent win prices ↗
              </a>
              <a
                href="https://blogs.fangraphs.com/the-2021-zips-projections-an-introduction/"
                target="_blank"
                rel="noreferrer"
              >
                ZiPS methodology ↗
              </a>
              <a
                href="https://blogs.fangraphs.com/francisco-lindor-is-already-a-plausible-hall-of-famer/"
                target="_blank"
                rel="noreferrer"
              >
                Published Lindor career curve ↗
              </a>
              <a
                href="https://blogs.fangraphs.com/introducing-an-updated-method-for-prospect-valuation/"
                target="_blank"
                rel="noreferrer"
              >
                FanGraphs prospect surplus-value table ↗
              </a>
              <a
                href="https://blogs.fangraphs.com/2026-trade-value-nos-21-30/"
                target="_blank"
                rel="noreferrer"
              >
                FanGraphs 2026 Trade Value Series ↗
              </a>
              <a
                href="https://www.mlb.com/glossary/transactions/rule-5-draft"
                target="_blank"
                rel="noreferrer"
              >
                MLB Rule 5 rules ↗
              </a>
              <a
                href={playoffOddsData.sourceUrl}
                target="_blank"
                rel="noreferrer"
              >
                FanGraphs playoff odds ↗
              </a>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
