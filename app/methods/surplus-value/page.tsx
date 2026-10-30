import Link from "next/link";
import { Publication } from "../../site-shell";
import { pageMetadata } from "../../seo";

export const metadata = pageMetadata({ title: "How surplus value works", description: "A plain-language guide to player value after salary, years of control, and uncertainty.", path: "/methods/surplus-value" });

export default function SurplusValueGuide() {
  return <Publication active="methods"><header className="section-intro"><p className="eyebrow">Trade model guide</p><h1>How surplus value works</h1><p>Surplus value estimates how much a player’s projected production is worth beyond what his team will pay him.</p></header><div className="article-body">
    <h2>Production, minus salary, over time</h2><p>For each season of team control, the model starts with projected WAR, applies a roster-spot allowance and the selected price per win, then subtracts salary. It discounts future surplus according to your settings and adds up the controlled seasons. Prospect values use a separate Future Value-based estimate.</p>
    <p><strong>Illustrative example, not a current player or the full model:</strong> if one season’s production is valued at $30 million and salary is $10 million, that season has $20 million of surplus before discounting. Another player with $40 million of production and $35 million of salary has only $5 million of surplus, despite producing more.</p>
    <h2>Why a better player can rank lower</h2><p>The board ranks contracts and team control alongside talent. A star on a market-rate contract can have less surplus than a good player earning an arbitration salary. That does not make the cheaper player better on the field.</p>
    <h2>Surplus is not an asking price</h2><p>A club also considers roster fit, contention, payroll limits, player consent, and the difficulty of replacing an elite player. A model match is a starting point for a trade conversation, not evidence that either team would accept it.</p>
    <h2>What the range means</h2><p>The ranges are scenario allowances, not confidence intervals. They are not calibrated probabilities, and overlapping ranges do not guarantee a fair trade. Inspect the player details and change the assumptions you disagree with.</p>
    <h2>Check the settings, not just the headline</h2><p>The tools show the projection source and valuation horizon. Player details expose forecasts, salaries, and control years; the builder exposes prices, premiums, and discount rates. The data is a dated snapshot rather than a live feed.</p><p><Link href="/tools/rankings">Explore value rankings</Link> · <Link href="/methods#model">Full model assumptions</Link></p>
    <p>For a dated worked example, see <Link href="/analysis/what-trade-value-measures">the original McGonigle–Judge comparison</Link>. Its historical inputs and model settings differ from the current board.</p>
  </div></Publication>;
}
