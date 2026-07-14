"use client";

import { useMemo, useState } from "react";
import databaseJson from "./data/player-database.json";

type SalaryMode = "fixed" | "prearb" | "arb1" | "arb2" | "arb3" | "arb4";
type ProspectType = "Hitter" | "Pitcher";
type Provenance = { projection: string; contract: string; refreshed: string };
type MLBSeason = { year: number; war: number; salary: number; salaryMode: SalaryMode };
type MLBPlayer = { id: string; kind: "mlb"; name: string; team: string; position: string; age: number; source: Provenance; risk: number; seasons: MLBSeason[]; custom?: boolean };
type ProspectPlayer = { id: string; kind: "prospect"; name: string; team: string; position: string; age: number; source: Provenance; prospectType: ProspectType; fv: string; eta: number; adjustment: number; rank?: number | null; custom?: boolean };
type Player = MLBPlayer | ProspectPlayer;
type Team = { abbr: string; name: string };
type ModelSettings = { dollarsPerWar: number; freeWar: number; discountRate: number; inflation: number; minimumSalary: number };
type ValueResult = { total: number; low: number; high: number; expectedWar?: number; starOdds?: number; rows: Array<{ year: number; war: number; market: number; salary: number; surplus: number }> };
type Database = { meta: { refreshed: string; baseYear: number; mlbCount: number; prospectCount: number; projectionPriority: string[] }; teams: Team[]; players: Player[] };

const database = databaseJson as unknown as Database;
const BASE_YEAR = database.meta.baseYear;
const initialPlayers = Object.fromEntries(database.players.map((player) => [player.id, player]));
const initialSettings: ModelSettings = { dollarsPerWar: 12, freeWar: 0.5, discountRate: 8, inflation: 3, minimumSalary: 0.78 };
const arbRates: Record<SalaryMode, number> = { fixed: 0, prearb: 0, arb1: .15, arb2: .35, arb3: .5, arb4: .75 };
const prospectValues: Record<string, Record<ProspectType, { value: number; war: number; star: number }>> = {
  "70": { Hitter: { value: 195, war: 27.5, star: 87.5 }, Pitcher: { value: 195, war: 27, star: 87.5 } },
  "65": { Hitter: { value: 95, war: 13.5, star: 40 }, Pitcher: { value: 95, war: 13.5, star: 40 } },
  "60": { Hitter: { value: 82, war: 12.5, star: 33 }, Pitcher: { value: 70, war: 11, star: 21 } },
  "55": { Hitter: { value: 55, war: 8, star: 17.5 }, Pitcher: { value: 45, war: 7, star: 7 } },
  "50": { Hitter: { value: 45, war: 7, star: 13.5 }, Pitcher: { value: 33.5, war: 5, star: 7 } },
  "45+": { Hitter: { value: 18.5, war: 3.2, star: 6 }, Pitcher: { value: 15, war: 2.6, star: 3 } },
  "45": { Hitter: { value: 14.5, war: 2.5, star: 3.5 }, Pitcher: { value: 9.5, war: 1.6, star: 1.5 } },
  "40+": { Hitter: { value: 8, war: 1.2, star: 1.8 }, Pitcher: { value: 7, war: 1, star: 1 } },
  "40": { Hitter: { value: 5.5, war: .75, star: .8 }, Pitcher: { value: 4, war: .55, star: .4 } },
  "35+": { Hitter: { value: 2, war: .3, star: .4 }, Pitcher: { value: 1.5, war: .25, star: .4 } },
};

const money = (value: number) => `${value < 0 ? "−" : ""}$${Math.abs(value).toFixed(1)}M`;
const signedMoney = (value: number) => `${value >= 0 ? "+" : "−"}$${Math.abs(value).toFixed(1)}M`;
const deepCopy = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const prettyDate = (date: string) => new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));

