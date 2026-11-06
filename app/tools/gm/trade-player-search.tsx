"use client";
import { useId, useRef, useState } from "react";
import { matchesTradePlayer } from "../../../lib/gm-trade-search.mjs";

type Choice = { pid: string; name: string; position: string; unavailable: string };

export function TradePlayerSearch({ label, query, onQuery, choices, onAdd }: {
  label: string; query: string; onQuery: (query: string) => void;
  choices: Choice[]; onAdd: (pid: string) => void;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const matches = choices.filter(choice => matchesTradePlayer(choice.name, query));
  const shown = matches.slice(0, 10);
  const add = (choice: Choice) => {
    if (choice.unavailable) return;
    onAdd(choice.pid); onQuery(""); setOpen(false); setActive(-1); input.current?.focus();
  };
  return <div className="gm-player-search" onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false); }}>
    <label className="gm-field" htmlFor={id}><span>{label}</span>
      <input ref={input} id={id} role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={`${id}-options`} aria-activedescendant={open && active >= 0 && shown[active] ? `${id}-${shown[active].pid}` : undefined}
        autoComplete="off" placeholder="Type a player or prospect name…" value={query}
        onFocus={() => { setOpen(true); setActive(-1); }}
        onChange={e => { onQuery(e.target.value); setOpen(true); setActive(-1); }}
        onKeyDown={e => {
          if (e.key === "Escape") { setOpen(false); setActive(-1); return; }
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault(); setOpen(true);
            const available = shown.map((choice, i) => choice.unavailable ? -1 : i).filter(i => i >= 0);
            if (!available.length) return;
            const current = available.indexOf(active);
            const next = current < 0 ? (e.key === "ArrowDown" ? 0 : available.length - 1) : (current + (e.key === "ArrowDown" ? 1 : available.length - 1)) % available.length;
            setActive(available[next]);
            document.getElementById(`${id}-${shown[available[next]].pid}`)?.scrollIntoView({ block: "nearest" });
          } else if (e.key === "Enter" && open) {
            e.preventDefault(); const choice = shown[active] ?? shown.find(c => !c.unavailable); if (choice) add(choice);
          }
        }} />
    </label>
    {open && <div className="gm-search-popover">
      <ul id={`${id}-options`} role="listbox" aria-label={`${label} matches`}>
        {shown.map((choice, i) => <li key={choice.pid} id={`${id}-${choice.pid}`} role="option" aria-selected={active === i} aria-disabled={!!choice.unavailable}
          onMouseDown={e => e.preventDefault()} onMouseEnter={() => setActive(i)} onClick={() => add(choice)}>
          <strong>{choice.name}</strong><span>{choice.position}{choice.unavailable ? ` · ${choice.unavailable}` : ""}</span>
        </li>)}
      </ul>
      <p role="status">{!matches.length ? "No matching players on this roster." : matches.length > shown.length ? `Showing ${shown.length} of ${matches.length}. Keep typing to narrow the list.` : `${matches.length} ${matches.length === 1 ? "match" : "matches"}. Select a player to add him.`}</p>
    </div>}
  </div>;
}
