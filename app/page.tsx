"use client";

import { useMemo, useState } from "react";
import databaseJson from "./data/player-database.json";
import {
  initialSettings as modelInitialSettings,
  prospectValues as modelProspectValues,
  valuePlayer,
} from "../lib/value-model.mjs";

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
type Provenance = { projection: string; contract: string; refreshed: string };
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
};
type LastProspect = {
  fv: string;
  rank: number | null;
  year: number;
  serviceTime: number;
  risk: string | null;
};
type MLBPlayer = {
  id: string;
  kind: "mlb";
  name: string;
  team: string;
  position: string;
  role?: "position" | "starter" | "reliever" | "two-way";
  age: number;
  source: Provenance;
  risk: number;
  seasons: MLBSeason[];
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
  rank?: number | null;
  custom?: boolean;
};
type Player = MLBPlayer | ProspectPlayer;
type Team = { abbr: string; name: string };
type ModelSettings = {
  dollarsPerWar: number;
  regularRosterWar: number;
  relieverRosterWar: number;
  timingPreference: number;
  starPremium: number;
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

const database = databaseJson as unknown as Database;
const BASE_YEAR = database.meta.baseYear;
const initialPlayers = Object.fromEntries(
  database.players.map((player) => [player.id, player]),
);
const initialSettings = modelInitialSettings as ModelSettings;
const prospectValues = modelProspectValues as Record<
  string,
  Record<ProspectType, { value: number; war: number; star: number }>
>;

const money = (value: number) =>
  `${value < 0 ? "−" : ""}$${Math.abs(value).toFixed(1)}M`;
const deepCopy = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const prettyDate = (date: string) =>
  new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
const displayPosition = (player: Player) =>
  player.kind === "mlb" && player.position === "P"
    ? player.role === "reliever"
      ? "RP"
      : player.role === "starter"
        ? "SP"
        : "P"
    : player.position;
const contractLabel = (player: MLBPlayer) => {
  const firstPlayerDecision = player.seasons.find((season) =>
    ["playerOption", "mutualOption"].includes(
      season.contractType ?? season.salaryMode,
    ),
  );
  const controlledSeasons = firstPlayerDecision
    ? player.seasons.filter((season) => season.year < firstPlayerDecision.year)
    : player.seasons;
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
  const [selectedId, setSelectedId] = useState("mlb-694973");
  const [settings, setSettings] = useState(initialSettings);
  const [showSettings, setShowSettings] = useState(false);
  const [showMethod, setShowMethod] = useState(false);
  const [leftSearch, setLeftSearch] = useState("");
  const [rightSearch, setRightSearch] = useState("");
  const [openPicker, setOpenPicker] = useState<"left" | "right" | null>(null);
  const [pickerIndex, setPickerIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<"trade" | "rankings">("trade");
  const [rankingType, setRankingType] = useState<"all" | "mlb" | "prospect">(
    "all",
  );
  const [rankingTeam, setRankingTeam] = useState("ALL");
  const [rankingSearch, setRankingSearch] = useState("");

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
  const leftTotal = leftIds.reduce(
    (sum, id) => sum + (values[id]?.total ?? 0),
    0,
  );
  const rightTotal = rightIds.reduce(
    (sum, id) => sum + (values[id]?.total ?? 0),
    0,
  );
  const leftLow = leftIds.reduce((sum, id) => sum + (values[id]?.low ?? 0), 0);
  const leftHigh = leftIds.reduce(
    (sum, id) => sum + (values[id]?.high ?? 0),
    0,
  );
  const rightLow = rightIds.reduce(
    (sum, id) => sum + (values[id]?.low ?? 0),
    0,
  );
  const rightHigh = rightIds.reduce(
    (sum, id) => sum + (values[id]?.high ?? 0),
    0,
  );
  const difference = leftTotal - rightTotal;
  const rangesOverlap = leftLow <= rightHigh && rightLow <= leftHigh;
  const verdict = rangesOverlap ? "Ranges overlap" : "Outside model range";
  const selected = players[selectedId];
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
      setLeftSearch("");
    } else {
      setRightTeam(team);
      setRightIds([]);
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
          };
    setPlayers((current) => ({ ...current, [id]: player }));
    addPlayer(side, id);
  };
  const resetTrade = () => {
    setPlayers(deepCopy(initialPlayers));
    setLeftTeam("SEA");
    setRightTeam("PIT");
    setLeftIds(["mlb-677594"]);
    setRightIds(["mlb-694973"]);
    setSelectedId("mlb-694973");
    setSettings(initialSettings);
    setLeftSearch("");
    setRightSearch("");
    setOpenPicker(null);
    setPickerIndex(0);
    setShowSettings(false);
    setShowMethod(false);
    setActiveTab("trade");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const newTrade = () => {
    setPlayers(deepCopy(initialPlayers));
    setLeftTeam("SEA");
    setRightTeam("PIT");
    setLeftIds([]);
    setRightIds([]);
    setSelectedId("");
    setSettings(initialSettings);
    setLeftSearch("");
    setRightSearch("");
    setOpenPicker(null);
    setPickerIndex(0);
    setShowSettings(false);
    setShowMethod(false);
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
    setLeftTeam(rightTeam);
    setLeftIds(rightIds);
    setRightTeam(team);
    setRightIds(ids);
    setLeftSearch("");
    setRightSearch("");
    setOpenPicker(null);
    setPickerIndex(0);
  };

  const renderCard = (id: string, side: "left" | "right") => {
    const player = players[id],
      result = values[id];
    if (!player || !result) return null;
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
            <strong>{player.name}</strong>
            <small>
              {displayPosition(player)} · Age {player.age} ·{" "}
              {player.kind === "prospect"
                ? `${player.fv} FV${
                    player.rosterContext && player.rosterContext !== "none"
                      ? " · roster pressure"
                      : ""
                  }`
                : contractLabel(player)}
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
    const query = search.trim().toLowerCase();
    const matches = available
      .filter((player) =>
        query
          ? `${player.name} ${displayPosition(player)} ${
              player.kind === "prospect" ? `${player.fv} fv prospect` : "mlb"
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
            <h1>{activeTab === "trade" ? "Build a trade" : "The big board"}</h1>
            <p className="lede">
              {activeTab === "trade"
                ? "Put together a deal, see how the value lines up, and tune any assumption."
                : "A just-for-fun leaguewide ranking from the same transparent model."}
            </p>
          </div>
          <div className="snapshot">
            <strong>2026 deadline model</strong>
            <small>
              {(
                database.meta.mlbCount + database.meta.prospectCount
              ).toLocaleString()}{" "}
              players · Updated {prettyDate(database.meta.refreshed)}
            </small>
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
              ${settings.dollarsPerWar}M + {settings.starPremium}% star premium
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
              <span>Star premium after 2 net WAR</span>
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
              <div className="trade-verdict">
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
                <button onClick={swapTeams}>
                  Swap teams
                </button>
              </div>
              {renderTeamSide({
                side: "right",
                team: rightTeam,
                ids: rightIds,
                total: rightTotal,
              })}
            </div>
            <section className="year-ledger">
              <div className="section-title">
                <div>
                  <span>Control years</span>
                  <h2>Value by control year</h2>
                </div>
              </div>
              {allYears.length ? (
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
                      selected.seasons[0]?.annualSalary ??
                        selected.seasons[0]?.salary ??
                        0,
                    )}
                    ) and uses platform-performance raises.
                  </p>
                )}
                {selected.kind === "mlb" ? (
                  <>
                    <div className="risk-field">
                      <label htmlFor="risk">
                        Player-specific risk <strong>{selected.risk}%</strong>
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
                        onClick={() =>
                          updatePlayer(selected.id, (player) =>
                            player.kind === "mlb"
                              ? {
                                  ...player,
                                  seasons: [
                                    ...player.seasons,
                                    {
                                      year:
                                        Math.max(
                                          BASE_YEAR,
                                          ...player.seasons.map(
                                            (season) => season.year,
                                          ),
                                        ) + 1,
                                      war: 2,
                                      salary: 1,
                                      salaryMode: "fixed",
                                    },
                                  ],
                                }
                              : player,
                          )
                        }
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
                      {selected.seasons.map((season, index) => {
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
                                updatePlayer(selected.id, (player) =>
                                  player.kind === "mlb"
                                    ? {
                                        ...player,
                                        seasons: player.seasons.map(
                                          (item, i) =>
                                            i === index
                                              ? { ...item, year: value }
                                              : item,
                                        ),
                                      }
                                    : player,
                                )
                              }
                            />
                            <NumericField
                              label="Projected fWAR"
                              value={season.war}
                              onChange={(value) =>
                                updatePlayer(selected.id, (player) =>
                                  player.kind === "mlb"
                                    ? {
                                        ...player,
                                        seasons: player.seasons.map(
                                          (item, i) =>
                                            i === index
                                              ? { ...item, war: value }
                                              : item,
                                        ),
                                      }
                                    : player,
                                )
                              }
                            />
                            <select
                              aria-label="Salary type"
                              value={season.contractType ?? season.salaryMode}
                              onChange={(event) =>
                                updatePlayer(selected.id, (player) =>
                                  player.kind === "mlb"
                                    ? {
                                        ...player,
                                        seasons: player.seasons.map(
                                          (item, i) =>
                                            i === index
                                              ? {
                                                  ...item,
                                                  salaryMode: event.target
                                                    .value as SalaryMode,
                                                  contractType: event.target
                                                    .value as SalaryMode,
                                                }
                                              : item,
                                        ),
                                      }
                                    : player,
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
                                    updatePlayer(selected.id, (player) =>
                                      player.kind === "mlb"
                                        ? {
                                            ...player,
                                            seasons: player.seasons.map(
                                              (item, i) =>
                                                i === index
                                                  ? { ...item, salary: value }
                                                  : item,
                                            ),
                                          }
                                        : player,
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
                                {money(row?.salary ?? 0)}
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
                          This changes trade leverage, not the scouting grade.
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
            <div className="section-title">
              <div>
                <span>Open model</span>
                <h2>How Dugout Value thinks</h2>
              </div>
              <button onClick={() => setShowMethod(false)}>Close</button>
            </div>
            <div className="method-grid">
              <article>
                <b>01</b>
                <h3>Rest-of-season first</h3>
                <p>
                  2026 uses Steamer RoS fWAR and only the unpaid share of the
                  current salary. Explicit 2027–28 ZiPS is used before the aging
                  fallback, and two-way WAR is combined across roles.
                </p>
              </article>
              <article>
                <b>02</b>
                <h3>Market curve, not one flat price</h3>
                <p>
                  The model subtracts a smaller roster burden for relievers,
                  prices the first two net wins at the base rate, and gives
                  additional wins a restrained star premium. Future seasons
                  count equally by default; the optional win-now lens describes
                  team behavior rather than financial time value.
                </p>
              </article>
              <article>
                <b>03</b>
                <h3>Contracts, scouting, and roster pressure</h3>
                <p>
                  Arbitration follows platform performance; options and
                  deferrals use their economic terms, and opt-outs remove future
                  upside without erasing downside. Playing-time escalators use
                  projected odds; mutually exclusive award bonuses stay out of
                  the salary estimate. Young MLB players can retain recent FV
                  value, while Rule 5 and 40-man pressure is an explicit context
                  adjustment rather than a hidden talent downgrade.
                </p>
              </article>
            </div>
            <div className="source-list">
              <span>Built-in sources</span>
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
                href="https://blogs.fangraphs.com/what-are-teams-paying-for-a-win-in-free-agency-2026-edition/"
                target="_blank"
                rel="noreferrer"
              >
                2026 free-agent win prices ↗
              </a>
              <a
                href="https://www.mlb.com/glossary/transactions/rule-5-draft"
                target="_blank"
                rel="noreferrer"
              >
                MLB Rule 5 rules ↗
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
