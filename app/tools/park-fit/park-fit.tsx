"use client";

import { useEffect, useState } from "react";
import initialProfile from "../../../public/data/park-fit/2026-673548.json";
import {
  availableSeasons, battingLine, compare, dateLabel, defaultSelection, parkPlayers, parksFor, playingTime,
  rangeLabel, readSelection, selectionUrl, signed, switchesFor,
  type Mode, type Park, type Profile, type Season, type Selection, type Switch,
} from "./data";
import { SprayChart } from "./spray-chart";

const recorded: Record<string, string> = {
  home_run: "home run", single: "single", double: "double", triple: "triple",
  field_out: "out", sac_fly: "sacrifice fly", double_play: "double play", field_error: "reached on error",
};
const samplesIncludeZero = (range: number[]) => range[0] <= 0 && range[1] >= 0;
const outcomeLabels = ["No hit", "Single", "Double", "Triple"];
const modeLabel = { adjusted: "adjusted carry", standard: "the standard trajectory" };

function PlayList({ switches, from, to, points }: { switches: Switch[]; from: Park; to: Park; points: number[][] }) {
  const [expanded, setExpanded] = useState(false);
  const count = switches.length;
  function focusPlay(id: string) {
    setExpanded(true);
    window.requestAnimationFrame(() => {
      const play = document.getElementById(`replay-${id}`);
      play?.focus({ preventScroll: true });
      play?.scrollIntoView({ block: "nearest" });
    });
  }
  const gains = switches.filter(play => play.gained).length;
  return (
    <section className="park-fit-panel" aria-labelledby="park-fit-plays">
      <h2 id="park-fit-plays">Which balls switch?</h2>
      <p className="park-fit-note">{gains} HR gained and {switches.length - gains} lost on the full contact sample. The batting lines above scale those changes to the selected playing time.</p>
      {switches.length > 0 ? <div className="park-fit-events">
        <SprayChart from={from} to={to} points={points} switches={switches} onSelect={focusPlay} />
        <div>
          <ol id="park-fit-ledger" className="park-fit-ledger">{switches.slice(0, expanded ? count : 6).map(({ play, gained, staysAt, chances, runs }) => <li key={play.id} id={`replay-${play.id}`} tabIndex={-1}>
            <div className="park-fit-play-title">
              <strong className={gained ? "park-fit-gain" : "park-fit-loss"}>{gained ? "● HR gained" : "◆ HR lost"}</strong>
              <span>{signed(runs, 1)} runs on this ball</span>
              <a href={`https://baseballsavant.mlb.com/sporty-videos?playId=${play.id}`}>Watch {dateLabel.format(new Date(play.date))} play ↗</a>
            </div>
            <small>Recorded {recorded[play.result] ?? play.result.replaceAll("_", " ")} · {play.ev.toFixed(1)} mph · {play.la}°{play.distance == null ? "" : ` · ${play.distance} ft`}</small>
            <div className="park-fit-odds">
              <span>In play at {staysAt.name}</span>
              <div className="park-fit-odds-bar" aria-hidden="true">{chances.map((p, i) => <span key={i} style={{ flexGrow: p }} />)}</div>
              <small>{chances.map((p, i) => `${Math.round(p * 100)}% ${outcomeLabels[i].toLowerCase()}`).join(" · ")}</small>
            </div>
          </li>)}</ol>
          {count > 6 && <button className="park-fit-button" type="button" aria-expanded={expanded} aria-controls="park-fit-ledger" onClick={() => setExpanded(value => !value)}>{expanded ? "Show fewer plays" : `Show all ${count} changed plays`}</button>}
        </div>
      </div> : <>
        <p>None of this hitter’s tracked balls changes home-run status between these parks.</p>
        <SprayChart from={from} to={to} points={points} switches={switches} onSelect={focusPlay} />
      </>}
    </section>
  );
}

