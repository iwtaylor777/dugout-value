"use client";

import { useState } from "react";
import data from "../../data/park-fit.json";

type Park = keyof (typeof data.players)[number]["parks"];
type Play = {
  id: string; date: string; result: string; ev: number; la: number; spray: number;
  distance: number | null; clears: string[]; inPlay: Partial<Record<Park, number[]>>;
};
type Switch = { play: Play; gained: boolean; inPlay: number[] };
const parks = data.parks as { id: Park; name: string }[];
const outcomes: Record<string, string> = {
  home_run: "Home run", single: "Single", double: "Double", triple: "Triple",
  field_out: "Out", sac_fly: "Sacrifice fly", double_play: "Double play", field_error: "Reached on error",
};
const dateLabel = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const signed = (n: number) => Math.abs(n) < .05 ? "0.0" : `${n > 0 ? "+" : "−"}${Math.abs(n).toFixed(1)}`;
const rate = (n: number) => n.toFixed(3).replace(/^0/, "");
const polar = (feet: number, angle: number) => {
  const radians = angle * Math.PI / 180;
  return [190 + feet * .45 * Math.sin(radians), 233 - feet * .45 * Math.cos(radians)];
};

function SprayChart({ switches }: { switches: Switch[] }) {
  return (
    <figure className="park-fit-spray">
      <svg viewBox="0 0 380 252" role="img" aria-label="Spray chart of home-run changes by recorded direction and distance">
        <text x="60" y="44">LF</text><text x="190" y="16">CF</text><text x="320" y="44">RF</text>
        {[200, 300, 400].map(distance => {
          const [x1, y1] = polar(distance, -49);
          const [x2, y2] = polar(distance, 49);
          const r = distance * .45;
          return <g key={distance}>
            <path d={`M${x1},${y1} A${r},${r} 0 0 1 ${x2},${y2}`} />
            <text x={x2 + 22} y={y2 + 4}>{distance}′</text>
          </g>;
        })}
        {[-49, 49].map(angle => {
          const [x, y] = polar(470, angle);
          return <path key={angle} d={`M190,233 L${x},${y}`} />;
        })}
        <path d="M190,233 215,208 190,183 165,208 Z" />
        <circle className="park-fit-plate" cx="190" cy="233" r="3" />
        {switches.map(({ play, gained }) => {
          if (play.distance == null) return null;
          const [x, y] = polar(play.distance, play.spray);
          return <g key={play.id} className={gained ? "park-fit-dot park-fit-dot-gain" : "park-fit-dot park-fit-dot-loss"}>
            <title>{dateLabel.format(new Date(play.date))} · {gained ? "HR gained" : "HR lost"} · {play.distance} ft</title>
            {gained ? <circle cx={x} cy={y} r="6" /> : <rect x={x - 5} y={y - 5} width="10" height="10" transform={`rotate(45 ${x} ${y})`} />}
          </g>;
        })}
      </svg>
      <figcaption><span className="park-fit-gain">● HR gained</span><span className="park-fit-loss">◆ HR lost</span><small>Distance and direction come from the original play.</small></figcaption>
    </figure>
  );
}

