"use client";

import { useMemo, useState } from "react";

type SalaryMode = "fixed" | "prearb" | "arb1" | "arb2" | "arb3" | "arb4";
type ProspectType = "Hitter" | "Pitcher";

type MLBSeason = {
  year: number;
  war: number;
  salary: number;
  salaryMode: SalaryMode;
};

type MLBPlayer = {
  id: string;
  kind: "mlb";
  name: string;
  team: string;
  position: string;
  age: number;
  source: string;
  risk: number;
  seasons: MLBSeason[];
};

type ProspectPlayer = {
  id: string;
  kind: "prospect";
  name: string;
  team: string;
  position: string;
  age: number;
  source: string;
  prospectType: ProspectType;
  fv: string;
  eta: number;
  adjustment: number;
};

type Player = MLBPlayer | ProspectPlayer;

type ModelSettings = {
  dollarsPerWar: number;
  freeWar: number;
  discountRate: number;
  inflation: number;
  minimumSalary: number;
};

type ValueResult = {
  total: number;
  low: number;
  high: number;
  expectedWar?: number;
  starOdds?: number;
  rows: Array<{ year: number; war: number; market: number; salary: number; surplus: number }>;
};

const BASE_YEAR = 2026;
const arbRates: Record<SalaryMode, number> = {
  fixed: 0,
  prearb: 0,
  arb1: 0.15,
  arb2: 0.35,
  arb3: 0.5,
  arb4: 0.75,
};

const prospectValues: Record<string, Record<ProspectType, { value: number; war: number; star: number }>> = {
  "70": { Hitter: { value: 195, war: 27.5, star: 87.5 }, Pitcher: { value: 195, war: 27, star: 87.5 } },
  "65": { Hitter: { value: 95, war: 13.5, star: 40 }, Pitcher: { value: 95, war: 13.5, star: 40 } },
  "60": { Hitter: { value: 82, war: 12.5, star: 33 }, Pitcher: { value: 70, war: 11, star: 21 } },
  "55": { Hitter: { value: 55, war: 8, star: 17.5 }, Pitcher: { value: 45, war: 7, star: 7 } },
  "50": { Hitter: { value: 45, war: 7, star: 13.5 }, Pitcher: { value: 33.5, war: 5, star: 7 } },
  "45+": { Hitter: { value: 18.5, war: 3.2, star: 6 }, Pitcher: { value: 15, war: 2.6, star: 3 } },
  "45": { Hitter: { value: 14.5, war: 2.5, star: 3.5 }, Pitcher: { value: 9.5, war: 1.6, star: 1.5 } },
  "40+": { Hitter: { value: 8, war: 1.2, star: 1.8 }, Pitcher: { value: 7, war: 1, star: 1 } },
  "40": { Hitter: { value: 5.5, war: 0.75, star: 0.8 }, Pitcher: { value: 4, war: 0.55, star: 0.4 } },
  "35+": { Hitter: { value: 2, war: 0.3, star: 0.4 }, Pitcher: { value: 1.5, war: 0.25, star: 0.4 } },
};

