const DEFAULT_ARTICLE_URLS = [
  "https://blogs.fangraphs.com/2026-trade-value-nos-41-50/",
  "https://blogs.fangraphs.com/2026-trade-value-nos-31-40/",
  "https://blogs.fangraphs.com/2026-trade-value-nos-21-30/",
  "https://blogs.fangraphs.com/2026-trade-value-nos-11-20/",
  "https://blogs.fangraphs.com/2026-trade-value-nos-1-10/",
];

const decodeHtml = (value) =>
  String(value ?? "")
    .replace(/<[^>]+>/g, "")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    )
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#(?:39|x27);/gi, "'")
    .replace(/&ndash;/g, "–")
    .replace(/&mdash;/g, "—")
    .replace(/\s+/g, " ")
    .trim();

export function parseTradeValueZiPS(html, sourceUrl) {
  return String(html ?? "")
    .split(/<div class="contract-container[^>]*>/i)
    .slice(1)
    .flatMap((block) => {
      const titleHtml = block.match(
        /<div class="table-title"[^>]*>([\s\S]*?)<\/div>/i,
      )?.[1];
      const fgId = block.match(
        /fangraphs\.com\/players\/[^/]+\/([^/]+)\/stats/i,
      )?.[1];
      if (!titleHtml || !fgId) return [];

      const title = decodeHtml(titleHtml);
      const rank = Number(title.match(/^#(\d+)/)?.[1]);
      const playerName = decodeHtml(
        titleHtml.match(/<a\b[^>]*>([\s\S]*?)<\/a>/i)?.[1],
      );
      const titleParts = title.split(",").map((part) => part.trim());
      const team = titleParts.at(-2) ?? "";
      const position = titleParts.at(-1) ?? "";
      const projections = {};
      for (const row of block.matchAll(
        /<tr class="table-row"[^>]*>([\s\S]*?)<\/tr>/gi,
      )) {
        const cells = [...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(
          (match) => decodeHtml(match[1]),
        );
        const year = Number(cells[0]);
        const war = Number(cells[2]);
        if (year >= 2027 && year <= 2031 && Number.isFinite(war))
          projections[year] = war;
      }
      const fiveYearWar = Number(
        decodeHtml(
          block.match(/<td id="out-fivewar"[^>]*>([\s\S]*?)<\/td>/i)?.[1],
        ),
      );
      if (!rank || !playerName || !Object.keys(projections).length) return [];

      return [
        {
          fgId,
          name: playerName,
          team,
          position,
          rank,
          fiveYearWar: Number.isFinite(fiveYearWar) ? fiveYearWar : null,
          projections,
          sourceUrl,
        },
      ];
    });
}

export async function loadTradeValueZiPS({
  articleUrls = DEFAULT_ARTICLE_URLS,
  fetchImpl = fetch,
} = {}) {
  const pages = await Promise.all(
    articleUrls.map(async (sourceUrl) => {
      const response = await fetchImpl(sourceUrl, {
        headers: {
          "user-agent":
            "DugoutValueDataRefresh/1.0 (public-source projection snapshot)",
        },
      });
      if (!response.ok)
        throw new Error(
          `Trade Value ZiPS download failed: ${response.status} ${sourceUrl}`,
        );
      return parseTradeValueZiPS(await response.text(), sourceUrl);
    }),
  );
  const players = pages.flat();
  const ranks = new Set(players.map((player) => player.rank));
  if (players.length !== 50 || ranks.size !== 50)
    throw new Error(
      `Expected 50 unique Trade Value ZiPS rows; received ${players.length} players and ${ranks.size} ranks`,
    );
  return players;
}

export const TRADE_VALUE_ZIPS_ARTICLE_URLS = DEFAULT_ARTICLE_URLS;