function valuePlayer(player: Player, settings: ModelSettings): ValueResult {
  if (player.kind === "prospect") {
    const tier = prospectValues[player.fv]?.[player.prospectType] ?? prospectValues["40"][player.prospectType];
    const yearsAway = Math.max(0, player.eta - BASE_YEAR);
    const total = tier.value * (1 + player.adjustment / 100) / Math.pow(1 + settings.discountRate / 100, yearsAway);
    const uncertainty = .23 + yearsAway * .04 + (player.prospectType === "Pitcher" ? .06 : 0);
    return { total, low: Math.max(0, total * (1 - uncertainty)), high: total * (1 + uncertainty), expectedWar: tier.war, starOdds: tier.star, rows: [] };
  }
  const rows: ValueResult["rows"] = [];
  let priorSalary = 0;
  player.seasons.forEach((season, index) => {
    const yearsOut = Math.max(0, season.year - BASE_YEAR);
    const inflation = Math.pow(1 + settings.inflation / 100, yearsOut);
    const discount = 1 / Math.pow(1 + settings.discountRate / 100, yearsOut);
    const market = Math.max(0, season.war - settings.freeWar) * settings.dollarsPerWar * inflation * (1 - player.risk / 100);
    const floor = settings.minimumSalary * inflation;
    let salary = season.salary;
    if (season.salaryMode === "prearb") salary = salary || floor;
    if (season.salaryMode.startsWith("arb")) {
      const previous = player.seasons[Math.max(0, index - 1)];
      const priorMarket = Math.max(0, previous.war - settings.freeWar) * settings.dollarsPerWar * inflation;
      salary = Math.max(floor, priorSalary, season.salary || 0, priorMarket * arbRates[season.salaryMode]);
    }
    priorSalary = salary;
    rows.push({ year: season.year, war: season.war, market, salary, surplus: (market - salary) * discount });
  });
  const total = rows.reduce((sum, row) => sum + row.surplus, 0);
  const uncertainty = .1 + player.risk / 200;
  return { total, low: total >= 0 ? total * (1 - uncertainty) : total * (1 + uncertainty), high: total >= 0 ? total * (1 + uncertainty) : total * (1 - uncertainty), rows };
}

function NumericField({ value, onChange, step = .1, min, label }: { value: number; onChange: (value: number) => void; step?: number; min?: number; label: string }) {
  return <input aria-label={label} className="compact-input" type="number" value={value} step={step} min={min} onChange={(event) => onChange(Number(event.target.value))} />;
}

