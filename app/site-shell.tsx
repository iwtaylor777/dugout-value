import Link from "next/link";
import type { ReactNode } from "react";
import database from "./data/player-database.json";
import { ToolsNavigation } from "./tools-navigation";

export function SiteHeader({ active }: { active?: "home" | "analysis" | "tools" | "methods" | "about" }) {
  return <header className="publication-header">
    <Link className="publication-brand" href="/" aria-label="Dugout Value home"><span className="brand-diamond" aria-hidden="true">D</span><span>Dugout Value<small>Baseball analysis and tools</small></span></Link>
    <nav aria-label="Main navigation">
      <Link href="/" aria-current={active === "home" ? "page" : undefined}>Home</Link>
      <Link href="/analysis" aria-current={active === "analysis" ? "page" : undefined}>Analysis</Link>
      <ToolsNavigation active={active === "tools"}/>
      <Link href="/methods" aria-current={active === "methods" ? "page" : undefined}>Methods<span className="nav-extra"> & data</span></Link>
      <Link href="/about" aria-current={active === "about" ? "page" : undefined}>About</Link>
    </nav>
  </header>;
}

export function SiteFooter() {
  return <footer className="publication-footer"><div><Link href="/">Dugout Value</Link><p>Baseball analysis and trade-value tools using public projections and contract data.</p></div><nav aria-label="Footer navigation"><Link href="/analysis">Analysis</Link><Link href="/tools">Tools</Link><Link href="/research">Research files</Link><Link href="/ledger">Trade & contract ledger</Link><Link href="/players">Player studies</Link><Link href="/methods">Methods & data</Link><Link href="/about">About</Link><Link href="/privacy">Privacy</Link><a href="/feed.xml">RSS</a></nav><p className="footer-note">By Ian Taylor. Not affiliated with MLB, any club, or FanGraphs. Trade values are model estimates, not club valuations.</p></footer>;
}

export function Publication({ active, children }: { active?: "home" | "analysis" | "tools" | "methods" | "about"; children: ReactNode }) {
  return <div className="publication"><a className="skip-link" href="#main-content">Skip to content</a><SiteHeader active={active}/><main id="main-content" className="publication-main">{children}</main><SiteFooter/></div>;
}

export function SnapshotNotice() {
  const date = new Date(`${database.meta.refreshed}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
  return <aside className="snapshot-notice"><span className="status-dot" aria-hidden="true"/><p><strong>Tool data checked {date}.</strong> The tools value 2027 onward. Four prospects retain older, dated grades; player editors identify them. Projections and scouting grades have their own publication dates. <Link href="/methods#data">About the data →</Link></p></aside>;
}
