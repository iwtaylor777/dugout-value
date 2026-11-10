"use client";

import { useState } from "react";
import { dateLabel, signed, type Park, type Switch } from "./data";

const polar = (feet: number, angle: number) => {
  const radians = angle * Math.PI / 180;
  return [195 + feet * .45 * Math.sin(radians), 246 - feet * .45 * Math.cos(radians)];
};
const fence = (park: Park) => park.distances.map((feet, i) => polar(feet, -45 + 22.5 * i).join(",")).join(" ");

export function SprayChart({ from, to, points, switches, onSelect }: {
  from: Park; to: Park; points: number[][]; switches: Switch[]; onSelect: (id: string) => void;
}) {
  const [activeId, setActiveId] = useState("");
  const active = switches.find(item => item.play.id === activeId);
  return (
    <figure className="park-fit-spray">
      <svg viewBox="0 0 390 264" role="group" aria-label="Approximate fence outlines and tracked contact. Select a changed ball for its play details.">
        <text x="55" y="51">LF</text><text x="195" y="20">CF</text><text x="335" y="51">RF</text>
        {[200, 300, 400].map(distance => {
          const [x1, y1] = polar(distance, -45);
          const [x2, y2] = polar(distance, 45);
          const r = distance * .45;
          return <g key={distance} aria-hidden="true">
            <path className="park-fit-arc" d={`M${x1},${y1} A${r},${r} 0 0 1 ${x2},${y2}`} />
            <text x={x2 + 22} y={y2 + 4}>{distance}′</text>
          </g>;
        })}
        <polygon className="park-fit-fence-area" points={`${fence(from)} ${fence(to).split(" ").reverse().join(" ")}`} />
        <polyline className="park-fit-reference-wall" points={fence(from)} />
        <polyline className="park-fit-destination-wall" points={fence(to)} />
        <g aria-hidden="true">
          {points.map(([angle, distance], i) => {
            const [x, y] = polar(distance, angle);
            return <circle key={i} className="park-fit-contact-dot" cx={x} cy={y} r="1.8" />;
          })}
          <path className="park-fit-arc" d="M195,246 220,221 195,196 170,221 Z" />
          <circle className="park-fit-plate" cx="195" cy="246" r="3" />
        </g>
        {switches.map(({ play, gained, runs }) => {
          if (play.distance == null) return null;
          const [x, y] = polar(play.distance, play.spray);
          const size = 4.5 + Math.min(Math.abs(runs), 2);
          return <g key={play.id} role="button" tabIndex={0}
            aria-label={`${dateLabel.format(new Date(play.date))}, home run ${gained ? "gained" : "lost"}`}
            className={gained ? "park-fit-dot park-fit-dot-gain" : "park-fit-dot park-fit-dot-loss"}
            onFocus={() => setActiveId(play.id)} onPointerEnter={() => setActiveId(play.id)}
            onClick={() => onSelect(play.id)} onKeyDown={event => {
              if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect(play.id); }
            }}>
            <circle className="park-fit-dot-hitbox" cx={x} cy={y} r="13" />
            {gained ? <circle className="park-fit-marker" cx={x} cy={y} r={size} /> :
              <rect className="park-fit-marker" x={x - size} y={y - size} width={size * 2} height={size * 2} transform={`rotate(45 ${x} ${y})`} />}
          </g>;
        })}
      </svg>
      <figcaption>
        <span><i className="park-fit-legend-wall" /> {from.name}</span>
        <span><i className="park-fit-legend-wall destination" /> {to.name}</span>
        <span className="park-fit-gain">● HR gained</span><span className="park-fit-loss">◆ HR lost</span>
        <small className="park-fit-annotation">{active ? `${dateLabel.format(new Date(active.play.date))} · ${active.play.ev.toFixed(1)} mph · ${signed(active.runs, 1)} estimated runs` : "Select a marker to see the play and video."}</small>
        <small>Outlines connect five Savant fence measurements. Dots use direction and distance from the original play.</small>
      </figcaption>
    </figure>
  );
}
