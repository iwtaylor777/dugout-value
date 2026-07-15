"use client";

import { useEffect, useMemo, useState } from "react";
import databaseJson from "./data/player-database.json";
import playoffOddsJson from "./data/playoff-odds.json";
import {
  effectiveSeasons,
  initialSettings as modelInitialSettings,
  prospectValues as modelProspectValues,
  valuePlayer,
} from "../lib/value-model.mjs";
import { decodeTradeState, encodeTradeState } from "../lib/trade-share.mjs";
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
type MLBSeason = {
  year: number;
  war: number;
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
  relieverPremium: number;
  inflation: number;
  minimumSalary: number;
};
type ValueResult = {
  total: number;
  low: number;
  high: number;
  expectedWar?: number;
  starOdds?: number;
  projectionTotal?: number;
  prospectTotal?: number;
  rookieAdjustment?: number;
  horizonRisk?: number;
  rangeUncertainty?: number;
  prospectRankAdjustment?: number;
  rows: Array<{
    year: number;
    war: number;
    market: number;
    salary: number;
    surplus: number;
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
type ActiveTab = "trade" | "discover" | "rankings";
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
const initialPlayers = Object.fromEntries(
  database.players.map((player) => [player.id, player]),
);
const initialSettings = modelInitialSettings as ModelSettings;
const prospectValues = modelProspectValues as Record<
  string,
  Record<ProspectType, { value: number; war: number; star: number }>
>;
const INITIAL_DISCOVERY_POSITION = (rankTeamNeeds(
  database.players,
  database.teams,
  "SEA",
  BASE_YEAR,
)[0]?.id ?? "SP") as DiscoveryPosition;

const money = (value: number) =>
  `${value < 0 ? "−" : ""}$${Math.abs(value).toFixed(1)}M`;
const signedPercent = (value: number) =>
  `${value >= 0 ? "+" : "−"}${Math.abs(value).toFixed(1)}%`;
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
const sharedSettings = (value: unknown): ModelSettings => {
  if (!isRecord(value)) return initialSettings;
  const ranges: Record<keyof ModelSettings, [number, number]> = {
    dollarsPerWar: [0, 50],
    regularRosterWar: [0, 10],
    relieverRosterWar: [0, 10],
    timingPreference: [0, 100],
    starPremium: [0, 200],
    starThreshold: [0, 10],
    relieverPremium: [0, 200],
    inflation: [0, 100],
    minimumSalary: [0, 10],
  };
  return Object.fromEntries(
    Object.entries(ranges).map(([key, [minimum, maximum]]) => {
      const candidate = value[key];
      const fallback = initialSettings[key as keyof ModelSettings];
      return [
        key,
        isFiniteNumber(candidate)
          ? Math.min(maximum, Math.max(minimum, candidate))
          : fallback,
      ];
    }),
  ) as unknown as ModelSettings;
};
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
const contractLabel = (player: MLBPlayer) => {
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
  return firstPlayerDecision
    ? `Club control through ${finalControlledYear} · then player decision`
    : `Club control through ${finalControlledYear}`;
};


function NumericField({
  value,
  onChange,
  step = 0.1,
  min,
  label,
}: {
  value: number;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
  label: string;
}) {
  return (
    <input
      aria-label={label}
      className="compact-input"
      type="number"
      value={value}
      step={step}
      min={min}
      onChange={(event) => onChange(Number(event.target.value))}
    />
  );
}

export default function Home() {
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
  const [settings, setSettings] = useState(initialSettings);
  const [showSettings, setShowSettings] = useState(false);
  const [showMethod, setShowMethod] = useState(false);
  const [leftSearch, setLeftSearch] = useState("");
  const [rightSearch, setRightSearch] = useState("");
  const [openPicker, setOpenPicker] = useState<"left" | "right" | null>(null);
  const [pickerIndex, setPickerIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<ActiveTab>("trade");
  const [rankingType, setRankingType] = useState<"all" | "mlb" | "prospect">(
    "all",
  );
  const [rankingTeam, setRankingTeam] = useState("ALL");
  const [rankingSearch, setRankingSearch] = useState("");
  const [shareStatus, setShareStatus] = useState<ShareStatus>("idle");
  const [discoveryTeam, setDiscoveryTeam] = useState("SEA");
  const [discoveryPosition, setDiscoveryPosition] =
    useState<DiscoveryPosition>(INITIAL_DISCOVERY_POSITION);
  const [sellerThreshold, setSellerThreshold] = useState(35);
  const [selectedDiscoveryTargetId, setSelectedDiscoveryTargetId] =
    useState("");

  useEffect(() => {
    const payload = new URLSearchParams(window.location.search).get("trade");
    const shared = decodeTradeState(payload ?? "");
    if (!isRecord(shared)) return;
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
      return;
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
      setSettings(restoredSettings);
      setLeftSearch("");
      setRightSearch("");
      setOpenPicker(null);
      setPickerIndex(0);
      setShowSettings(false);
      setShowMethod(false);
      setActiveTab("trade");
      setShareStatus("loaded");
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
  const discoveryNeeds = useMemo(
    () =>
      rankTeamNeeds(
        playerList,
        database.teams,
        discoveryTeam,
        BASE_YEAR,
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
        values,
        buyerTeam: discoveryTeam,
        position: discoveryPosition,
        playoffOdds: playoffOddsData.odds,
        sellerThreshold,
        baseYear: BASE_YEAR,
      }),
    [
      discoveryPosition,
      discoveryTeam,
      playerList,
      sellerThreshold,
      values,
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
            values,
            buyerTeam: discoveryTeam,
            holePosition: discoveryPosition,
            targetValue: activeDiscoveryTarget.tradeValue,
            baseYear: BASE_YEAR,
          })
        : [],
    [
      activeDiscoveryTarget,
      discoveryPosition,
      discoveryTeam,
      playerList,
      values,
    ],
  );
  const leftPackage = packageRange(leftIds, leftCash, values);
  const rightPackage = packageRange(rightIds, rightCash, values);
  const { total: leftTotal, low: leftLow, high: leftHigh } = leftPackage;
  const { total: rightTotal, low: rightLow, high: rightHigh } = rightPackage;
  const difference = leftTotal - rightTotal;
  const rangesOverlap = leftLow <= rightHigh && rightLow <= leftHigh;
  const verdict = rangesOverlap ? "Ranges overlap" : "Outside model range";
  const consolidation = packageConsolidation(
    leftIds,
    leftCash,
    rightIds,
    rightCash,
    values,
  );
  const selected = players[selectedId];
  const selectedAdjusted = isAdjusted(selected);
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
      ? `${fullProtectionNames[0]} must approve a trade`
      : fullProtectionNames.length > 1
        ? `${fullProtectionNames.length} players must approve a trade`
        : "",
    partialProtectionNames.length === 1
      ? `${partialProtectionNames[0]} has a trade list`
      : partialProtectionNames.length > 1
        ? `${partialProtectionNames.length} players have trade lists`
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
      ? `${unavailablePackagePlayers[0].name} is on the ${unavailablePackagePlayers[0].availability?.status}`
      : unavailablePackagePlayers.length > 1
        ? `${unavailablePackagePlayers.length} players in this trade are on the IL`
        : "";
  const selectedSeasons =
    selected?.kind === "mlb"
      ? (effectiveSeasons(selected) as MLBSeason[])
      : [];
  const rankedPlayers = useMemo(() => {
    const query = rankingSearch.trim().toLowerCase();
    return Object.values(players)
      .filter((player) => !player.custom)
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
  };
  const openPlayerEditor = (id: string, fromRankings = false) => {
    setSelectedId(id);
    if (fromRankings) setActiveTab("trade");
    window.setTimeout(() => {
      if (window.innerWidth <= 1250) {
        document
          .getElementById("player-editor")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 0);
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
    setSettings(initialSettings);
    setLeftSearch("");
    setRightSearch("");
    setOpenPicker(null);
    setPickerIndex(0);
    setShowSettings(false);
    setShowMethod(false);
    setActiveTab("trade");
    setShareStatus("idle");
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
    setSettings(initialSettings);
    setLeftSearch("");
    setRightSearch("");
    setOpenPicker(null);
    setPickerIndex(0);
    setShowSettings(false);
    setShowMethod(false);
    setActiveTab("trade");
    setShareStatus("idle");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const changeDiscoveryTeam = (team: string) => {
    const topNeed = rankTeamNeeds(
      playerList,
      database.teams,
      team,
      BASE_YEAR,
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
    setLeftSearch("");
    setRightSearch("");
    setOpenPicker(null);
    setPickerIndex(0);
    setShowSettings(false);
    setShowMethod(false);
    setShareStatus("idle");
    setActiveTab("trade");
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
      const url = new URL(window.location.href);
      url.search = "";
      url.hash = "";
      url.searchParams.set("trade", encodeTradeState(state));
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url.toString());
      } else {
        const textarea = document.createElement("textarea");
        try {
          textarea.value = url.toString();
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
                : contractLabel(player)}
              {player.kind === "mlb" && player.availability
                ? ` · ${player.availability.status}`
                : ""}
              {player.kind === "mlb" &&
              player.tradeProtection &&
              player.tradeProtection !== "none"
                ? ` · ${tradeProtectionLabel(player).toLowerCase()}`
                : ""}
            </small>
            <span className="value-range">
              Range {money(result.low)}–{money(result.high)}
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
            <small>{teamName(team)} sends</small>
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
            upgrades from likely sellers. Then open a value-matched offer in the
            trade builder.
          </p>
        </div>
        <b>Deadline board</b>
      </header>

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
          <span>Seller pool</span>
          <select
            value={sellerThreshold}
            onChange={(event) => {
              setSellerThreshold(Number(event.target.value));
              setSelectedDiscoveryTargetId("");
            }}
          >
            <option value="20">Strong sellers · 20% odds or lower</option>
            <option value="35">Likely sellers · 35% odds or lower</option>
            <option value="50">Wider market · 50% odds or lower</option>
          </select>
        </label>
        <div className="discovery-source">
          <span>Market context</span>
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
          rank and 55% Steamer rest-of-season fWAR rank. Rotation, bullpen, and
          outfield are evaluated as multi-player units. Targets balance the
          projected upgrade with a deadline-fit signal based on control, age,
          health, and trade protection; it never claims a player is available.
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
                    S2D · {need.seasonToDateRank} of {database.teams.length}
                  </small>
                </span>
                <span className="need-metric">
                  <b>{need.restOfSeasonWar.toFixed(1)}</b>
                  <small>
                    RoS · {need.restOfSeasonRank} of {database.teams.length}
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
                RoS improvement, adjusted for a transparent deadline-availability signal
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
                      {teamName(target.player.team)} · {displayPosition(target.player)} ·
                      {target.deadlineLabel} through {target.controlThrough}
                    </small>
                    {(target.player.availability ||
                      target.player.tradeProtection === "full") && (
                      <em>
                        {target.player.availability
                          ? target.player.availability.status
                          : "Player approval required"}
                      </em>
                    )}
                  </span>
                  <span className="target-upgrade">
                    <strong>+{target.improvement.toFixed(1)} WAR</strong>
                    <small>estimated RoS upgrade</small>
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
                <strong>No clear upgrades in this seller pool.</strong>
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
                Alternative package shapes matched to a {money(activeDiscoveryTarget.tradeValue)} central value
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
                      ? "Central model values match exactly."
                      : `${money(Math.abs(offer.gap))} ${offer.gap > 0 ? "above" : "below"} the target’s central value.`}
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
                  within 30% of the target’s central value. Try another target
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
    <main>
      <header className="masthead">
        <a className="brand" href="#top">
          Dugout Value <small>Baseball trade model</small>
        </a>
        <nav>
          <button
            className="nav-button"
            onClick={openMethod}
          >
            Method
          </button>
          <button className="nav-button" onClick={resetTrade}>
            Load example
          </button>
          <button className="nav-button primary" onClick={newTrade}>
            New trade
          </button>
        </nav>
      </header>
      <div className="page" id="top">
        <section className="intro">
          <div>
            <p className="kicker">Deadline trade lab</p>
            <h1>
              {activeTab === "trade"
                ? "Build a trade"
                : activeTab === "discover"
                  ? "Find an upgrade"
                  : "The big board"}
            </h1>
            <p className="lede">
              {activeTab === "trade"
                ? "Put together a deal, see how the value lines up, and tune any assumption."
                : activeTab === "discover"
                  ? "Start with a team need, search likely sellers, and test a value-matched offer."
                  : "A just-for-fun leaguewide ranking from the same transparent model."}
            </p>
          </div>
        </section>
        <div
          className="workspace-tabs"
          role="tablist"
          aria-label="Dugout Value views"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "trade"}
            className={activeTab === "trade" ? "is-active" : ""}
            onClick={() => setActiveTab("trade")}
          >
            Trade builder
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "discover"}
            className={activeTab === "discover" ? "is-active" : ""}
            onClick={() => setActiveTab("discover")}
          >
            Trade finder
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "rankings"}
            className={activeTab === "rankings" ? "is-active" : ""}
            onClick={() => setActiveTab("rankings")}
          >
            Value rankings
          </button>
        </div>
        {activeTab === "trade" ? (
          <>
        <section className="model-strip">
          <div>
            <span>Market curve</span>
            <strong>
              ${settings.dollarsPerWar}M + {settings.starPremium}% above{" "}
              {settings.starThreshold} net WAR
            </strong>
          </div>
          <div>
            <span>2026 valuation</span>
            <strong>Steamer RoS + remaining salary</strong>
          </div>
          <div>
            <span>Roster burden</span>
            <strong>
              {settings.regularRosterWar.toFixed(1)} /{" "}
              {settings.relieverRosterWar.toFixed(1)} fWAR by role
            </strong>
          </div>
          <div>
            <span>Timing lens</span>
            <strong>
              {settings.timingPreference === 0
                ? "Neutral · no discount"
                : `Win now · ${settings.timingPreference}% / year`}
            </strong>
          </div>
          <button onClick={() => setShowSettings((value) => !value)}>
            {showSettings ? "Close assumptions" : "Edit assumptions"}
          </button>
        </section>
        {showSettings && (
          <section className="assumption-panel">
            <div className="timing-presets">
              <span>Team timing lens</span>
              <div>
                <button
                  type="button"
                  className={
                    settings.timingPreference === 0 ? "is-active" : ""
                  }
                  onClick={() =>
                    setSettings({ ...settings, timingPreference: 0 })
                  }
                >
                  Neutral value
                  <small>Future wins count equally</small>
                </button>
                <button
                  type="button"
                  className={
                    settings.timingPreference === 8 ? "is-active" : ""
                  }
                  onClick={() =>
                    setSettings({ ...settings, timingPreference: 8 })
                  }
                >
                  Win-now behavior
                  <small>8% less per future year</small>
                </button>
              </div>
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
              <span>Position player / SP burden</span>
              <NumericField
                label="Position player and starter roster burden"
                value={settings.regularRosterWar}
                min={0}
                onChange={(value) =>
                  setSettings({ ...settings, regularRosterWar: value })
                }
              />
              <em>WAR</em>
            </label>
            <label>
              <span>Reliever roster burden</span>
              <NumericField
                label="Reliever roster burden"
                value={settings.relieverRosterWar}
                min={0}
                onChange={(value) =>
                  setSettings({ ...settings, relieverRosterWar: value })
                }
              />
              <em>WAR</em>
            </label>
            <label>
              <span>Custom timing preference</span>
              <NumericField
                label="Custom timing preference"
                value={settings.timingPreference}
                min={0}
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
              Net fWAR subtracts the role’s roster burden, then the first two
              wins use the base rate and additional wins receive the star
              premium. FanGraphs pitcher WAR already includes a leverage
              adjustment, so the extra reliever premium stays an optional team
              preference rather than a hidden assumption.
            </p>
          </section>
        )}

        <section className="trade-shell">
          <div className="trade-board">
            <div className="package-explainer">
              <span>Outgoing packages</span>
              <strong>
                {teamName(leftTeam)} receives {teamName(rightTeam)}’s package ·{" "}
                {teamName(rightTeam)} receives {teamName(leftTeam)}’s package
              </strong>
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
                    <span>{leftTeam} sends</span>
                    <strong>{money(leftTotal)}</strong>
                    <small>
                      Range {money(leftLow)}–{money(leftHigh)}
                    </small>
                  </div>
                  <div className="scoreboard-center">
                    <span
                      className={`verdict-stamp ${rangesOverlap ? "balanced" : ""}`}
                    >
                      {verdict}
                    </span>
                    <strong>Gap: {money(Math.abs(difference))}</strong>
                    <p>
                      {difference === 0
                        ? "Even estimates"
                        : `${difference > 0 ? teamName(leftTeam) : teamName(rightTeam)} sends more estimated value`}
                    </p>
                  </div>
                  <div className="scoreboard-team scoreboard-team-right">
                    <span>{rightTeam} sends</span>
                    <strong>{money(rightTotal)}</strong>
                    <small>
                      Range {money(rightLow)}–{money(rightHigh)}
                    </small>
                  </div>
                </div>
                {(tradeProtectionSummary || availabilitySummary) && (
                  <div className="scoreboard-context">
                    {tradeProtectionSummary && (
                      <p className="trade-caveat">
                        {tradeProtectionSummary} · surplus value is unchanged
                      </p>
                    )}
                    {availabilitySummary && (
                      <p className="trade-caveat availability-caveat">
                        {availabilitySummary} · range widened, central WAR unchanged
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
                      )} gives up the best player
                    </strong>
                    <p>
                      The dollars are close, but the return is built from
                      smaller pieces. Real clubs often ask for a stronger
                      headliner or extra value in a consolidation trade.
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
                          : "Includes edited assumptions"}
                  </small>
                </div>
              </div>
            </div>
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
                      <span>{leftTeam} sends</span>
                      <span>Annual comparison</span>
                      <span>{rightTeam} sends</span>
                    </div>
                    {allYears.map((year) => {
                      const lv = sideYearValue(leftIds, year),
                        rv = sideYearValue(rightIds, year);
                      return (
                        <div className="ledger-row" key={year}>
                          <strong>{year}</strong>
                          <span>{money(lv)}</span>
                          <div className="year-bars">
                            <i
                              className="left-bar"
                              style={{
                                width: `${Math.max(2, (Math.abs(lv) / maxYearValue) * 48)}%`,
                              }}
                            />
                            <b />
                            <i
                              className="right-bar"
                              style={{
                                width: `${Math.max(2, (Math.abs(rv) / maxYearValue) * 48)}%`,
                              }}
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
                              width: `${leftCash > 0 ? Math.max(2, (leftCash / maxYearValue) * 48) : 0}%`,
                            }}
                          />
                          <b />
                          <i
                            className="right-bar"
                            style={{
                              width: `${rightCash > 0 ? Math.max(2, (rightCash / maxYearValue) * 48) : 0}%`,
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
                  <small>Updated {prettyDate(selected.source.refreshed)}</small>
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
                      <span>Availability</span>
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
                        ? ` · Eligible ${selected.availability.eligibleDate}`
                        : ""}
                      . This injury adds {selected.availability.riskAdjustment}{" "}
                      risk points; every two points widen each side of the
                      value range by one percentage point, up to the model cap.
                      Central value stays unchanged because Steamer RoS already
                      accounts for expected missed time.
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
                  </div>
                )}
                {selected.kind === "mlb" && (
                  <p className="ros-note">
                    <strong>2026 is rest-of-season only.</strong> fWAR, the
                    free-WAR threshold, and salary are reduced to the remaining
                    season. Future arbitration starts from the full-year salary
                    (
                    {money(
                      selectedSeasons[0]?.annualSalary ??
                        selectedSeasons[0]?.salary ??
                        0,
                    )}
                    ). Arb 1 uses projected role-specific counting stats;
                    later years use conservative raises from the prior salary.
                  </p>
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
                        value range. This changes the range, never the central
                        value.
                      </small>
                    </div>
                    <div className="projection-title">
                      <div>
                        <span>fWAR by control year</span>
                        <small>
                          2026 is RoS; explicit future ZiPS is used before the
                          aging fallback.
                        </small>
                      </div>
                      <button
                        onClick={() => addMlbSeason(selected.id)}
                      >
                        + Year
                      </button>
                    </div>
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
                            className="projection-row"
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
                                <strong>{money(row?.salary ?? 0)}</strong>
                                <small>
                                  {season.salaryMode === "arb1"
                                    ? "stats model"
                                    : season.salaryMode.startsWith("arb")
                                      ? "bounded raise"
                                      : "league minimum"}
                                </small>
                              </span>
                            )}
                            <strong>{money(row?.surplus ?? 0)}</strong>
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
          </>
        ) : activeTab === "discover" ? (
          renderDiscovery()
        ) : (
          <section
            className="rankings-panel"
            aria-label="Overall trade value rankings"
          >
            <div className="rankings-heading">
              <div>
                <span>Leaguewide board</span>
                <h2>Overall trade value rankings</h2>
                <p>
                  Estimated surplus value today. Treat the order as a
                  conversation starter, especially where the ranges overlap.
                </p>
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
            <div className="ranking-list">
              <div className="ranking-row ranking-head">
                <span>Rank</span>
                <span>Player</span>
                <span>Type</span>
                <span>Value range</span>
                <span>Model value</span>
                <span />
              </div>
              {rankedPlayers.map((player, index) => {
                const result = values[player.id];
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
                          ? ` · ${player.availability.status}`
                          : ""}
                      </small>
                    </div>
                    <span className={`type-pill ${player.kind}`}>
                      {player.kind === "prospect" ? `${player.fv} FV` : "MLB"}
                    </span>
                    <span className="ranking-range">
                      {money(result?.low ?? 0)}–{money(result?.high ?? 0)}
                    </span>
                    <strong className="ranking-value">
                      {money(result?.total ?? 0)}
                    </strong>
                    <button
                      type="button"
                      onClick={() => openPlayerEditor(player.id, true)}
                    >
                      Open model
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
                    A trade model should answer a different question than a
                    player ranking. It is not simply asking who is better. It is
                    asking how many wins a club is likely to receive, what those
                    wins would cost to buy, and how much salary and uncertainty
                    come with them.
                  </p>
                  <p className="method-byline">
                    Model snapshot · {(
                      database.meta.mlbCount + database.meta.prospectCount
                    ).toLocaleString()} players · Data updated {prettyDate(database.meta.refreshed)}
                  </p>
                </div>
                <button type="button" onClick={() => setShowMethod(false)}>
                  Back to the tool
                </button>
              </header>

              <div className="method-short-version">
                <span>The short version</span>
                <p>
                  <strong>Trade value is expected on-field value minus expected cost.</strong>{" "}
                  Dugout Value estimates that surplus for every remaining year
                  of club control, then shows a range around the answer because
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
                      A five-win player making a market salary can be more useful
                      than valuable in trade. A three-win player earning close to
                      the league minimum can carry enormous trade value. Dugout
                      Value works one control year at a time: estimate the wins,
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
                  </section>

                  <section>
                    <span className="method-step">02 · Projecting major leaguers</span>
                    <h3>Start with the season that still has to be played</h3>
                    <p>
                      For 2026, the model uses FanGraphs Steamer rest-of-season
                      fWAR and only the unpaid portion of the current salary.
                      That prevents already-produced wins and already-paid salary
                      from inflating a deadline valuation. Explicit future ZiPS
                      projections are used when available; otherwise a simple
                      Marcel-style aging fallback extends the projection. Two-way
                      value is combined across hitting and pitching.
                    </p>
                    <p>
                      Not every fraction of a win is scarce. The default model
                      treats 0.5 WAR for a position player or starter—and 0.2 WAR
                      for a reliever—as the annual roster opportunity cost. That
                      is the value a club should be able to find simply by using
                      the roster spot. For a partial season, the burden is scaled
                      to the time remaining.
                    </p>
                    <p>
                      Wins above that burden are priced at $12 million per WAR.
                      The first two net wins use that base price; each additional
                      win is priced 30% higher, at $15.6 million. Because the
                      roster burden comes first, the default premium begins at
                      2.5 projected WAR for a full-season position player or
                      starter—not at 2.0 raw WAR. The cutoff is prorated along
                      with the burden for the rest of 2026.
                    </p>
                    <div className="risk-explainer">
                      <span>Why a 30% premium after two net WAR?</span>
                      <strong>The public market supports a curve; 30% is a conservative calibration, not a discovered constant.</strong>
                      <p>
                        A 2026 free-agent study found players projected for at
                        least two WAR were paid roughly 42% more per win among
                        starters and 54% more among hitters than the groups below
                        two WAR. That comparison also captures playing-time
                        certainty, scarcity, and a small top tier, so Dugout
                        Value does not import the full gap. It applies a smaller
                        premium only to the marginal wins above the cutoff,
                        producing a smooth curve with no value cliff.
                      </p>
                    </div>
                    <p>
                      Two net WAR is the default because its 2.5-WAR raw
                      equivalent sits above the study&apos;s two-WAR split without
                      waiting until 3.5 raw WAR, where a three-net-WAR cutoff
                      would begin. In other words, it rewards clearly
                      above-average regulars without labeling every useful
                      starter a star. Both the premium and its net-WAR cutoff are
                      editable. The default reliever premium is zero because
                      FanGraphs pitcher WAR already recognizes leverage.
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
                      for relievers. Later arbitration years use conservative,
                      performance-bounded raises from the prior salary rather
                      than implausibly doubling pay every season.
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
                      Prospect central values begin with FanGraphs Future Value
                      tiers and the historical surplus produced by hitters and
                      pitchers in each tier. FV remains the main signal. Overall
                      Board rank is used only as a small tiebreaker within the
                      same FV grade, ranging from +5% to −5%; an ordinal list
                      never overrules the scouting grade.
                    </p>
                    <p>
                      Roster pressure is kept separate from talent. The editable
                      scenarios apply a 15% Rule 5 adjustment, a 10% 40-man
                      adjustment, or a 40% severe-crunch adjustment. These
                      describe negotiating leverage and roster cost, not a claim
                      that the player became worse. Prospect ETA does not reduce
                      the central value under the neutral default, but it does
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
                    <h3>The middle is an estimate; the range is the honesty</h3>
                    <p>
                      MLB ranges begin with 10% model uncertainty. Every two
                      player-risk points add one percentage point to each side of
                      the range. Long-dated control adds up to another 15 points,
                      based on how far into the future the surplus sits. Total MLB
                      uncertainty is capped at 45%.
                    </p>
                    <div className="risk-explainer">
                      <span>How to read the range</span>
                      <strong>The center is the estimate. The low and high values show how uncertain that estimate is.</strong>
                      <p>
                        A $40 million central value with a ±25% range appears as
                        $30 million–$50 million. Increasing player uncertainty
                        widens those endpoints but leaves the $40 million center
                        and the projected WAR unchanged. In the editor, two
                        player-uncertainty points add one percentage point to
                        each side of the range.
                      </p>
                    </div>
                    <p>
                      Current IL status can add 4–14 of those risk points,
                      depending on the injured-list category and public language
                      such as surgery, no timetable, or a season-ending injury.
                      The adjustment widens the range only. Steamer RoS already
                      reflects expected missed 2026 playing time, so cutting the
                      central projection again would double-count the injury.
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
                      Player central values and entered cash or retained salary
                      add directly. Package ranges do not simply add every
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
                        package center remains $40 million, and cash adds without
                        uncertainty.
                      </p>
                    </div>
                    <p>
                      Range overlap is the primary trade signal. A separate
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
                      The Trade Finder ranks each team against the league at the
                      same position rather than comparing unlike raw totals.
                      Current team and position assignments come from
                      RosterResource depth charts, not a player&apos;s legacy
                      projection-page label. The model keeps that current
                      assignment separate from the other positions a player is
                      eligible to play, so a utility player cannot count as the
                      incumbent in several holes at once. Its need score is 45%
                      season-to-date fWAR rank and 55% Steamer rest-of-season
                      fWAR rank. Outfield, rotation, and bullpen are treated as
                      multi-player units. A candidate’s estimated upgrade is his
                      rest-of-season WAR above the buyer’s final current starting
                      slot at that position. Ordering then applies a transparent
                      deadline-fit signal: rentals and veterans rise, while
                      long-term core players, injured players, and players with
                      full trade protection fall. It is a plausibility screen,
                      not a report that anyone is on the market.
                    </p>
                    <p>
                      Seller pools come from a user-selected FanGraphs playoff-
                      odds threshold. Offer concepts use the buyer’s positive-
                      value prospects and young cost-controlled major leaguers,
                      exclude MLB incumbents from the selected hole, and search
                      for one-to-three-player packages within 30% of the target’s
                      central trade value. If none exists, the tool says so
                      rather than inventing a return. These are transparent
                      starting points, not reporting, rumors, or a claim that
                      either club would accept.
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
                      <div><dt>0.5 / 0.2</dt><dd>Roster burden by role</dd></div>
                      <div><dt>+30%</dt><dd>Marginal premium above two net WAR</dd></div>
                      <div><dt>0%</dt><dd>Future-year discount</dd></div>
                      <div><dt>3%</dt><dd>Annual market inflation</dd></div>
                      <div><dt>40%</dt><dd>Assumed error correlation in package ranges</dd></div>
                    </dl>
                  </div>
                  <div className="method-signal-key">
                    <span>What changes what?</span>
                    <h4>Moves the central value</h4>
                    <p>WAR, salary, contract options, FV, roster pressure, cash, and the optional timing lens.</p>
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
                href="https://www.fangraphs.com/projections?type=steamerr&amp;stats=bat&amp;pos=all"
                target="_blank"
                rel="noreferrer"
              >
                FanGraphs RoS projections ↗
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
                href="https://baseballprojection.substack.com/p/measuring-the-cost-of-free-agents"
                target="_blank"
                rel="noreferrer"
              >
                Free-agent price curve study ↗
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
        <footer>
          <div className="brand">
            Dugout <b>Value</b>
          </div>
          <p>
            A transparent decision aid, not a claim about any club’s private
            model. Refresh the data snapshot and verify options, service time,
            injuries, and transactions before relying on a result.
          </p>
        </footer>
      </div>
    </main>
  );
}
