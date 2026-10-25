import type { Metadata } from "next";
import Link from "next/link";
import { Publication } from "../site-shell";
import { pageMetadata, webPageJsonLd } from "../seo";
import { JsonLd } from "../json-ld";

export const metadata: Metadata = pageMetadata({ title: "Privacy", description: "What Dugout Value measures about visits, what it doesn't, and how to opt out.", path: "/privacy" });

export default function Privacy() {
  return <Publication><JsonLd data={webPageJsonLd({ title: "Privacy", description: "What Dugout Value measures about visits, what it doesn't, and how to opt out.", path: "/privacy" })}/>
    <article className="longform"><header><h1>Privacy</h1><p className="article-deck">Dugout Value counts visits with Google Analytics. It has no accounts, no ads and no newsletter sign-up, so it never asks for your name or email.</p></header>
      <div className="article-body">
        <h2>What is measured</h2>
        <p>Google Analytics 4 records which pages are viewed, how visitors arrived (for example a search engine or a link), and broad device and location information such as country and browser. It sets first-party cookies to tell a returning visit from a new one. Google Analytics does not store full IP addresses.</p>
        <p>Advertising features are off: no Google Signals, no ad personalization, and no data shared for ads.</p>
        <h2>Visitors in the EEA, the UK and Switzerland</h2>
        <p>If your browser is set to a European time zone, Google Analytics does not load until you choose <strong>Accept</strong> in the banner. If you choose <strong>Decline</strong>, it stays off and the choice is remembered in your browser. Independently of the banner, analytics cookies are off by default for visitors Google locates in those countries.</p>
        <h2>Opting out</h2>
        <p>To change a choice you made in the banner, clear this site’s data in your browser and reload. You can also block Google Analytics everywhere with Google’s <a href="https://tools.google.com/dlpage/gaoptout" rel="noopener noreferrer">opt-out browser add-on</a> or a content blocker.</p>
        <h2>Downloads and links</h2>
        <p>Research files are served directly from this site. Links to other sites, such as FanGraphs, Baseball Savant and GitHub, are governed by those sites’ own policies.</p>
        <h2>Questions</h2>
        <p>Open an issue in the <a href="https://github.com/iwtaylor777/dugout-value/issues" rel="noopener noreferrer">project’s GitHub repository</a>, or see the <Link href="/about">About page</Link>.</p>
        <p className="source-line">Last updated October 24, 2026.</p>
      </div>
    </article></Publication>;
}
