# Does a better WAR exist? Protocol for testing a value metric

Written October 29, 2026, before any version of the Dugout Value WAR (DV WAR) was built or scored. The hash and time of this file are in `LOCK-PROTOCOL-VALUE-WAR.json`. Later changes are dated amendments.

## Question

WAR claims to measure how much a player contributed to his team's wins. No one observes a single player's contribution, but every team's runs and wins are observed. A metric that credits the right players should hold up when those players' credit is used to explain team results it was not computed from. This study asks whether a WAR built with Statcast data does that better than the established frameworks.

This is separate from the projection study (`PROTOCOL-PROJECTIONS.md`), which predicts FanGraphs WAR as FanGraphs constructs it.

## Systems compared

1. **FanGraphs WAR (fWAR).**
   - Hitters: linear-weights batting on actual outcomes.
   - Pitchers: FIP, which gives the pitcher no credit or blame for balls in play other than home runs.
2. **Runs-allowed WAR (RA9 framework).**
   - Hitters: the same as fWAR.
   - Pitchers: charged with all runs allowed, adjusted for the defense behind them. This is the approach Baseball-Reference uses.
   - Season-level tests use FanGraphs' published RA9-WAR for pitchers.
   - Baseball-Reference's own WAR can't be downloaded from this environment, so it is not compared directly.
3. **DV WAR.** Event-level credit attribution from Statcast. Each plate appearance's run value is split among:
   - the batter;
   - the pitcher;
   - the fielders;
   - the catcher (framing);
   - an unassigned share for chance.

   The split uses weights that are the same for every player. The weights are estimated on development seasons only.

   **No player-level shrinkage.** A player's value is still the sum of what happened in his own plate appearances, batters faced and chances. The metric never regresses a player toward average on the basis of his sample size. This is what separates a value measure from a talent projection.

## Two levels of comparison

**Split-season tests** need every system computed on arbitrary subsets of games. Published WAR is only available for full seasons, so all three frameworks are rebuilt here from the same Statcast pitch data on the same games:

| Framework | Batting | Pitching | Fielding | Framing |
|---|---|---|---|---|
| **FIP-style** (fWAR framework) | Linear weights on actual events | FIP runs | Full credit for outs above expected, by responsible fielder | Full credit |
| **RA9-style** | Linear weights on actual events | Linear-weight runs allowed on actual events, minus the fielding credit earned behind the pitcher | Same as FIP-style | Same as FIP-style |
| **DV** | Attribution weights | Attribution weights | Attribution weights | Attribution weights |

**Season-level tests** use:
- the published FanGraphs numbers (WAR, and RA9-WAR for pitchers);
- DV WAR computed for full seasons.

## Data

- **Statcast pitch-level data, 2015–26 regular seasons, from Baseball Savant.**
  - Events, base-out states, run expectancy changes, batted-ball exit velocity, launch angle and spray.
  - Fielders on the field for each pitch.
  - Pitch location and count.
- **Savant season leaderboards:** sprint speed, outs above average, fielding run value (including framing) and baserunning run value.
- **FanGraphs season leaderboards** (WAR, RA9-WAR and components) and the FanGraphs free-agent tracker, 2020–26.
- **MLB statsapi** for team schedules and results.

## Seasons

- **Development: 2016–21.** 2015 is used only as a prior season, and 2020 is excluded as a test target.
  - DV WAR may be built, compared and tuned freely on these seasons. Every development run is logged in `DEVLOG-WAR.md`.
- **Holdout: 2022–26.**
  - No split-season result for any system is computed on these seasons until DV WAR's code is locked by hash.
  - Every holdout run is reported, including failures.
  - **Disclosure.** FanGraphs season data for these years has been used in other Dugout Value studies.

## Tests

### T1: split-season transfer (primary)

1. **Split the games.** For each season, games are randomly split into halves A and B using a hash of the game ID. Ten different random splits are used (seed 20261029).
2. **Measure each player in A only.** Every player's value rate is measured in half A:
   - runs above average per plate appearance for batting;
   - per batter faced for pitching;
   - per defensive out played in the field for fielders and catchers.
3. **Predict each team's half B.** Each team's B run differential per game is predicted as the sum of its players' A rates times their actual B playing time. A player with no A playing time gets zero (average) in every system.
4. **Repeat in reverse.** B predicts A the same way.

Results:
- **Reported:** the correlation between predicted and actual run differential, and its leave-one-season-out RMSE after a linear fit. Both are averaged over the 10 splits and both directions.
- **Interval:** the difference between DV and each other framework gets a bootstrap 95% interval over team-seasons (2,000 resamples), recomputing the split averages on each resample.
- **Also reported separately:** runs scored (offense) and runs allowed (pitching plus fielding).

*Why this is the primary test.* Credit that belongs to a player moves with him into games he wasn't measured in. Credit that came from teammates, fielders behind him, parks or chance does not.

### T2: split-season accounting (secondary)

The same splits, but each half's credit is compared with the same half's run differential.

A framework built from actual runs allowed is expected to do best here, because it is partly made of the outcome. The test shows how much accounting accuracy each framework gives up.

### T3: season transfer (secondary)

Each player's WAR rate in season T, times his actual playing time in T+1 for his T+1 team, predicts team wins in T+1. Holdout targets are 2023–26.

The test compares:
- published fWAR;
- fWAR for hitters plus FanGraphs RA9-WAR for pitchers;
- DV WAR.

Reported as the correlation and leave-one-season-out RMSE, with paired bootstrap intervals.

### T4: season accounting (secondary)

Team total WAR in season T against team wins in T, for 2022–26.

### T5: pay (secondary)

Log AAV against each player's WAR per season over the three seasons before signing, for FanGraphs-tracker free agents signed for 2020–26 (guaranteed MLB deals of at least $2M AAV).

- Pay was never used to build DV WAR, so all those years count.
- Log AAV is centered within each signing year.
- Reported as the correlation, with paired bootstrap intervals over players.
- **Caveat:** teams see public WAR, so the market's prices are partly built from the established metrics.

### T6: stability (secondary)

The year-to-year correlation of each player's WAR per 600 PA (hitters) or per 180 IP (pitchers). This is a sanity check, not a value test.

## Win rule

DV WAR "measures value better" if, on the pooled 2022–26 holdout of T1 (run differential), its average correlation is higher than both the FIP-style and the RA9-style frameworks, and both bootstrap intervals exclude zero.

The secondary tests are reported in full whatever they show.

## Reporting

Every test is reported, including the ones DV WAR loses.
