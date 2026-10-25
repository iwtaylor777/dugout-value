# Historical MiLB hitting data feasibility

## Scope

This validates dated minor-league hitting requests using the two prospects in `analysis/projection_baselines/results/inputs.json`:

- Marcelo Mayer (MLBAM 691785), train-side cutoff 2024-05-31, Double-A (sportId 12).
- Roman Anthony (MLBAM 701350), evaluation-side cutoff 2025-05-31, Triple-A (sportId 11).

The test compares official MLB StatsAPI global date-range totals with each player's official game-log splits filtered inclusively through the same cutoff. It also compares the next-day range and full-season range with game logs and final-season player stats. This is a bounded two-player/two-season feasibility check, not a model fit or a full-catalog validation.

## Verified request patterns

The working global date-range request was:

`GET https://statsapi.mlb.com/api/v1/stats?stats=byDateRange&group=hitting&personId={MLBAM_ID}&sportIds={SPORT_ID}&season={SEASON}&startDate=03/01/{SEASON}&endDate={CUTOFF}&gameType=R&playerPool=ALL&limit=100`

The working individual game-log request was:

`GET https://statsapi.mlb.com/api/v1/people/{MLBAM_ID}/stats?stats=gameLog&group=hitting&sportId={SPORT_ID}&season={SEASON}&gameType=R`

Final season comparison used the same player endpoint with `stats=season`. Actual encoded request URLs, response hashes, and retrieval metadata are in `validated-aggregates.json` and each `.json.source.json` sidecar in `raw/`.

The global `byDateRange` requests returned one split per player, with matching player ID, team, sport ID/name, season, and count totals. The existing all-player AAA response `raw/probe-2025-aaa.json` has 639 splits and independently contains exactly one Anthony row; its cutoff count fields also match the filtered game log. The official response identifies sportId 12 as Double-A (AA) for Mayer and sportId 11 as Triple-A (AAA) for Anthony. The people game-log endpoint uses singular `sportId`; the global stats endpoint uses `sportIds`.

## Results and cutoff checks

Every compared additive count field matched between the global `byDateRange` response and game-log rows filtered to the same cutoff date. The adjacent-day range also matched game logs. Full date-range counts matched both the complete season game logs and the player-specific `stats=season` response.

| Player and level | Through cutoff | Through next day | Full season | First later game in full log |
|---|---:|---:|---:|---|
| Mayer, 2024 AA | 46 G, 203 PA | 47 G, 209 PA | 77 G, 335 PA | 2024-06-01 |
| Anthony, 2025 AAA | 52 G, 237 PA | 53 G, 242 PA | 58 G, 265 PA | 2025-06-01 |

This demonstrates the date filter on these two cases and shows the leakage risk directly: final-season rows extend beyond the forecast cutoffs. For a forecast issued before that day's games, set the data cutoff to the prior game date; this test validates calendar-date inclusivity, not intraday availability.

`feature-aggregate.json` contains cutoff-safe descriptive counts and derived rates from game-log rows through each cutoff. These are observed historical features, not predictions. The API date-range response omits some fields present in game logs (for example, `flyOuts` in these payloads), so the aggregate is based on explicit common count fields. Do not infer zero from a missing field or missing split without a separate completeness check.

## Limits

- Only Mayer (AA, 2024) and Anthony (AAA, 2025) were checked; sport levels 13/14, other players, trades, non-regular game types, and missing-split behavior remain unvalidated.
- The date-range endpoint is a retrospective query made in 2026. Its filters reproduce the checked historical totals, but this does not prove that every stat correction was known in real time on the forecast date.
- A positive one-split response was seen for both players at each tested range; empty-split versus true-zero semantics were not tested.

## Primary source

All saved stat payloads are direct MLB StatsAPI responses: `https://statsapi.mlb.com/api/v1/stats` and `https://statsapi.mlb.com/api/v1/people/{personId}/stats`. The response bodies include MLB copyright, player/team/sport metadata, and date/game-log splits. SHA-256 hashes and request URLs are preserved beside each raw response.

## 2024 Double-A source-row audit

The all-player 2024 prior-season payload `raw/2024-12-prior.json` contains 742 unique player rows. Its request filtered `sportIds=12`; 741 returned rows identify sportId 12, and one row for Esteban Mejia (800354) incorrectly identifies sportId 14 / Carolina League 122 while naming Frisco RoughRiders (teamId 540). This is a metadata inconsistency in the MLB StatsAPI global all-player response.

Targeted primary-source checks resolve the stat line: Mejia's `people/800354/stats?stats=gameLog&group=hitting&sportId=12&season=2024&gameType=R` has one Aug. 11 game for Frisco, Texas League 109, sportId 12, with 3 PA. His individual `stats=season` response for sportId 12 is 1 G / 3 PA for Frisco; sportId 14 is a different 50 G / 186 PA line for Down East Wood Ducks, Carolina League 122. The malformed global row's count fields match the true AA line, but its sport and league fields match the player's other-level assignment. StatsAPI does not explain the internal cause; the evidence supports a row metadata spillover, not three Low-A PA by Frisco. Keep the raw row quarantined from level-based feature joins until it is reclassified from the individual game log/team mapping; do not count the 3 PA as zero.

I compared all 742 row team IDs with MLB's 2024 team list filtered to sportId 12 (`/api/v1/teams?season=2024&sportIds=12`): all 30 team IDs were found and team metadata lists them as Double-A. No player IDs are duplicated or missing. Two additional Portland Sea Dogs (teamId 546) rows, Kyle Teel (691019) and Roman Anthony (701350), have leagueId 117 (International League) in the global rollup despite correct sportId 12. MLB's 2024 team record for Portland is Double-A / Eastern League 113, and both players' individual 2024 sportId-12 season lines and game logs report Eastern League 113. Their global rollup count fields match the individual season counts. Thus there is one wrong sport field and two wrong league fields; the remaining 739 rows agree with their official team sport/league metadata and no other row violates the requested AA sport filter. The individual season-count comparison was limited to the three rows with metadata anomalies; this audit did not re-fetch every other player’s stats.

Relevant request forms used:

- Team mapping: `https://statsapi.mlb.com/api/v1/teams?season=2024&sportIds=12`
- Esteban level-specific game log: `https://statsapi.mlb.com/api/v1/people/800354/stats?stats=gameLog&group=hitting&sportId=12&season=2024&gameType=R`
- Esteban level-specific season totals: same endpoint with `stats=season` and `sportId=12` or `sportId=14`.

## Boston training-date roster spot-check

The saved active-roster response `raw/2024-roster-111.json` is dated 2024-05-31. It includes David Hamilton (666152) as active and omits Trevor Story (596115), consistent with the known April 7 Story IL placement / Hamilton recall. The source URL and SHA-256 are in its sidecar. This is a spot-check for Boston and the two referenced players only.
