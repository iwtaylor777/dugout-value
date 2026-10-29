import type { Metadata } from "next";
import Link from "next/link";
import { Publication } from "../site-shell";
import { pageMetadata, AUTHOR_ID, webPageJsonLd } from "../seo";
import { JsonLd } from "../json-ld";

export const metadata: Metadata = pageMetadata({
  title: "About",
  description: "Ian Taylor writes Dugout Value, a site covering baseball research, player projections, and a trade-value model built on public data.",
  path: "/about",
});

const REPO = "https://github.com/iwtaylor777/dugout-value";

export default function About() {
  return <Publication active="about"><JsonLd data={webPageJsonLd({ type: "AboutPage", title: "About Dugout Value", description: "Ian Taylor writes Dugout Value, a site covering baseball research, player projections, and a trade-value model built on public data.", path: "/about", about: { "@id": AUTHOR_ID } })}/>
    <header className="section-intro">
      <p className="eyebrow">About</p>
      <h1>About Dugout Value</h1>
      <p>I’m Ian Taylor. I write the articles and build the tools on this site. Dugout Value started with a trade-value calculator; it now also covers projections, pitching, and hitting.</p>
    </header>
    <div className="about-layout">
      <div className="article-body">
        <section aria-labelledby="publishes">
          <h2 id="publishes">What’s on the site</h2>
          <ul>
            <li><strong>Analysis.</strong> Studies using public pitch and projection data, including results that did not improve a forecast. <Link href="/analysis">Read the analysis →</Link></li>
            <li><strong>Trade model guides.</strong> How the value estimates and their ranges are calculated and how to read them.</li>
            <li><strong>Tools.</strong> A trade builder, player projections, value rankings, and a trade finder. <Link href="/tools">Open the tools →</Link></li>
          </ul>
          <p>The tools use FanGraphs projections and RosterResource contract data. Research articles name their own sources and tests. <Link href="/methods#data">The data page</Link> lists sources and snapshot dates for the tools.</p>
        </section>
        <section aria-labelledby="rules">
          <h2 id="rules">Sources and model settings</h2>
          <p>The tools use Dugout Value’s own projections by default, with ZiPS available as an option; FanGraphs Depth Charts supplies in-season playing time. The trade model applies its own settings for the price of a win, discounting, and value ranges. You can change many of those settings in the tools; the <Link href="/methods">methods page</Link> explains the calculation and its limits.</p>
        </section>
        <section aria-labelledby="contact">
          <h2 id="contact">Reach Ian Taylor or report an error</h2>
          <p>Corrections, questions, and bug reports go in the project’s GitHub repository. <a href={`${REPO}/issues`} rel="noopener noreferrer">Open an issue at github.com/iwtaylor777/dugout-value</a>. For a problem in a tool, include the page address and the share link. For an article, name the sentence and the number you think is wrong.</p>
          <p>The <a href={REPO} rel="noopener noreferrer">repository</a> also holds the model code and the tests.</p>
        </section>
        <p className="source-line">Not affiliated with MLB, any club, or FanGraphs.</p>
      </div>
    </div>
  </Publication>;
}
