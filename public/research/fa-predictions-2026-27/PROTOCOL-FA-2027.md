# Dugout Value free-agent contract predictions, 2026–27 offseason

Frozen before free agency opens. The hash of this file and of the predictions file goes in `LOCK-FA-2027.json`, with a UTC timestamp. Nothing here is revised after the freeze. Corrections are dated amendments, and any made after a player signs are reported as deviations.

## What is predicted

For the 30 most valuable MLB free agents the model expects to reach the market, plus Teruaki Sato (31 players), we predict:
- the years of the guaranteed contract;
- the total guaranteed value;
- the average annual value (AAV), which is total divided by years.

Under the site's convention, a free agent's price on an open market should be close to the trade model's estimate of his value. So the prediction **is** the model's value. Where we see a concrete reason the market should pay something different, we say so in a flag, but the number doesn't change.

## Inputs (snapshot hashes in `LOCK-FA-2027.json`)

- **Free-agent class.** MLB Trade Rumors' 2026–27 free-agent list, updated October 19, 2026, saved as `mlbtr_list.txt`. Each entry carries its option or opt-out note. Teruaki Sato (Hanshin, NPB) is added because Hanshin has announced it will post him.
- **Projections.** The Dugout Value player database, refreshed October 18, 2026, after the regular season: ZiPS WAR for 2027–28. Later seasons come from the site's ZiPS-anchored aging model (`lib/aging-curve.mjs`), with the same formulas the site uses.
- **Sato.** He has no MLB projection. We translate his NPB record with a fixed, simple rule:
  - weight his last three NPB seasons' wRC+ 3:2:1 (196, 182, 134 gives 181);
  - MLB wRC+ = 100 + 0.25 × (NPB − 100), which gives 120;
  - at 600 PA that is about +14 batting runs. Adding −3 runs for position (a corner infield/outfield mix), 0 defensive runs and +20 replacement runs gives 31 runs, or 28 at 550 PA, which is about 2.9 WAR at 10 runs per win;
  - we round that down to **2.8 WAR in 2027** because his NPB strikeout rate is about 27%;
  - later seasons use the site's aging model for a 28-year-old position player.
- **Model.** Dugout Value trade model **2026-10-25.2** (see Amendment 1). This version was recalibrated on 2020–26 free-agent contracts before this freeze. Its defaults:
  - $10.5M per WAR, a 10% star premium above 2 WAR, 3% annual inflation and a 10% discount rate;
  - roster burdens of 0.5 WAR (regulars) and 0.2 WAR (relievers);
  - a 50% premium for relievers in seasons projected above 0.8 WAR.

  The calibration used FanGraphs' free-agent tracker, with projections at signing for the 2026 class. Hitters and starters signed for 1.06× the model's value in aggregate, and relievers above 0.8 WAR for 0.96×. The 27 largest non-reliever contracts of 2020–26 (at least $150M in 2026 dollars, valued with a weighted three-year WAR average) signed for 0.94×. Details are in `analysis/fa_market_calibration`.

## Price rule

For a term of N seasons starting in 2027, the predicted AAV is the flat salary whose present value at the model's 10% discount rate equals the present value of the player's projected market value, season by season, from `marketValueForSeason`. That is the contract the model scores as zero surplus. Total = AAV × N.

## Term rule

- **Eligible seasons.** Count consecutive seasons from 2027 in which projected WAR is at least 1.0 (0.5 for relievers) and the player is no older than 37 (hitters) or 36 (pitchers).
- **Caps by 2027 projected WAR:**

| Role | 2027 projected WAR | Maximum years |
|---|---|---|
| Hitters | under 2 | 2 |
| | 2 to under 3 | 4 |
| | 3 to under 4 | 6 |
| | 4 to under 5 | 8 |
| | 5 or more | 10 |
| Starters | under 2 | 2 |
| | 2 to under 3 | 4 |
| | 3 to under 4.5 | 6 |
| | 4.5 or more | 8 |
| Relievers | under 1.0 | 2 |
| | 1.0 to under 1.5 | 3 |
| | 1.5 or more | 4 |