const seedPlayers: Record<string, Player> = {
  skenes: {
    id: "skenes", kind: "mlb", name: "Paul Skenes", team: "PIT", position: "SP", age: 24,
    source: "FanGraphs-style seed projection · verify service time",
    risk: 10,
    seasons: [
      { year: 2026, war: 5.7, salary: 0, salaryMode: "arb1" },
      { year: 2027, war: 5.3, salary: 0, salaryMode: "arb2" },
      { year: 2028, war: 4.9, salary: 0, salaryMode: "arb3" },
      { year: 2029, war: 4.5, salary: 0, salaryMode: "arb4" },
    ],
  },
  julio: {
    id: "julio", kind: "mlb", name: "Julio Rodríguez", team: "SEA", position: "CF", age: 25,
    source: "Contract seed · guaranteed years only",
    risk: 7,
    seasons: [
      { year: 2026, war: 4.5, salary: 19, salaryMode: "fixed" },
      { year: 2027, war: 4.4, salary: 19, salaryMode: "fixed" },
      { year: 2028, war: 4.2, salary: 19, salaryMode: "fixed" },
      { year: 2029, war: 4, salary: 19, salaryMode: "fixed" },
    ],
  },
  skubal: {
    id: "skubal", kind: "mlb", name: "Tarik Skubal", team: "DET", position: "SP", age: 29,
    source: "2026 salary reported by MLB · editable projection",
    risk: 11,
    seasons: [{ year: 2026, war: 5.2, salary: 32, salaryMode: "fixed" }],
  },
  henderson: {
    id: "henderson", kind: "mlb", name: "Gunnar Henderson", team: "BAL", position: "SS", age: 25,
    source: "FanGraphs-style seed projection · modelled arbitration",
    risk: 6,
    seasons: [
      { year: 2026, war: 5.8, salary: 0, salaryMode: "arb1" },
      { year: 2027, war: 5.6, salary: 0, salaryMode: "arb2" },
      { year: 2028, war: 5.3, salary: 0, salaryMode: "arb3" },
      { year: 2029, war: 5, salary: 0, salaryMode: "arb4" },
    ],
  },
  griffin: {
    id: "griffin", kind: "prospect", name: "Konnor Griffin", team: "PIT", position: "SS", age: 20,
    source: "FanGraphs 2026 FV", prospectType: "Hitter", fv: "70", eta: 2026, adjustment: 0,
  },
  made: {
    id: "made", kind: "prospect", name: "Jesús Made", team: "MIL", position: "SS", age: 19,
    source: "FanGraphs 2026 FV", prospectType: "Hitter", fv: "65", eta: 2027, adjustment: 0,
  },
  mcgonigle: {
    id: "mcgonigle", kind: "prospect", name: "Kevin McGonigle", team: "DET", position: "3B", age: 21,
    source: "FanGraphs 2026 FV", prospectType: "Hitter", fv: "60", eta: 2026, adjustment: 0,
  },
  devries: {
    id: "devries", kind: "prospect", name: "Leo De Vries", team: "ATH", position: "SS", age: 19,
    source: "FanGraphs 2026 FV", prospectType: "Hitter", fv: "60", eta: 2027, adjustment: 0,
  },
  mclean: {
    id: "mclean", kind: "prospect", name: "Nolan McLean", team: "NYM", position: "SP", age: 25,
    source: "FanGraphs 2026 FV", prospectType: "Pitcher", fv: "65", eta: 2026, adjustment: 0,
  },
};

const initialSettings: ModelSettings = {
  dollarsPerWar: 12,
  freeWar: 0.5,
  discountRate: 8,
  inflation: 3,
  minimumSalary: 0.78,
};

const money = (value: number) => `${value < 0 ? "−" : ""}$${Math.abs(value).toFixed(1)}M`;
const signedMoney = (value: number) => `${value >= 0 ? "+" : "−"}$${Math.abs(value).toFixed(1)}M`;
const deepCopy = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