function Replay({ profile, parks, from, to, pa, mode, onDestination }: {
  profile: Profile; parks: Park[]; from: Park; to: Park; pa: number; mode: Mode; onDestination: (id: string) => void;
}) {
  const fromIndex = parks.findIndex(park => park.id === from.id);
  const toIndex = parks.findIndex(park => park.id === to.id);
  const result = compare(profile, mode, fromIndex, toIndex, pa);
  const alternateMode = mode === "adjusted" ? "standard" : "adjusted";
  const alternate = compare(profile, alternateMode, fromIndex, toIndex, pa);
  const switches = switchesFor(profile, mode, from, to);
  const destinations = parks.map((park, i) => ({ park, result: compare(profile, mode, fromIndex, i, pa) }))
    .filter(row => row.park.id !== from.id).sort((a, b) => b.result.extra - a.result.extra);
  const maxRange = Math.max(1, ...destinations.flatMap(({ result: row }) => row.extraRange.map(Math.abs)));
  const position = (runs: number) => `${Math.max(0, Math.min(100, 50 + runs / maxRange * 50))}%`;
  return <>
    <section className="park-fit-panel" aria-labelledby="park-fit-lines">
      <h2 id="park-fit-lines">{to.name} vs. {from.name}</h2>
      <p className="park-fit-verdict" role="status">
        {samplesIncludeZero(result.extraRange)
          ? "The sample doesn’t separate this hitter from the batting-side benchmark."
          : `This contact sample plays ${result.extra > 0 ? "better" : "worse"} than the batting-side benchmark.`}
      </p>
      <div className="park-fit-metrics">
        <div className="park-fit-primary"><span>Beyond batting-side benchmark</span><strong>{signed(result.extra)} runs</strong><small>Sample range {rangeLabel(result.extraRange)}</small></div>
        <div><span>Total park effect</span><strong>{signed(result.runs)} runs</strong><small>Sample range {rangeLabel(result.range)}</small><small>Batting-side benchmark {signed(result.generic)} runs</small></div>
        <div><span>Total effect in wOBA</span><strong>{signed(result.wobaPoints)} pts</strong><small>Sample range {rangeLabel(result.range, result.runsToWobaPoints)}</small></div>
        <div><span>Batting wins equivalent</span><strong>{signed(result.wins, 2)}</strong><small>Sample range {rangeLabel(result.range, result.runsToWins, 2)}</small></div>
      </div>
      <p className="park-fit-note">The 95% sample ranges come from resampling the hitter’s games. They hold the fitted model and carry setting fixed.</p>
      <div className="park-fit-lines">
        {[{ stadium: from, estimate: result.base }, { stadium: to, estimate: result.target }].map(({ stadium, estimate }, i) => {
          return <div key={stadium.id} className={i ? "park-fit-destination-line" : undefined}>
            <small>{i ? "Destination replay" : "Reference replay"}</small><strong>{stadium.name}</strong>
            <span>{battingLine(estimate.slash)} · {estimate.woba.toFixed(3).replace(/^0/, "")} wOBA</span>
            <dl aria-label="Expected hits">{estimate.hits.map((n, j) => <div key={j}><dt>{["1B", "2B", "3B", "HR"][j]}</dt><dd>{(n * result.scale).toFixed(1)}</dd></div>)}</dl>
          </div>;
        })}
      </div>
      <p className="park-fit-note">Expected hit counts at {pa} PA. This move changes expected homers by <strong>{signed(result.hits[3], 1)}</strong> with {modeLabel[mode]} and <strong>{signed(alternate.hits[3], 1)}</strong> with {modeLabel[alternateMode]}.</p>
    </section>

    <PlayList switches={switches} from={from} to={to} points={profile.points} />

    <details className="park-fit-panel park-fit-all-parks">
      <summary>Compare all {parks.length - 1} destinations</summary>
      <p className="park-fit-note">Ordered by extra batting runs beyond the batting-side benchmark. The sample ranges show how much that order can move.</p>
      <ul className="park-fit-rank">
        {destinations.map(({ park, result: row }) => <li key={park.id}>
          <button type="button" aria-pressed={park.id === to.id} onClick={() => onDestination(park.id)}>{park.name}</button>
          <span><strong>{signed(row.extra)} extra runs</strong><small>{rangeLabel(row.extraRange)} sample range</small>
            <span className="park-fit-range-plot" aria-hidden="true">
              <i style={{ left: position(row.extraRange[0]), right: position(-row.extraRange[1]) }} />
              <b style={{ left: position(row.extra) }} />
            </span>
          </span>
          <span>{signed(row.runs)} total runs <small>{rangeLabel(row.range)} sample range</small></span>
          <span>{signed(row.hits[3], 1)} expected HR</span>
        </li>)}
      </ul>
    </details>
  </>;
}

