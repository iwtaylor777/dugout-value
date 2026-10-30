"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { toolCards } from "./editorial-content";

export function ToolsNavigation({ active }: { active: boolean }) {
  const [mode, setMode] = useState<"closed" | "hover" | "pinned">("closed");
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  const pathname = usePathname();
  const open = mode !== "closed";

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setMode("closed");
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [open]);

  return <div className="tools-navigation" ref={root}
    onPointerEnter={(event) => { if (event.pointerType === "mouse") setMode((value) => value === "closed" ? "hover" : value); }}
    onPointerLeave={() => { if (!root.current?.contains(document.activeElement)) setMode((value) => value === "hover" ? "closed" : value); }}
    onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setMode("closed"); }}
    onKeyDown={(event) => {
      if (event.key === "Escape" && open) {
        event.preventDefault();
        setMode("closed");
        trigger.current?.focus();
      }
    }}>
    <button ref={trigger} type="button" className="tools-navigation-trigger" data-active={active || undefined}
      aria-expanded={open} aria-controls={id}
      onClick={() => setMode((value) => value === "pinned" ? "closed" : "pinned")}
      onKeyDown={(event) => {
        if (event.key === "ArrowDown") {
          event.preventDefault();
          setMode("pinned");
          requestAnimationFrame(() => root.current?.querySelector<HTMLAnchorElement>("a")?.focus());
        }
      }}>
      Tools <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="m3 4.5 3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
    </button>
    <div className="tools-navigation-panel" id={id} hidden={!open}>
      {toolCards.map((tool) => <Link key={tool.href} href={tool.href} aria-current={pathname === tool.href ? "page" : undefined} onClick={() => setMode("closed")}>{tool.title}</Link>)}
      <Link className="tools-navigation-all" href="/tools" onClick={() => setMode("closed")}>All tools</Link>
    </div>
  </div>;
}
