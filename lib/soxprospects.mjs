export const SOXPROSPECTS_URL = "https://www.soxprospects.com/";

function decodeHtml(value) {
  return String(value ?? "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function cleanHtml(value) {
  return decodeHtml(
    String(value ?? "")
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
}

function isoDate(value) {
  const match = String(value ?? "").match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const [, month, day, year] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

export function soxGradeToFv(grade) {
  const numeric = Number(grade);
  if (!Number.isFinite(numeric)) return null;
  return String(Math.round(numeric * 10));
}

export function parseSoxProspects(html) {
  const sourceText = cleanHtml(html);
  const rankingsDate = isoDate(
    sourceText.match(/Last Rankings Update:\s*([0-9/]+)/i)?.[1],
  );
  const prospects = [];
  const seen = new Set();
  const playerLinks = /href=["']players\/([^"']+\.htm)["']/gi;

  for (const match of String(html).matchAll(playerLinks)) {
    const rowStart = String(html).lastIndexOf("<tr", match.index);
    const rowEnd = String(html).indexOf("</tr>", match.index);
    if (rowStart < 0 || rowEnd < 0) continue;
    const row = String(html).slice(rowStart, rowEnd + 5);
    const rawCells = [
      ...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi),
    ].map((cell) => cell[1]);
    const cells = rawCells.map(cleanHtml);
    if (cells.length < 9) continue;

    // A few photo links retain a stale former-player slug. The named link in
    // the player cell is the canonical identity.
    const slug =
      rawCells[2]?.match(/href=["']players\/([^"']+\.htm)["']/i)?.[1] ??
      match[1];
    if (seen.has(slug)) continue;

    const rank = Number(cells[0].match(/^(\d+)/)?.[1]);
    const gradeText = cells.at(-1)?.replace(/\s*-\s*/g, "-") ?? "";
    const gradeMatch = gradeText.match(
      /^([2-8](?:\.5)?)\s+([2-8](?:\.5)?)-([2-8](?:\.5)?)$/,
    );
    if (!(rank > 0) || !gradeMatch) continue;

    const name = cells[2];
    const position = cells[3];
    const age = Number(cells[5]);
    const etaText = cells[7];
    const eta = Number(etaText.match(/20\d{2}/)?.[0]);
    const fv = soxGradeToFv(gradeMatch[1]);
    if (!name || !position || !fv) continue;

    seen.add(slug);
    prospects.push({
      slug: slug.replace(/\.htm$/i, ""),
      name,
      rank,
      position,
      age: Number.isFinite(age) ? age : null,
      eta: Number.isFinite(eta) ? eta : null,
      grade: Number(gradeMatch[1]),
      fv,
      floor: Number(gradeMatch[2]),
      ceiling: Number(gradeMatch[3]),
    });
  }

  return {
    sourceUrl: SOXPROSPECTS_URL,
    rankingsDate,
    prospects: prospects.sort((left, right) => left.rank - right.rank),
  };
}

export async function loadSoxProspects(fetchImpl = fetch) {
  const response = await fetchImpl(SOXPROSPECTS_URL, {
    headers: {
      "user-agent":
        "DugoutValueDataRefresh/1.0 (public-source snapshot; one request)",
    },
  });
  if (!response.ok)
    throw new Error(
      `SoxProspects download failed: ${response.status} ${response.statusText}`,
    );
  const parsed = parseSoxProspects(await response.text());
  if (parsed.prospects.length < 25)
    throw new Error(
      `SoxProspects grade payload is incomplete (${parsed.prospects.length} rows)`,
    );
  return parsed;
}