export function ParkFit() {
  const [selection, setSelection] = useState<Selection>(defaultSelection);
  const [profile, setProfile] = useState<Profile>(initialProfile);
  const [error, setError] = useState("");
  const [share, setShare] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const read = () => setSelection(readSelection(new URLSearchParams(window.location.search)));
    const frame = window.requestAnimationFrame(read);
    window.addEventListener("popstate", read);
    return () => { window.cancelAnimationFrame(frame); window.removeEventListener("popstate", read); };
  }, []);
  const { player, year, pa, mode } = selection;
  const ready = profile.id === player && profile.year === year;
  useEffect(() => {
    if (ready) return;
    const request = new AbortController();
    fetch(`/data/park-fit/${year}-${player}.json`, { signal: request.signal })
      .then(response => { if (!response.ok) throw new Error("Replay unavailable"); return response.json(); })
      .then(result => { if (!request.signal.aborted) setProfile(result as Profile); })
      .catch(() => { if (!request.signal.aborted) setError("This replay couldn’t load."); });
    return () => request.abort();
  }, [year, player, ready, attempt]);

  const parks = parksFor(year);
  const from = parks.find(park => park.id === selection.from || (!selection.from && ready && park.id === profile.home));
  const to = parks.find(park => park.id === selection.to && park.id !== from?.id)
    ?? parks.find(park => park.id === "bos" && park.id !== from?.id)
    ?? parks.find(park => park.id === "chc")!;
  function update(next: Partial<Selection>) {
    const value = { ...selection, ...next };
    const seasons = availableSeasons(value.player);
    if (!seasons.includes(value.year)) value.year = seasons[0];
    setError("");
    setShare("");
    setSelection(value);
    window.history.replaceState(window.history.state, "", selectionUrl(value, window.location.href));
  }
  async function copyLink() {
    const url = selectionUrl({ ...selection, from: from?.id ?? "", to: to.id }, window.location.href);
    try { await navigator.clipboard.writeText(url.href); setShare("Link copied."); }
    catch { setShare(url.href); }
  }
  function setDestination(id: string) {
    update({ to: id });
  }
  return (
    <div className="park-fit">
      <section className="park-fit-panel" aria-labelledby="park-fit-controls">
        <h2 id="park-fit-controls">Set up the replay</h2>
        <div className="park-fit-controls">
          <div className="park-fit-control"><label htmlFor="pf-hitter">Hitter</label><select id="pf-hitter" value={player} onChange={event => update({ player: event.target.value, from: "" })}>
            {parkPlayers.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
          </select></div>
          <div className="park-fit-control"><label htmlFor="pf-year">Contact season</label><select id="pf-year" value={year} onChange={event => update({ year: Number(event.target.value) as Season, from: "" })}>
            {availableSeasons(player).map(option => <option key={option}>{option}</option>)}
          </select></div>
          <div className="park-fit-control"><label htmlFor="pf-from">Reference park</label><select id="pf-from" value={from?.id ?? ""} onChange={event => update({ from: event.target.value })}>
            {!from && <option value="">Loading home park</option>}
            {parks.map(park => <option key={park.id} value={park.id} disabled={park.id === to.id}>{park.name}</option>)}
          </select></div>
          <div className="park-fit-control"><label htmlFor="pf-to">Destination park</label><select id="pf-to" value={to.id} onChange={event => setDestination(event.target.value)}>
            {parks.map(park => <option key={park.id} value={park.id} disabled={park.id === from?.id}>{park.name}</option>)}
          </select></div>
          <div className="park-fit-control"><label htmlFor="pf-pa">Season playing time</label><select id="pf-pa" value={pa} onChange={event => update({ pa: Number(event.target.value) })}>
            {playingTime.map(option => <option key={option} value={option}>{option} PA</option>)}
          </select></div>
          <div className="park-fit-control"><label htmlFor="pf-carry">Home-run carry</label><select id="pf-carry" value={mode} onChange={event => update({ mode: event.target.value as Mode })}>
            <option value="adjusted">Adjusted for typical carry</option><option value="standard">Standard trajectory</option>
          </select></div>
        </div>
        <div className="park-fit-actions">
          <button type="button" className="park-fit-button" disabled={!ready || !from} onClick={() => from && update({ from: to.id, to: from.id })}>Swap parks</button>
          <button type="button" className="park-fit-button" disabled={!ready} onClick={copyLink}>Copy replay link</button>
          <span role="status">{share.startsWith("http") ? <a href={share}>Open share link</a> : share}</span>
        </div>
        {ready && <p className="park-fit-note"><strong>Actual {profile.year} line</strong> {battingLine(profile.actual.slash)} · {profile.actual.hits[3]} HR in {profile.samplePa} PA. He took {profile.homePa} of {profile.totalHomePa} home PA at {parks.find(park => park.id === profile.home)?.name}, the default reference.</p>}
        <p className="park-fit-note">The replay uses {pa / 2} home PA from the selected year’s contact and keeps the other {pa / 2} at the hitter’s observed road rates.</p>
      </section>
      {ready && from ? <Replay key={`${year}-${player}-${from.id}-${to.id}-${mode}`} profile={profile} parks={parks} from={from} to={to} pa={pa} mode={mode} onDestination={setDestination} />
        : <section className="park-fit-panel" role="status">{error ? <>{error} <button type="button" onClick={() => { setError(""); setAttempt(n => n + 1); }}>Retry</button></> : "Loading the selected replay…"}</section>}
      <details className="dv-war-notes roster-method">
        <summary>How to read the replay</summary>
        <p>The dropdown includes {parkPlayers.length} hitters. I require at least 100 usable batted balls and 60 road PA in each displayed season, with enough tracked plays to reconcile both carry settings.</p>
        <p>Both lines combine the same observed road rates with modeled home contact. I keep walk and strikeout rates fixed, and the batting-side benchmark uses league-average contact with the hitter’s mix of left- and right-handed batted balls. The gap from that benchmark is a result for this sample.</p>
        <p>Adjusted uses typical carry for the park. Standard uses the observed trajectory. I take both home-run calls from Savant and estimate in-play odds using wall dimensions and expected carry. Those odds describe possible results at the destination. <a href="https://baseballsavant.mlb.com/leaderboard/home-runs">Baseball Savant Home Run Tracker.</a></p>
        <p>The wOBA and batting-wins figures express the same batting runs at different scales. Batting wins divide by 9.774 runs per win. WAR also accounts for park context, baserunning, fielding, position and replacement level. <a href="https://www.fangraphs.com/tools/guts?type=cn">FanGraphs Guts.</a></p>
      </details>
    </div>
  );
}