export function ParkFit() {
  const [hitterId, setHitterId] = useState(data.players[0].id);
  const [reference, setReference] = useState<Park>("chc");
  const [destination, setDestination] = useState<Park>("bos");
  const [pa, setPa] = useState(data.referencePa);
  const hitter = data.players.find(player => player.id === hitterId) ?? data.players[0];
  const base = hitter.parks[reference];
  const target = hitter.parks[destination];
  const scale = pa / data.referencePa;
  const referenceName = parks.find(park => park.id === reference)!.name;
  const destinationName = parks.find(park => park.id === destination)!.name;
  const switches: Switch[] = [];
  const plays: Play[] = hitter.plays;
  for (const play of plays) {
    const clearsReference = play.clears.includes(reference);
    const clearsDestination = play.clears.includes(destination);
    if (clearsReference === clearsDestination) continue;
    switches.push({
      play, gained: clearsDestination,
      inPlay: play.inPlay[clearsDestination ? reference : destination]!,
    });
  }
  const gains = switches.filter(change => change.gained).length;
  const losses = switches.length - gains;

  return (
    <div className="park-fit">
      <section className="park-fit-panel" aria-labelledby="park-fit-controls-title">
        <h2 id="park-fit-controls-title">Set up the replay</h2>
        <div className="park-fit-controls">
          <label>Hitter
            <select value={hitterId} onChange={event => setHitterId(event.target.value)}>
              {data.players.map(player => <option key={player.id} value={player.id}>{player.name}</option>)}
            </select>
          </label>
          <label>Reference park
            <select value={reference} onChange={event => setReference(event.target.value as Park)}>
              {parks.map(park => <option key={park.id} value={park.id}>{park.name}</option>)}
            </select>
          </label>
          <label>Destination park
            <select value={destination} onChange={event => setDestination(event.target.value as Park)}>
              {parks.map(park => <option key={park.id} value={park.id}>{park.name}</option>)}
            </select>
          </label>
          <label>Season playing time
            <select value={pa} onChange={event => setPa(Number(event.target.value))}>
              {[400, 500, 600, 700].map(total => <option key={total} value={total}>{total} PA</option>)}
            </select>
          </label>
        </div>
        <p className="park-fit-note">{hitter.name} had {hitter.samplePa} PA in 2026, with {hitter.measuredContact} tracked contacts in the model. The replay moves {pa / 2} home PA and keeps the other {pa / 2} at his observed road rates.</p>
      </section>

      <section className="park-fit-panel" aria-labelledby="park-fit-lines-title">
        <h2 id="park-fit-lines-title">{destinationName} vs. {referenceName}</h2>
        <div className="park-fit-metrics" aria-live="polite">
          {[
            { label: "Batting runs", delta: target.contactValue - base.contactValue },
            { label: "Home runs", delta: target.hits[3] - base.hits[3] },
            { label: "Doubles", delta: target.hits[1] - base.hits[1] },
          ].map(({ label, delta }) => <div key={label}>
            <strong className={delta * scale >= .05 ? "park-fit-gain" : delta * scale <= -.05 ? "park-fit-loss" : undefined}>{signed(delta * scale)}</strong>
            <span>{label}</span>
          </div>)}
        </div>
        <div className="article-table-wrap park-fit-table" tabIndex={0} role="region" aria-label="Batting lines at all five parks">
          <table>
            <caption>Full-season replay at {pa} PA</caption>
            <thead><tr><th scope="col">Home park</th><th scope="col">AVG / OBP / SLG</th>{["1B", "2B", "3B", "HR", "Runs vs. ref."].map(label => <th key={label} scope="col" className="num">{label}</th>)}</tr></thead>
            <tbody>{parks.map(park => {
              const line = hitter.parks[park.id];
              return <tr key={park.id} className={park.id === destination ? "park-fit-target" : undefined}>
                <th scope="row">{park.name}{park.id === reference && <small>Reference</small>}</th>
                <td className="park-fit-line">{[line.avg, line.obp, line.slg].map(rate).join(" / ")}</td>
                {line.hits.map((hits, i) => <td key={i} className="num">{(hits * scale).toFixed(1)}</td>)}
                <td className="num">{signed((line.contactValue - base.contactValue) * scale)}</td>
              </tr>;
            })}</tbody>
          </table>
        </div>
      </section>

      <section className="park-fit-panel" aria-labelledby="park-fit-plays-title">
        <h2 id="park-fit-plays-title">Which balls switch?</h2>
        <p className="park-fit-note">{gains} HR gained and {losses} lost on the full 2026 contact sample. The batting lines above scale that sample to the chosen playing time.</p>
        {switches.length ? <div className="park-fit-events">
          <SprayChart switches={switches} />
          <div className="park-fit-ledger" role="region" aria-label="Changed home-run plays" tabIndex={0}>
            <ul>{switches.map(({ play, gained, inPlay }) => <li key={play.id}>
              <div className="park-fit-play-title"><strong className={gained ? "park-fit-gain" : "park-fit-loss"}>{gained ? "● HR gained" : "◆ HR lost"}</strong><a href={`https://baseballsavant.mlb.com/sporty-videos?playId=${play.id}`}>{dateLabel.format(new Date(play.date))} · {outcomes[play.result] ?? play.result.replaceAll("_", " ")}</a></div>
              <small>{play.ev.toFixed(1)} mph · {play.la}°{play.distance == null ? "" : ` · ${play.distance} ft`}</small>
              <p>In play at {gained ? referenceName : destinationName}<br />{["non-hit", "1B", "2B", "3B"].map((label, i) => `${Math.round(inPlay[i] * 100)}% ${label}`).join(" · ")}</p>
            </li>)}</ul>
          </div>
        </div> : <p>None of this hitter’s tracked balls changes home-run status between these parks.</p>}
      </section>

      <details className="dv-war-notes roster-method">
        <summary>What the replay measures</summary>
        <p>I use adjusted <a href="https://baseballsavant.mlb.com/leaderboard/home-runs">Baseball Savant home-run flags</a> for the fences and carry. For balls that stay in, I estimate the hit mix from exit velocity, launch angle, spray direction, batting side, pitcher handedness and park. A non-hit usually means an out and can also include reaching on an error.</p>
        <p>The road half uses the hitter’s 2026 road rates. The home half uses his full 2026 contact profile, with observed walk, strikeout and playing-time rates held fixed. The batting runs compare expected hit outcomes using 2025 <a href="https://www.fangraphs.com/tools/guts?type=cn">FanGraphs run weights</a>. Use the comparison to see how the same contact plays in each park. A future forecast would also need to estimate which contact the hitter will produce.</p>
      </details>
    </div>
  );
}