function valuePlayer(player: Player, settings: ModelSettings): ValueResult {
  if (player.kind === "prospect") {
    const tier = prospectValues[player.fv]?.[player.prospectType] ?? prospectValues["40"][player.prospectType];
    const yearsAway = Math.max(0, player.eta - BASE_YEAR);
    const discount = 1 / Math.pow(1 + settings.discountRate / 100, yearsAway);
    const total = tier.value * (1 + player.adjustment / 100) * discount;
    const uncertainty = 0.23 + yearsAway * 0.04 + (player.prospectType === "Pitcher" ? 0.06 : 0);
    return {
      total,
      low: Math.max(0, total * (1 - uncertainty)),
      high: total * (1 + uncertainty),
      expectedWar: tier.war,
      starOdds: tier.star,
      rows: [],
    };
  }

  const rows: ValueResult["rows"] = [];
  let priorSalary = 0;
  player.seasons.forEach((season, index) => {
    const yearsOut = Math.max(0, season.year - BASE_YEAR);
    const inflationFactor = Math.pow(1 + settings.inflation / 100, yearsOut);
    const discountFactor = 1 / Math.pow(1 + settings.discountRate / 100, yearsOut);
    const playableWar = Math.max(0, season.war - settings.freeWar);
    const market = playableWar * settings.dollarsPerWar * inflationFactor * (1 - player.risk / 100);
    const floor = settings.minimumSalary * inflationFactor;
    let salary = season.salary;
    if (season.salaryMode === "prearb") salary = season.salary || floor;
    if (season.salaryMode.startsWith("arb")) {
      const previous = player.seasons[Math.max(0, index - 1)];
      const priorMarket = Math.max(0, previous.war - settings.freeWar) * settings.dollarsPerWar * inflationFactor;
      salary = Math.max(floor, priorSalary, priorMarket * arbRates[season.salaryMode]);
    }
    priorSalary = salary;
    rows.push({ year: season.year, war: season.war, market, salary, surplus: (market - salary) * discountFactor });
  });
  const total = rows.reduce((sum, row) => sum + row.surplus, 0);
  const uncertainty = 0.1 + player.risk / 200;
  return {
    total,
    low: total >= 0 ? total * (1 - uncertainty) : total * (1 + uncertainty),
    high: total >= 0 ? total * (1 + uncertainty) : total * (1 - uncertainty),
    rows,
  };
}

function NumericField({ value, onChange, step = 0.1, min, label }: { value: number; onChange: (value: number) => void; step?: number; min?: number; label: string }) {
  return <input aria-label={label} className="compact-input" type="number" value={value} step={step} min={min} onChange={(event) => onChange(Number(event.target.value))} />;
}