- **Age caps.** Players aged 34 or 35 in 2027 get at most 2 years; 36 and older get 1.
- **Elite exception.** Players projected at 4.5 WAR or more in 2027 may go to 10 years, with the age limit raised by 3 (to 39 for pitchers and 40 for hitters). That's in line with the longest recent deals for players at that level: Cole got 9 years at 29 and Yamamoto 12 at 25.
- **Minimum** 1 year.

## Who reaches the market (decided now, from the model)

- **Club options.** Exercised, so the player is excluded, if his 2027 market value is at least the option price minus the buyout.
- **Mutual options.** Treated as declined; the player is a free agent.
- **Player options and opt-outs.** Kept, so the player is excluded, if the predicted contract total is at or below the money still guaranteed.
- **Exclusions.**
  - Emmanuel Clase, because his pending federal case makes his market unpredictable.
  - Players missing from the database; the list records them.
- **The list.** The 30 highest predicted totals among the remaining MLB free agents, plus Sato. Ties at the cutoff are broken by AAV, then alphabetically.

## Scoring (after the market settles)

A player is scored once he signs a guaranteed MLB contract, through Opening Day 2027. He drops out of scoring if he doesn't reach free agency (option exercised, opt-out not used), signs a minor-league deal, retires, or, for Sato, isn't signed within the posting window. Each of those cases is reported.

- **Actual values.**
  - Total guaranteed value includes signing bonuses and buyouts.
  - Player and mutual options are counted only through the guaranteed years, plus buyouts.
  - Deferred money is counted at face value. If MLB's present value is published, it is reported too.
- **Primary metric.** Mean absolute error of log(total) across scored players, with a bootstrap 95% interval (by player, seed 20261029).
- **Secondary metrics.** Mean absolute error in years, mean absolute error of log(AAV), and the share of players whose actual total falls within ±25% of our prediction.
- **Benchmarks.**
  - **FanGraphs crowdsourced median.** Years × AAV, read from the FanGraphs free-agent tracker on the day it's first available, with that date recorded. A player counts only if the capture is before he signs.
  - **MLB Trade Rumors' top-50 predictions.** Captured on publication, with the date recorded. If published after this freeze, they are a benchmark, not a competitor that saw our numbers first.
  - Comparisons use only players that have every prediction.
- **Flags.** Each flag states a direction (for example "expect below the model"). Flags are scored separately as hit or miss. They never change the numeric prediction.

## Order of operations

1. Freeze: write the predictions file, hash this protocol and the inputs, and record the UTC time. This happens before October 30, 2026, ahead of the earliest possible opening of free agency.
2. Publish the article with the frozen table and a link to these files.
3. Capture the benchmarks when they appear.
4. Score in a dated follow-up once the top 30 have signed, or by Opening Day 2027, whichever comes first.

## Amendment 1 (October 25, 2026, before free agency opened)

The first freeze (lock time 2026-10-25T22:08:19Z) used model 2026-10-25.1: $11M per WAR and a 20% star premium. It priced Tarik Skubal at 10 years and $533.6M. Before free agency opened, and before any benchmark or signing was observed, we checked those settings against the largest long-term contracts of 2020–26. At $11M and 20%, those deals signed for 0.87× the model (0.78× for deals of seven years or more); Gerrit Cole's nine-year deal signed for 0.81×. We changed the defaults to $10.5M and 10%, which gives 1.06× on the 2026 class and 0.94× on the largest deals, and re-froze under model 2026-10-25.2.

Nothing else changed: not the rules for price, term, market reach or scoring, and not the inputs. The same 31 players are predicted, with the same terms, and every total is 4–9% lower. The first freeze's protocol, predictions and lock are kept in `superseded/` and listed in `LOCK-FA-2027.json`. Scoring uses this freeze. The first freeze is scored alongside it for reference only.
