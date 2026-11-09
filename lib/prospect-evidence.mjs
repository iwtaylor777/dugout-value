// Evidence a graduate has produced since his last FanGraphs prospect grade.
// The rookie blend in lib/value-model.mjs (prospectGradeWeight) shrinks the
// grade's weight as this evidence accumulates. Built by
// scripts/build-prospect-evidence.mjs and stored in data/prospect-evidence.json.

export const EVIDENCE_LEVELS = new Set(["MLB", "AAA", "AA"]);

// Counts what the weight was calibrated on: MLB PA since the grade, plus
// Double-A and Triple-A PA in seasons after the player's first MLB season in
// that window (the season-after-debut demotion case). Minor-league time in or
// before the debut season is not counted, matching the calibration sample.
export function evidenceFromStats(payload, fromSeason, throughSeason) {
  const totals = { pa: 0, mlbPa: 0, upperMinorsPa: 0, bf: 0, mlbBf: 0, upperMinorsBf: 0, firstMlbSeason: null };
  const lines = [];
  for (const group of payload?.stats ?? []) {
    const hitting = group.group?.displayName === "hitting";
    for (const split of group.splits ?? []) {
      const season = Number(split.season);
      const level = split.sport?.abbreviation;
      if (!(season >= fromSeason && season <= throughSeason)) continue;
      if (!EVIDENCE_LEVELS.has(level)) continue;
      const count = Number(
        hitting ? split.stat?.plateAppearances : split.stat?.battersFaced,
      );
      if (!Number.isFinite(count) || count <= 0) continue;
      lines.push({ hitting, season, level, count });
    }
  }
  const mlbSeasons = lines.filter((line) => line.level === "MLB").map((line) => line.season);
  totals.firstMlbSeason = mlbSeasons.length ? Math.min(...mlbSeasons) : null;
  for (const line of lines) {
    const mlb = line.level === "MLB";
    if (!mlb && !(totals.firstMlbSeason !== null && line.season > totals.firstMlbSeason)) continue;
    if (line.hitting) {
      totals.pa += line.count;
      totals[mlb ? "mlbPa" : "upperMinorsPa"] += line.count;
    } else {
      totals.bf += line.count;
      totals[mlb ? "mlbBf" : "upperMinorsBf"] += line.count;
    }
  }
  return totals;
}

// Attach stored evidence to matching grades. Evidence recorded against an
// older grade is ignored, so a new FanGraphs grade starts from zero PA.
export function applyProspectEvidence(database, evidence) {
  let applied = 0;
  for (const player of database.players) {
    const entry = evidence?.players?.[player.id];
    if (!player.lastProspect || !entry) continue;
    if (Number(entry.gradeYear) !== Number(player.lastProspect.year)) continue;
    player.lastProspect.evidence = {
      pa: entry.pa,
      mlbPa: entry.mlbPa,
      upperMinorsPa: entry.upperMinorsPa,
      bf: entry.bf,
      firstMlbSeason: entry.firstMlbSeason,
      through: entry.throughSeason,
    };
    applied += 1;
  }
  return applied;
}