export default function Home() {
  const [players, setPlayers] = useState<Record<string, Player>>(() => deepCopy(initialPlayers));
  const [leftTeam, setLeftTeam] = useState("SEA");
  const [rightTeam, setRightTeam] = useState("PIT");
  const [leftIds, setLeftIds] = useState<string[]>(["mlb-677594"]);
  const [rightIds, setRightIds] = useState<string[]>(["mlb-694973"]);
  const [selectedId, setSelectedId] = useState("mlb-694973");
  const [settings, setSettings] = useState(initialSettings);
  const [showSettings, setShowSettings] = useState(false);
  const [showMethod, setShowMethod] = useState(false);

  const teamName = (abbr: string) => database.teams.find((team) => team.abbr === abbr)?.name ?? abbr;
  const values = useMemo(() => Object.fromEntries(Object.values(players).map((player) => [player.id, valuePlayer(player, settings)])), [players, settings]);
  const leftTotal = leftIds.reduce((sum, id) => sum + (values[id]?.total ?? 0), 0);
  const rightTotal = rightIds.reduce((sum, id) => sum + (values[id]?.total ?? 0), 0);
  const difference = leftTotal - rightTotal;
  const gapPercent = Math.abs(difference) / Math.max(1, Math.max(Math.abs(leftTotal), Math.abs(rightTotal)));
  const verdict = gapPercent <= .1 ? "Balanced" : gapPercent <= .2 ? "Within range" : "Value gap";
  const selected = players[selectedId];
  const allYears = Array.from(new Set([...leftIds, ...rightIds].flatMap((id) => values[id]?.rows.map((row) => row.year) ?? (players[id]?.kind === "prospect" ? [players[id].eta] : [])))).sort();
  const sideYearValue = (ids: string[], year: number) => ids.reduce((sum, id) => {
    const player = players[id], result = values[id];
    if (!player || !result) return sum;
    return sum + (player.kind === "prospect" ? (player.eta === year ? result.total : 0) : result.rows.find((row) => row.year === year)?.surplus ?? 0);
  }, 0);
  const maxYearValue = Math.max(1, ...allYears.flatMap((year) => [Math.abs(sideYearValue(leftIds, year)), Math.abs(sideYearValue(rightIds, year))]));
  const updatePlayer = (id: string, updater: (player: Player) => Player) => setPlayers((current) => ({ ...current, [id]: updater(deepCopy(current[id])) }));
  const libraryFor = (team: string, used: string[]) => Object.values(players).filter((player) => player.team === team && !used.includes(player.id)).sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name));

  const addPlayer = (side: "left" | "right", id: string) => {
    if (!id) return;
    (side === "left" ? setLeftIds : setRightIds)((ids) => ids.includes(id) ? ids : [...ids, id]);
    setSelectedId(id);
  };
  const removePlayer = (side: "left" | "right", id: string) => {
    (side === "left" ? setLeftIds : setRightIds)((ids) => ids.filter((item) => item !== id));
    if (selectedId === id) setSelectedId("");
  };
  const changeTeam = (side: "left" | "right", team: string) => {
    if (side === "left") {
      if (team === rightTeam) { setRightTeam(leftTeam); setRightIds([]); }
      setLeftTeam(team); setLeftIds([]);
    } else {
      if (team === leftTeam) { setLeftTeam(rightTeam); setLeftIds([]); }
      setRightTeam(team); setRightIds([]);
    }
    setSelectedId("");
  };
  const addCustom = (side: "left" | "right", kind: "mlb" | "prospect") => {
    const id = `custom-${Date.now()}`;
    const team = side === "left" ? leftTeam : rightTeam;
    const source = { projection: "Manual entry", contract: "Manual entry", refreshed: database.meta.refreshed };
    const player: Player = kind === "mlb"
      ? { id, kind, custom: true, name: "Custom MLB player", team, position: "UTIL", age: 27, source, risk: 8, seasons: [{ year: BASE_YEAR, war: 2.5, salary: 1, salaryMode: "fixed" }] }
      : { id, kind, custom: true, name: "Custom prospect", team, position: "SS", age: 20, source, prospectType: "Hitter", fv: "50", eta: BASE_YEAR + 1, adjustment: 0 };
    setPlayers((current) => ({ ...current, [id]: player }));
    addPlayer(side, id);
  };
  const resetTrade = () => {
    setPlayers(deepCopy(initialPlayers)); setLeftTeam("SEA"); setRightTeam("PIT"); setLeftIds(["mlb-677594"]); setRightIds(["mlb-694973"]); setSelectedId("mlb-694973"); setSettings(initialSettings);
  };

  const renderCard = (id: string, side: "left" | "right") => {
    const player = players[id], result = values[id];
    if (!player || !result) return null;
    return <article className={`player-card ${selectedId === id ? "is-selected" : ""}`} key={id}>
      <button className="player-main" onClick={() => setSelectedId(id)} aria-label={`Edit ${player.name}`}>
        <span className="player-avatar" aria-hidden="true">{player.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span>
        <span className="player-copy"><strong>{player.name}</strong><small>{player.position} · Age {player.age} · {player.kind === "prospect" ? `${player.fv} FV` : `${player.seasons.length} control yrs`}</small><span className="value-range">Range {money(result.low)}–{money(result.high)}</span></span>
        <span className="player-value">{money(result.total)}<small>surplus</small></span>
      </button>
      <button className="remove-button" onClick={() => removePlayer(side, id)} aria-label={`Remove ${player.name}`}>×</button>
    </article>;
  };

  const TeamSide = ({ side, team, ids, total }: { side: "left" | "right"; team: string; ids: string[]; total: number }) => {
    const available = libraryFor(team, ids);
    return <section className={`trade-side ${side}-side`}>
      <div className="side-heading">
        <div><span>Trading team</span><select className="team-select" aria-label={`${side} trading team`} value={team} onChange={(event) => changeTeam(side, event.target.value)}>{database.teams.map((item) => <option key={item.abbr} value={item.abbr}>{item.name}</option>)}</select><small>{teamName(team)} sends</small></div>
        <strong>{money(total)}</strong>
      </div>
      <div className="player-stack">{ids.map((id) => renderCard(id, side))}</div>
      <div className="add-row">
        <select aria-label={`Add a ${teamName(team)} player`} value="" onChange={(event) => addPlayer(side, event.target.value)}>
          <option value="">+ Add a {team} player</option>
          <optgroup label="Major-league projections">{available.filter((player) => player.kind === "mlb").map((player) => <option key={player.id} value={player.id}>{player.name} · {player.position} · {player.source.projection}</option>)}</optgroup>
          <optgroup label="Prospects — The Board">{available.filter((player) => player.kind === "prospect").map((player) => <option key={player.id} value={player.id}>{player.name} · {player.position} · {player.fv} FV</option>)}</optgroup>
        </select>
        <button onClick={() => addCustom(side, "mlb")}>Custom MLB</button><button onClick={() => addCustom(side, "prospect")}>Custom prospect</button>
      </div>
    </section>;
  };

  return <main>
    <header className="masthead"><a className="brand" href="#top"><span className="brand-ball" aria-hidden="true" />Dugout <b>Value</b></a><nav><button className="nav-button" onClick={() => setShowMethod((value) => !value)}>Methodology</button><button className="nav-button" onClick={resetTrade}>New trade</button></nav></header>
    <div className="page" id="top">
      <section className="intro"><div><p className="kicker">A transparent baseball trade calculator</p><h1>See the value behind every trade.</h1><p className="lede">Choose two clubs, build the packages they send, then audit every WAR, salary, arbitration, and prospect assumption.</p></div><div className="snapshot"><span>Built-in player library</span><strong>{(database.meta.mlbCount + database.meta.prospectCount).toLocaleString()} records</strong><small>{database.meta.mlbCount.toLocaleString()} projected players · {database.meta.prospectCount.toLocaleString()} prospects<br />Refreshed {prettyDate(database.meta.refreshed)}</small></div></section>
      <section className="model-strip"><div><span>Market rate</span><strong>${settings.dollarsPerWar}M / WAR</strong></div><div><span>Free production</span><strong>{settings.freeWar} WAR / year</strong></div><div><span>Projection order</span><strong>ZiPS → Steamer → Marcel</strong></div><div><span>Salary source</span><strong>RosterResource + arb model</strong></div><button onClick={() => setShowSettings((value) => !value)}>{showSettings ? "Close assumptions" : "Edit assumptions"}</button></section>
      {showSettings && <section className="assumption-panel"><label><span>Dollars per WAR</span><NumericField label="Dollars per WAR" value={settings.dollarsPerWar} min={0} onChange={(value) => setSettings({ ...settings, dollarsPerWar: value })} /></label><label><span>Free WAR each year</span><NumericField label="Free WAR" value={settings.freeWar} min={0} onChange={(value) => setSettings({ ...settings, freeWar: value })} /></label><label><span>Discount rate</span><NumericField label="Discount rate" value={settings.discountRate} min={0} onChange={(value) => setSettings({ ...settings, discountRate: value })} /><em>%</em></label><label><span>WAR-price inflation</span><NumericField label="WAR inflation" value={settings.inflation} min={0} onChange={(value) => setSettings({ ...settings, inflation: value })} /><em>%</em></label><label><span>2026 minimum salary</span><NumericField label="Minimum salary" value={settings.minimumSalary} min={0} onChange={(value) => setSettings({ ...settings, minimumSalary: value })} /><em>M</em></label><p>Field value = max(fWAR − free WAR, 0) × $/WAR × availability adjustment. Salary is subtracted after inflation and discounting.</p></section>}

      <section className="trade-shell">
        <div className="trade-board">
          <div className="package-explainer"><span>Build the outgoing packages</span><strong>{teamName(leftTeam)} sends players on the left. {teamName(rightTeam)} sends players on the right.</strong></div>
          <div className="trade-sides"><TeamSide side="left" team={leftTeam} ids={leftIds} total={leftTotal} /><div className="trade-verdict"><span className={`verdict-stamp ${verdict === "Balanced" ? "balanced" : ""}`}>{verdict}</span><strong>{signedMoney(Math.abs(difference))}</strong><p>{difference === 0 ? "Even exchange" : `${difference > 0 ? teamName(leftTeam) : teamName(rightTeam)} sends more value`}</p><div className="balance-track"><i style={{ left: `${Math.max(4, Math.min(96, 50 + difference / Math.max(1, Math.abs(leftTotal) + Math.abs(rightTotal)) * 100))}%` }} /></div><button onClick={() => { const lt = leftTeam, li = leftIds; setLeftTeam(rightTeam); setLeftIds(rightIds); setRightTeam(lt); setRightIds(li); }}>Swap teams</button></div><TeamSide side="right" team={rightTeam} ids={rightIds} total={rightTotal} /></div>
          <section className="year-ledger"><div className="section-title"><div><span>Control-year ledger</span><h2>Where the surplus lives</h2></div><p>These columns are outgoing value—not what each club receives.</p></div>{allYears.length ? <div className="ledger-table"><div className="ledger-row ledger-head"><span>Year</span><span>{leftTeam} sends</span><span>Annual comparison</span><span>{rightTeam} sends</span></div>{allYears.map((year) => { const lv = sideYearValue(leftIds, year), rv = sideYearValue(rightIds, year); return <div className="ledger-row" key={year}><strong>{year}</strong><span>{money(lv)}</span><div className="year-bars"><i className="left-bar" style={{ width: `${Math.max(2, Math.abs(lv) / maxYearValue * 48)}%` }} /><b /><i className="right-bar" style={{ width: `${Math.max(2, Math.abs(rv) / maxYearValue * 48)}%` }} /></div><span>{money(rv)}</span></div>; })}</div> : <p className="empty-ledger">Add players to compare the packages.</p>}</section>
        </div>

        <aside className="editor">{selected ? <><div className="editor-heading"><div><span>{selected.kind === "mlb" ? "Major leaguer" : "Prospect"} editor</span><h2>{selected.name}</h2></div><span className="live-dot">Live</span></div>
          {selected.custom ? <div className="form-grid two-col"><label><span>Name</span><input value={selected.name} onChange={(event) => updatePlayer(selected.id, (player) => ({ ...player, name: event.target.value }))} /></label><label><span>Position</span><input value={selected.position} onChange={(event) => updatePlayer(selected.id, (player) => ({ ...player, position: event.target.value }))} /></label><label><span>Age</span><NumericField label="Age" value={selected.age} step={1} min={15} onChange={(value) => updatePlayer(selected.id, (player) => ({ ...player, age: value }))} /></label></div> : <div className="identity-card"><span>{selected.team}</span><strong>{selected.position}</strong><small>Age {selected.age}{selected.kind === "prospect" && selected.rank ? ` · No. ${selected.rank} on The Board` : ""}</small></div>}
          <div className="provenance-card" aria-label="Built-in data sources"><div><span>Projection</span><strong>{selected.source.projection}</strong></div><div><span>{selected.kind === "mlb" ? "Contract / control" : "Prospect grades"}</span><strong>{selected.source.contract}</strong></div><small>Locked provenance · refreshed {prettyDate(selected.source.refreshed)}</small></div>
          {selected.kind === "mlb" ? <><div className="risk-field"><label htmlFor="risk">Availability & injury haircut <strong>{selected.risk}%</strong></label><input id="risk" type="range" min="0" max="40" value={selected.risk} onChange={(event) => updatePlayer(selected.id, (player) => player.kind === "mlb" ? { ...player, risk: Number(event.target.value) } : player)} /></div><div className="projection-title"><div><span>Annual fWAR projection</span><small>Future fallback years follow a visible aging curve.</small></div><button onClick={() => updatePlayer(selected.id, (player) => player.kind === "mlb" ? { ...player, seasons: [...player.seasons, { year: Math.max(BASE_YEAR, ...player.seasons.map((season) => season.year)) + 1, war: 2, salary: 1, salaryMode: "fixed" }] } : player)}>+ Year</button></div><div className="projection-table"><div className="projection-row projection-head"><span>Year</span><span>fWAR</span><span>Pay type</span><span>Salary</span><span>Surplus</span></div>{selected.seasons.map((season, index) => { const row = values[selected.id]?.rows[index]; return <div className="projection-row" key={`${season.year}-${index}`}><NumericField label="Year" value={season.year} step={1} min={BASE_YEAR} onChange={(value) => updatePlayer(selected.id, (player) => player.kind === "mlb" ? { ...player, seasons: player.seasons.map((item, i) => i === index ? { ...item, year: value } : item) } : player)} /><NumericField label="Projected fWAR" value={season.war} onChange={(value) => updatePlayer(selected.id, (player) => player.kind === "mlb" ? { ...player, seasons: player.seasons.map((item, i) => i === index ? { ...item, war: value } : item) } : player)} /><select aria-label="Salary type" value={season.salaryMode} onChange={(event) => updatePlayer(selected.id, (player) => player.kind === "mlb" ? { ...player, seasons: player.seasons.map((item, i) => i === index ? { ...item, salaryMode: event.target.value as SalaryMode } : item) } : player)}><option value="fixed">Fixed</option><option value="prearb">Pre-arb</option><option value="arb1">Arb 1</option><option value="arb2">Arb 2</option><option value="arb3">Arb 3</option><option value="arb4">Arb 4</option></select>{season.salaryMode === "fixed" ? <NumericField label="Salary in millions" value={season.salary} min={0} onChange={(value) => updatePlayer(selected.id, (player) => player.kind === "mlb" ? { ...player, seasons: player.seasons.map((item, i) => i === index ? { ...item, salary: value } : item) } : player)} /> : <span className="modelled-pay">{money(row?.salary ?? 0)}</span>}<strong>{money(row?.surplus ?? 0)}</strong></div>; })}</div><div className="math-box"><span>Projected surplus</span><strong>{money(values[selected.id]?.total ?? 0)}</strong><p>Range {money(values[selected.id]?.low ?? 0)}–{money(values[selected.id]?.high ?? 0)}</p></div></> : <><div className="form-grid two-col prospect-fields"><label><span>FanGraphs FV</span><select value={selected.fv} onChange={(event) => updatePlayer(selected.id, (player) => player.kind === "prospect" ? { ...player, fv: event.target.value } : player)}>{Object.keys(prospectValues).map((fv) => <option key={fv}>{fv}</option>)}</select></label><label><span>Player type</span><select value={selected.prospectType} onChange={(event) => updatePlayer(selected.id, (player) => player.kind === "prospect" ? { ...player, prospectType: event.target.value as ProspectType } : player)}><option>Hitter</option><option>Pitcher</option></select></label><label><span>MLB ETA</span><NumericField label="ETA" value={selected.eta} step={1} min={BASE_YEAR} onChange={(value) => updatePlayer(selected.id, (player) => player.kind === "prospect" ? { ...player, eta: value } : player)} /></label><label><span>Scout adjustment</span><span className="percent-field"><NumericField label="Scout adjustment" value={selected.adjustment} step={1} onChange={(value) => updatePlayer(selected.id, (player) => player.kind === "prospect" ? { ...player, adjustment: value } : player)} />%</span></label></div><div className="prospect-output"><div><span>Expected surplus</span><strong>{money(values[selected.id]?.total ?? 0)}</strong></div><div><span>Control WAR</span><strong>{values[selected.id]?.expectedWar?.toFixed(1)}</strong></div><div><span>Star odds</span><strong>{values[selected.id]?.starOdds?.toFixed(1)}%</strong></div></div></>}
        </> : <div className="editor-empty"><span className="brand-ball" /><h2>Select a player</h2><p>Open a player card to audit and edit its valuation assumptions.</p></div>}</aside>
      </section>

      {showMethod && <section className="methodology"><div className="section-title"><div><span>Open model</span><h2>How Dugout Value thinks</h2></div><button onClick={() => setShowMethod(false)}>Close</button></div><div className="method-grid"><article><b>01</b><h3>Projection hierarchy</h3><p>Use ZiPS fWAR when available, then Steamer. If neither exists, a Marcel-style baseline and position-specific aging curve provide a clearly labelled fallback.</p></article><article><b>02</b><h3>Contract surplus</h3><p>The first {settings.freeWar} WAR is free; production above it is worth ${settings.dollarsPerWar}M per win. RosterResource contract years are subtracted, while arbitration uses the visible 15/35/50/75% schedule.</p></article><article><b>03</b><h3>Prospect outcomes</h3><p>FanGraphs FV grades map to historical team-control surplus outcomes, split between hitters and pitchers, discounted to ETA, and exposed for explicit scouting adjustment.</p></article></div><div className="source-list"><span>Built-in sources</span><a href="https://www.fangraphs.com/projections" target="_blank" rel="noreferrer">FanGraphs projections ↗</a><a href="https://www.fangraphs.com/roster-resource/payroll/mariners" target="_blank" rel="noreferrer">RosterResource contracts ↗</a><a href="https://www.fangraphs.com/prospects/the-board/" target="_blank" rel="noreferrer">The Board ↗</a><a href="https://www.mlb.com/glossary/transactions/salary-arbitration" target="_blank" rel="noreferrer">MLB arbitration rules ↗</a></div></section>}
      <footer><div className="brand">Dugout <b>Value</b></div><p>A transparent decision aid, not a claim about any club’s private model. Refresh the data snapshot and verify options, service time, injuries, and transactions before relying on a result.</p></footer>
    </div>
  </main>;
}