export default function Home() {
  const [players, setPlayers] = useState<Record<string, Player>>(() => deepCopy(seedPlayers));
  const [leftIds, setLeftIds] = useState<string[]>(["skenes"]);
  const [rightIds, setRightIds] = useState<string[]>(["julio"]);
  const [leftTeam, setLeftTeam] = useState("Seattle");
  const [rightTeam, setRightTeam] = useState("Pittsburgh");
  const [selectedId, setSelectedId] = useState<string>("skenes");
  const [settings, setSettings] = useState<ModelSettings>(initialSettings);
  const [showSettings, setShowSettings] = useState(false);
  const [showMethod, setShowMethod] = useState(false);

  const values = useMemo(() => Object.fromEntries(Object.values(players).map((player) => [player.id, valuePlayer(player, settings)])), [players, settings]);
  const leftTotal = leftIds.reduce((sum, id) => sum + (values[id]?.total ?? 0), 0);
  const rightTotal = rightIds.reduce((sum, id) => sum + (values[id]?.total ?? 0), 0);
  const difference = leftTotal - rightTotal;
  const gapPercent = Math.abs(difference) / Math.max(1, Math.max(Math.abs(leftTotal), Math.abs(rightTotal)));
  const verdict = gapPercent <= 0.1 ? "Balanced" : gapPercent <= 0.2 ? "Within range" : "Value gap";
  const selected = players[selectedId];

  const allYears = Array.from(new Set([
    ...leftIds.flatMap((id) => values[id]?.rows.map((row) => row.year) ?? (players[id]?.kind === "prospect" ? [players[id].eta] : [])),
    ...rightIds.flatMap((id) => values[id]?.rows.map((row) => row.year) ?? (players[id]?.kind === "prospect" ? [players[id].eta] : [])),
  ])).sort();

  const sideYearValue = (ids: string[], year: number) => ids.reduce((sum, id) => {
    const player = players[id];
    const result = values[id];
    if (!player || !result) return sum;
    if (player.kind === "prospect") return sum + (player.eta === year ? result.total : 0);
    return sum + (result.rows.find((row) => row.year === year)?.surplus ?? 0);
  }, 0);
  const maxYearValue = Math.max(1, ...allYears.flatMap((year) => [Math.abs(sideYearValue(leftIds, year)), Math.abs(sideYearValue(rightIds, year))]));

  const updatePlayer = (id: string, updater: (player: Player) => Player) => setPlayers((current) => ({ ...current, [id]: updater(deepCopy(current[id])) }));

  const addPlayer = (side: "left" | "right", id: string) => {
    if (!id) return;
    if (side === "left") {
      setRightIds((ids) => ids.filter((item) => item !== id));
      setLeftIds((ids) => ids.includes(id) ? ids : [...ids, id]);
    } else {
      setLeftIds((ids) => ids.filter((item) => item !== id));
      setRightIds((ids) => ids.includes(id) ? ids : [...ids, id]);
    }
    setSelectedId(id);
  };

  const addCustom = (side: "left" | "right", kind: "mlb" | "prospect") => {
    const id = `custom-${Date.now()}`;
    const player: Player = kind === "mlb" ? {
      id, kind: "mlb", name: "Custom MLB player", team: "—", position: "UTIL", age: 27,
      source: "Manual input", risk: 8,
      seasons: [{ year: 2026, war: 2.5, salary: 1, salaryMode: "fixed" }],
    } : {
      id, kind: "prospect", name: "Custom prospect", team: "—", position: "SS", age: 20,
      source: "Manual FV grade", prospectType: "Hitter", fv: "50", eta: 2027, adjustment: 0,
    };
    setPlayers((current) => ({ ...current, [id]: player }));
    if (side === "left") setLeftIds((ids) => [...ids, id]); else setRightIds((ids) => [...ids, id]);
    setSelectedId(id);
  };

  const removePlayer = (side: "left" | "right", id: string) => {
    if (side === "left") setLeftIds((ids) => ids.filter((item) => item !== id)); else setRightIds((ids) => ids.filter((item) => item !== id));
    if (selectedId === id) setSelectedId("");
  };

  const resetTrade = () => {
    setPlayers(deepCopy(seedPlayers));
    setLeftIds(["skenes"]);
    setRightIds(["julio"]);
    setLeftTeam("Seattle");
    setRightTeam("Pittsburgh");
    setSettings(initialSettings);
    setSelectedId("skenes");
  };

  const renderPlayerCard = (id: string, side: "left" | "right") => {
    const player = players[id];
    const result = values[id];
    if (!player || !result) return null;
    return (
      <article className={`player-card ${selectedId === id ? "is-selected" : ""}`} key={id}>
        <button className="player-main" onClick={() => setSelectedId(id)} aria-label={`Edit ${player.name}`}>
          <span className="player-avatar" aria-hidden="true">{player.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span>
          <span className="player-copy">
            <strong>{player.name}</strong>
            <small>{player.team} · {player.position} · Age {player.age} · {player.kind === "prospect" ? `${player.fv} FV` : `${player.seasons.length} yrs`}</small>
            <span className="value-range">Range {money(result.low)}–{money(result.high)}</span>
          </span>
          <span className="player-value">{money(result.total)}<small>surplus</small></span>
        </button>
        <button className="remove-button" onClick={() => removePlayer(side, id)} aria-label={`Remove ${player.name}`}>×</button>
      </article>
    );
  };

  const availablePlayers = Object.values(players).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <main>
      <header className="masthead">
        <a className="brand" href="#top" aria-label="Dugout Value home"><span className="brand-ball" aria-hidden="true" />Dugout <b>Value</b></a>
        <nav aria-label="Main navigation">
          <button className="nav-button" onClick={() => setShowMethod((value) => !value)}>Methodology</button>
          <button className="nav-button" onClick={resetTrade}>New trade</button>
        </nav>
      </header>

      <div className="page" id="top">
        <section className="intro">
          <div>
            <p className="kicker">A transparent baseball trade calculator</p>
            <h1>See the value behind every trade.</h1>
            <p className="lede">Compare contract surplus, model arbitration salaries, and translate FanGraphs prospect grades—then open every number and make it yours.</p>
          </div>
          <div className="snapshot"><span>Model snapshot</span><strong>July 14, 2026</strong><small>Seed records are editable estimates</small></div>
        </section>

        <section className="model-strip" aria-label="Current model settings">
          <div><span>Market rate</span><strong>${settings.dollarsPerWar}M / WAR</strong></div>
          <div><span>Free production</span><strong>{settings.freeWar} WAR / year</strong></div>
          <div><span>WAR source</span><strong>FanGraphs preferred</strong></div>
          <div><span>Arbitration</span><strong>15 / 35 / 50 / 75%</strong></div>
          <button onClick={() => setShowSettings((value) => !value)}>{showSettings ? "Close assumptions" : "Edit assumptions"}</button>
        </section>

        {showSettings && (
          <section className="assumption-panel" aria-label="Model assumptions">
            <label><span>Dollars per WAR</span><NumericField label="Dollars per WAR in millions" value={settings.dollarsPerWar} min={0} onChange={(value) => setSettings({ ...settings, dollarsPerWar: value })} /></label>
            <label><span>Free WAR each year</span><NumericField label="Free WAR each year" value={settings.freeWar} min={0} onChange={(value) => setSettings({ ...settings, freeWar: value })} /></label>
            <label><span>Discount rate</span><NumericField label="Discount rate percent" value={settings.discountRate} min={0} onChange={(value) => setSettings({ ...settings, discountRate: value })} /><em>%</em></label>
            <label><span>WAR-price inflation</span><NumericField label="WAR price inflation percent" value={settings.inflation} min={0} onChange={(value) => setSettings({ ...settings, inflation: value })} /><em>%</em></label>
            <label><span>2026 minimum salary</span><NumericField label="2026 minimum salary in millions" value={settings.minimumSalary} min={0} onChange={(value) => setSettings({ ...settings, minimumSalary: value })} /><em>M</em></label>
            <p>Field value = max(WAR − free WAR, 0) × $/WAR × risk adjustment. Future values are inflated, discounted, then salary is subtracted.</p>
          </section>
        )}

        <section className="trade-shell" aria-label="Trade builder">
          <div className="trade-board">
            <div className="trade-sides">
              <section className="trade-side left-side">
                <div className="side-heading">
                  <div><span>Club A receives</span><input aria-label="Club A name" value={leftTeam} onChange={(event) => setLeftTeam(event.target.value)} /></div>
                  <strong>{money(leftTotal)}</strong>
                </div>
                <div className="player-stack">{leftIds.map((id) => renderPlayerCard(id, "left"))}</div>
                <div className="add-row">
                  <select aria-label={`Add player to ${leftTeam}`} value="" onChange={(event) => addPlayer("left", event.target.value)}>
                    <option value="">+ Add from player library</option>
                    {availablePlayers.filter((player) => !leftIds.includes(player.id)).map((player) => <option key={player.id} value={player.id}>{player.name} · {player.team} · {player.kind === "prospect" ? `${player.fv} FV` : player.position}</option>)}
                  </select>
                  <button onClick={() => addCustom("left", "mlb")}>Custom MLB</button><button onClick={() => addCustom("left", "prospect")}>Custom prospect</button>
                </div>
              </section>

              <div className="trade-verdict" aria-live="polite">
                <span className={`verdict-stamp ${verdict === "Balanced" ? "balanced" : ""}`}>{verdict}</span>
                <strong>{signedMoney(Math.abs(difference))}</strong>
                <p>{difference === 0 ? "Even exchange" : `edge to ${difference > 0 ? leftTeam : rightTeam}`}</p>
                <div className="balance-track" aria-label={`${(gapPercent * 100).toFixed(0)} percent value gap`}><i style={{ left: `${Math.max(4, Math.min(96, 50 + (difference / Math.max(1, Math.abs(leftTotal) + Math.abs(rightTotal))) * 100))}%` }} /></div>
                <button onClick={() => { const oldLeft = leftIds; setLeftIds(rightIds); setRightIds(oldLeft); const oldName = leftTeam; setLeftTeam(rightTeam); setRightTeam(oldName); }}>Swap sides</button>
              </div>

              <section className="trade-side right-side">
                <div className="side-heading">
                  <div><span>Club B receives</span><input aria-label="Club B name" value={rightTeam} onChange={(event) => setRightTeam(event.target.value)} /></div>
                  <strong>{money(rightTotal)}</strong>
                </div>
                <div className="player-stack">{rightIds.map((id) => renderPlayerCard(id, "right"))}</div>
                <div className="add-row">
                  <select aria-label={`Add player to ${rightTeam}`} value="" onChange={(event) => addPlayer("right", event.target.value)}>
                    <option value="">+ Add from player library</option>
                    {availablePlayers.filter((player) => !rightIds.includes(player.id)).map((player) => <option key={player.id} value={player.id}>{player.name} · {player.team} · {player.kind === "prospect" ? `${player.fv} FV` : player.position}</option>)}
                  </select>
                  <button onClick={() => addCustom("right", "mlb")}>Custom MLB</button><button onClick={() => addCustom("right", "prospect")}>Custom prospect</button>
                </div>
              </section>
            </div>

            <section className="year-ledger" aria-labelledby="ledger-title">
              <div className="section-title"><div><span>Control-year ledger</span><h2 id="ledger-title">Where the surplus lives</h2></div><p>Prospect value appears in the ETA year; MLB value is shown by control year.</p></div>
              {allYears.length ? <div className="ledger-table" role="table" aria-label="Annual surplus value comparison">
                <div className="ledger-row ledger-head" role="row"><span role="columnheader">Year</span><span role="columnheader">{leftTeam}</span><span role="columnheader">Annual comparison</span><span role="columnheader">{rightTeam}</span></div>
                {allYears.map((year) => {
                  const leftValue = sideYearValue(leftIds, year);
                  const rightValue = sideYearValue(rightIds, year);
                  return <div className="ledger-row" role="row" key={year}>
                    <strong role="cell">{year}</strong><span role="cell">{money(leftValue)}</span>
                    <div className="year-bars" role="cell" aria-label={`${leftTeam} ${money(leftValue)}, ${rightTeam} ${money(rightValue)}`}><i className="left-bar" style={{ width: `${Math.max(2, Math.abs(leftValue) / maxYearValue * 48)}%` }} /><b /><i className="right-bar" style={{ width: `${Math.max(2, Math.abs(rightValue) / maxYearValue * 48)}%` }} /></div>
                    <span role="cell">{money(rightValue)}</span>
                  </div>;
                })}
              </div> : <p className="empty-ledger">Add players to both sides to compare their control-year value.</p>}
            </section>
          </div>

          <aside className="editor" aria-label="Player value editor">
            {selected ? <>
              <div className="editor-heading"><div><span>{selected.kind === "mlb" ? "Major leaguer" : "Prospect"} editor</span><h2>{selected.name}</h2></div><span className="live-dot">Live</span></div>
              <div className="form-grid two-col">
                <label><span>Name</span><input value={selected.name} onChange={(event) => updatePlayer(selected.id, (player) => ({ ...player, name: event.target.value }))} /></label>
                <label><span>Team</span><input value={selected.team} onChange={(event) => updatePlayer(selected.id, (player) => ({ ...player, team: event.target.value }))} /></label>
                <label><span>Position</span><input value={selected.position} onChange={(event) => updatePlayer(selected.id, (player) => ({ ...player, position: event.target.value }))} /></label>
                <label><span>Age</span><NumericField label={`${selected.name} age`} value={selected.age} step={1} min={15} onChange={(value) => updatePlayer(selected.id, (player) => ({ ...player, age: value }))} /></label>
              </div>
              <label className="wide-field"><span>Data note / source</span><input value={selected.source} onChange={(event) => updatePlayer(selected.id, (player) => ({ ...player, source: event.target.value }))} /></label>

              {selected.kind === "mlb" ? <>
                <div className="risk-field"><label htmlFor="risk">Availability & injury haircut <strong>{selected.risk}%</strong></label><input id="risk" type="range" min="0" max="40" value={selected.risk} onChange={(event) => updatePlayer(selected.id, (player) => player.kind === "mlb" ? { ...player, risk: Number(event.target.value) } : player)} /></div>
                <div className="projection-title"><div><span>Annual projection</span><small>Salary modes project automatically; fixed uses your input.</small></div><button onClick={() => updatePlayer(selected.id, (player) => player.kind === "mlb" ? { ...player, seasons: [...player.seasons, { year: Math.max(BASE_YEAR, ...player.seasons.map((season) => season.year)) + 1, war: 2, salary: 1, salaryMode: "fixed" }] } : player)}>+ Year</button></div>
                <div className="projection-table">
                  <div className="projection-row projection-head"><span>Year</span><span>fWAR</span><span>Pay type</span><span>Salary</span><span>Surplus</span></div>
                  {selected.seasons.map((season, index) => {
                    const resultRow = values[selected.id]?.rows[index];
                    return <div className="projection-row" key={`${season.year}-${index}`}>
                      <NumericField label={`Season ${index + 1} year`} value={season.year} step={1} min={BASE_YEAR} onChange={(value) => updatePlayer(selected.id, (player) => player.kind === "mlb" ? { ...player, seasons: player.seasons.map((item, itemIndex) => itemIndex === index ? { ...item, year: value } : item) } : player)} />
                      <NumericField label={`${season.year} projected WAR`} value={season.war} onChange={(value) => updatePlayer(selected.id, (player) => player.kind === "mlb" ? { ...player, seasons: player.seasons.map((item, itemIndex) => itemIndex === index ? { ...item, war: value } : item) } : player)} />
                      <select aria-label={`${season.year} salary type`} value={season.salaryMode} onChange={(event) => updatePlayer(selected.id, (player) => player.kind === "mlb" ? { ...player, seasons: player.seasons.map((item, itemIndex) => itemIndex === index ? { ...item, salaryMode: event.target.value as SalaryMode } : item) } : player)}><option value="fixed">Fixed</option><option value="prearb">Pre-arb</option><option value="arb1">Arb 1</option><option value="arb2">Arb 2</option><option value="arb3">Arb 3</option><option value="arb4">Arb 4</option></select>
                      {season.salaryMode === "fixed" ? <NumericField label={`${season.year} salary in millions`} value={season.salary} min={0} onChange={(value) => updatePlayer(selected.id, (player) => player.kind === "mlb" ? { ...player, seasons: player.seasons.map((item, itemIndex) => itemIndex === index ? { ...item, salary: value } : item) } : player)} /> : <span className="modelled-pay">{money(resultRow?.salary ?? 0)}</span>}
                      <strong>{money(resultRow?.surplus ?? 0)}</strong>
                    </div>;
                  })}
                </div>
                <div className="math-box"><span>Projected surplus</span><strong>{money(values[selected.id]?.total ?? 0)}</strong><p>Range {money(values[selected.id]?.low ?? 0)}–{money(values[selected.id]?.high ?? 0)}</p></div>
              </> : <>
                <div className="form-grid two-col prospect-fields">
                  <label><span>FanGraphs FV</span><select value={selected.fv} onChange={(event) => updatePlayer(selected.id, (player) => player.kind === "prospect" ? { ...player, fv: event.target.value } : player)}>{Object.keys(prospectValues).map((fv) => <option key={fv} value={fv}>{fv} FV</option>)}</select></label>
                  <label><span>Player type</span><select value={selected.prospectType} onChange={(event) => updatePlayer(selected.id, (player) => player.kind === "prospect" ? { ...player, prospectType: event.target.value as ProspectType } : player)}><option>Hitter</option><option>Pitcher</option></select></label>
                  <label><span>MLB ETA</span><NumericField label="Prospect MLB ETA" value={selected.eta} step={1} min={BASE_YEAR} onChange={(value) => updatePlayer(selected.id, (player) => player.kind === "prospect" ? { ...player, eta: value } : player)} /></label>
                  <label><span>Scout adjustment</span><span className="percent-field"><NumericField label="Scout adjustment percent" value={selected.adjustment} step={1} onChange={(value) => updatePlayer(selected.id, (player) => player.kind === "prospect" ? { ...player, adjustment: value } : player)} />%</span></label>
                </div>
                <div className="prospect-output"><div><span>Expected surplus</span><strong>{money(values[selected.id]?.total ?? 0)}</strong></div><div><span>Team-control WAR</span><strong>{values[selected.id]?.expectedWar?.toFixed(1)}</strong></div><div><span>Star odds</span><strong>{values[selected.id]?.starOdds?.toFixed(1)}%</strong></div></div>
                <p className="editor-note">Prospect baselines use FanGraphs’ July 2026 historical FV outcomes, split between hitters and pitchers. ETA and your scout adjustment are applied transparently.</p>
              </>}
            </> : <div className="editor-empty"><span className="brand-ball" aria-hidden="true" /><h2>Select a player</h2><p>Open any player card to audit or edit the assumptions behind the value.</p></div>}
          </aside>
        </section>

        {showMethod && <section className="methodology" id="methodology">
          <div className="section-title"><div><span>Open model</span><h2>How Dugout Value thinks</h2></div><button onClick={() => setShowMethod(false)}>Close</button></div>
          <div className="method-grid">
            <article><b>01</b><h3>Major-league value</h3><p>Start with annual FanGraphs WAR when available. The first {settings.freeWar} WAR is free; production above it is priced at ${settings.dollarsPerWar}M per win. Apply the visible risk haircut, subtract salary, and discount future years.</p></article>
            <article><b>02</b><h3>Arbitration pay</h3><p>Pre-arb seasons use the league minimum. Arb 1–4 use 15%, 35%, 50%, and 75% of the prior season’s market WAR value, with no modelled pay cut. Every result remains editable.</p></article>
            <article><b>03</b><h3>Prospect value</h3><p>Map a FanGraphs Future Value grade to the 2026 historical surplus table, separately for hitters and pitchers. Then discount to ETA and apply an explicit scouting adjustment—not a hidden rank multiplier.</p></article>
          </div>
          <div className="source-list"><span>Primary references</span><a href="https://www.fangraphs.com/projections" target="_blank" rel="noreferrer">FanGraphs projections ↗</a><a href="https://blogs.fangraphs.com/introducing-an-updated-method-for-prospect-valuation/" target="_blank" rel="noreferrer">2026 FanGraphs prospect values ↗</a><a href="https://www.mlb.com/glossary/transactions/salary-arbitration" target="_blank" rel="noreferrer">MLB arbitration rules ↗</a><a href="https://legacy.baseballprospectus.com/compensation/cots/" target="_blank" rel="noreferrer">Cot’s contract reference ↗</a></div>
        </section>}

        <footer><div className="brand">Dugout <b>Value</b></div><p>A decision aid, not a claim about any club’s private model. Verify live contracts, options, service time, injuries, and projection updates before relying on a result.</p></footer>
      </div>
    </main>
  );
}
