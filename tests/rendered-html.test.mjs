import assert from "node:assert/strict";
import test from "node:test";

let workerPromise;
async function render(pathname) {
  workerPromise ??= import(new URL("../dist/server/index.js", import.meta.url).href).then((module) => module.default);
  const worker = await workerPromise;
  return worker.fetch(
    new Request(`http://localhost${pathname}`, { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("the main banner offers a collapsed dropdown with all seven tools", async () => {
  const html = await (await render("/")).text();
  assert.match(html, /class="tools-navigation-trigger"[^>]*aria-expanded="false"[^>]*aria-controls=/);
  assert.match(html, /class="tools-navigation-panel"[^>]*hidden/);
  for (const path of ["trade", "projections", "rankings", "finder", "free-agents", "depth-chart", "dv-war"]) {
    assert.match(html, new RegExp(`href="/tools/${path}"`));
  }
  assert.match(html, /<a\b(?=[^>]*class="tools-navigation-all")(?=[^>]*href="\/tools")[^>]*>/);
});

test("trade route presents the reviewed snapshot, the offseason default and the verdict", async () => {
  const response = await render("/tools/trade");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<h1>Trade builder<\/h1>/);
  assert.match(html, /Data checked <!-- -->October 18, 2026/);
  assert.match(html, /Off · 2026 season complete/);
  assert.match(html, /Pittsburgh Pirates give up \$47\.4M more at the midpoint/);
  assert.match(html, /58\.1% of the larger side/);
  assert.match(html, /The ranges don’t overlap/);
  assert.match(html, /Why this result\?/);
  assert.match(html, /href="\/analysis\/how-to-read-value-ranges"/);
  assert.match(html, /It isn’t a confidence interval/);
  assert.match(html, /Link saves players, cash, and any edits\./);
  assert.match(html, /<a class="skip-link" href="#main-content">/);
  assert.equal((html.match(/<main\b/g) ?? []).length, 1);
  assert.doesNotMatch(html, /tool-site-nav/);
  assert.doesNotMatch(html, /Baseball trade model/);
  assert.doesNotMatch(html, /receives .*’s package/);
  assert.match(html, /<details class="assumptions"/);
  assert.match(html, /<details class="editor-advanced"/);
  assert.match(html, /href="\/tools\/trade"[^>]*aria-current="page"/);
  assert.doesNotMatch(html, /Deadline trade lab/);
  assert.doesNotMatch(html, /On · current wins \+ October/);
  assert.doesNotMatch(html, /Pirates’s|\bis is\b|Baseline market/);
});

test("each tool route renders its own view and stable navigation", async () => {
  const routes = [
    ["/tools/finder", /Choose a need/],
    ["/tools/projections", /<h1>Player projections<\/h1>/],
    ["/tools/rankings", /Top 100 shown by default\. Search all players\./],
  ];
  for (const [path, heading] of routes) {
    const response = await render(path);
    assert.equal(response.status, 200, path);
    const html = await response.text();
    assert.match(html, heading, path);
    assert.match(html, /Data checked <!-- -->October 18, 2026/, path);
    assert.match(html, new RegExp(`href="${path}"[^>]*aria-current="page"`), path);
    assert.match(html, /aria-label="Trade builder"/, path);
    assert.match(html, /href="\/tools\/trade"/, path);
  }
});


test("finder distinguishes club control from player-option years", async () => {
  const response = await render("/tools/trade");
  const html = await response.text();
  assert.match(html, /Club control through 2029 · player option through 2034/);
  assert.doesNotMatch(html, /Long-term control<!-- --> through <!-- -->2037/);
});

test("rankings have semantic headers, a compact default, and an evergreen guide", async () => {
  const html = await (await render("/tools/rankings")).text();
  assert.match(html, /<table class="rankings-table compact">/);
  assert.match(html, /<caption>Top 100 players/);
  assert.match(html, /<th scope="col"[^>]*>Player<\/th>/);
  assert.match(html, /<th scope="row" class="ranking-player ranking-name-column">/);
  assert.match(html, /League rank/);
  assert.match(html, /Control years/);
  assert.match(html, /aria-pressed="true"[^>]*>Compact/);
  assert.match(html, /href="\/methods\/surplus-value"/);
  assert.doesNotMatch(html, /Top 100 by surplus value/);
  assert.match(html, /Ranges are not confidence intervals/);
});

test("homepage arrows use SVG and historical context precedes the article figures", async () => {
  const home = await (await render("/")).text();
  assert.match(home, /<svg class="nav-arrow"/);
  assert.doesNotMatch(home, /↗/);
  const article = await (await render("/analysis/what-trade-value-measures")).text();
  assert.ok(article.indexOf('class="historical-note"') < article.indexOf('class="article-deck"'));
  const guide = await (await render("/methods/surplus-value")).text();
  assert.match(guide, /Illustrative example, not a current player or the full model/);
  assert.match(guide, /scenario allowances, not confidence intervals/);
});

test("published research separates scoring eligibility from evidence of improvement", async () => {
  const response = await render("/research");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /284/);
  assert.match(html, /registered tests remain unevaluated/);
  assert.match(html, /2026-forecast-results.tar.gz/);
  assert.match(html, /dugout-value-2026-10-17.tar.gz/);
  const article = await render("/analysis/shapecast-2026-forecast-results");
  assert.equal(article.status, 200);
  assert.match(await article.text(), /103 remain/);
});

test("case studies and ledger entries render and reject unknown records", async () => {
  for (const path of ["/ledger", "/ledger/devers-to-giants-2025", "/ledger/soto-mets-contract-2024", "/players", "/players/mlb-665742", "/players/mlb-805808", "/players/mlb-592450"]) {
    const response = await render(path);
    assert.equal(response.status, 200, path);
    const html = await response.text();
    assert.equal((html.match(/<main\b/g) ?? []).length, 1, path);
    if (path.startsWith("/players")) {
      // Case studies are computed live with the current defaults and say so.
      assert.match(html, /2026-10-25\.1/, path);
      assert.doesNotMatch(html, /2026-10-17\.1/, path);
    } else {
      // The ledger is a pinned October 17 record.
      assert.match(html, /2026-10-17\.1/, path);
    }
  }
  for (const path of ["/ledger/unknown-record", "/players/unknown-player"]) {
    assert.equal((await render(path)).status, 404, path);
  }
});

test("frozen article figures are dated to the model that made them and methods states the current defaults", async () => {
  for (const slug of ["what-trade-value-measures", "how-to-read-value-ranges"]) {
    const html = await (await render(`/analysis/${slug}`)).text();
    assert.match(html, /model 2026-10-17\.1, the October 17 defaults of \$12 million per win and a 30% star premium/, slug);
    assert.match(html, /current tools use model 2026-10-25\.1/, slug);
  }
  const methods = await (await render("/methods")).text();
  assert.match(methods, /The default price is \$11 million a win, 20% higher for each net win past two/);
  assert.match(methods, /A reliever projected for more than 0.8 wins in a season is priced 50% higher/);
  assert.match(methods, /current tools use model 2026-10-25\.1/);
});

test("free-agent tracker renders the class with scored predictions", async () => {
  const response = await render("/tools/free-agents");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<h1>Free-agent tracker<\/h1>/);
  assert.match(html, /Tarik Skubal/);
  assert.match(html, /Scored #<!-- -->1/);
  assert.match(html, /\$386M/);
  assert.match(html, /href="\/tools\/free-agents"[^>]*aria-current="page"|href="\/tools"[^>]*aria-current="page"/);
});

test("depth chart renders a team with its total, rank and free-agent fits", async () => {
  const response = await render("/tools/depth-chart");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<h1>Depth charts<\/h1>/);
  assert.match(html, /projected 2027 WAR/);
  assert.match(html, /of 30 teams/);
  assert.match(html, /Free agents who add the most/);
  assert.match(html, /Replacement level|Best free-agent fit/);
  assert.match(html, /2026 CBT payroll/);
  assert.match(html, /2027 under contract/);
});

test("home page features the free-agent tracker in place of value rankings", async () => {
  const response = await render("/");
  const html = await response.text();
  const tools = html.slice(html.indexOf('id="tools-heading"'));
  assert.match(tools, /href="\/tools\/free-agents"/);
  assert.doesNotMatch(tools.slice(0, tools.indexOf("</section>")), /href="\/tools\/rankings"/);
});
