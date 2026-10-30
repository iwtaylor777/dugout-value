# Independent WAR audit and exploratory experiments

Recorded October 29, 2026 (America/New_York), after reading the existing v1/v2 results and before computing the experiments below. This is retrospective research, not a new untouched holdout. The original v1 files and the prospective v2 specification will not change.

## Questions

1. Does replacing half of batting outcome residual with contact value help separately from halving fielding?
2. Is a fielding model that distributes expected outs among all fielders more useful than assigning every failed play to one outcome-dependent fielder?
3. How much of transfer accuracy can be achieved without knowing which player earned the credit?

## Fixed specifications

Reconstruct v1 using its event model recipe and locked parameters. Keep reconstructed FIP-style, RA9-style, v1 and the preregistered v2 hybrid as references. Use the same raw data and inputs for each compared system. Any reconstruction difference from the original data is disclosed.

Two new candidates, with no weight search:

- Contact-only: v2 batting (50% actual/contact residual), full fielding credit, FIP-style pitching and full framing.
- Distributed-outs: the same batting and pitching, with full fielding credit based on a cross-fitted multiclass model of which position records an out (or no out), using only contact/park/alignment features and no player identities. On hits, debit each on-field player his predicted share of outs, rather than choose one failed fielder. Runs per out = the sample's mean hit run value minus mean non-HR out run value. Center within position; home runs are excluded from fielding chances. No player-level shrinkage.

For the published fWAR layer, separately compare unmodified fWAR, batting-only adjustment, fielding-only adjustment, and both adjustments. Keep all other fWAR components fixed. Recompute rates after aggregating opportunity and value, and normalize actual innings notation.

## Data and evaluation

Use recovered regular-season Statcast and local FanGraphs inputs, with explicit duplicate removal, coverage checks and hashes. Development seasons: available 2016–19, 2021. Previously examined validation seasons: available 2022–26. If original full data cannot be recovered, use the available years and say so; do not impute missing fielding data. At minimum, perform a fixed three-split reconstruction of 2023–25 and full-season roster comparisons where data are complete.

- Half-season: games assigned by the original fixed hash; both directions. Report offense and defense independently, then combined RD. Use the same players and target opportunities.
- Season transfer and roster change: use official team RS/RA and wins rather than reconstruct outcomes from pitch terminal rows. Report year-specific values as well as pooled correlations and calibrated prediction errors. New players with no prior observation receive league average in every system.
- Mover diagnostic: prior rates versus next-season actual batting rates, separating team changers and stayers. This tests portability/prediction, not a directly observed individual WAR truth.
- Identity falsification: permute player rates within source teams and opportunity bins, then transfer. This measures how much a team-environment proxy can pass without assigning individual credit. It is a diagnostic, not a trained candidate.
- Uncertainty: paired resampling of repeated team identities, season blocks as a sensitivity, and player clusters for player outcomes. Repeated random splits are not independent seasons. Report all fixed candidates and failures; no declaration of a new WAR from the best observed variant.

## Interpretation

A batting-only transfer gain does not validate a fielding haircut. Correlation with salary and next-season stability do not establish retrospective value attribution. A candidate qualifies as promising only if its advantage is not confined to one reused test or season and survives the identity diagnostic. Even a positive result needs an untouched prospective test. No website, player values, or 2027 preregistration will change during this audit.

## Code-review diagnostic added before component results

FanGraphs documents subtracting catcher framing from pitcher FIP-WAR. The reconstructed FIP reference gives full framing to catchers without removing it from pitchers; the locked DV and v2 weights also remove none (`gam_p=0`). Add a balanced-framing diagnostic to the FIP and contact-only references (subtract each pitcher's framing runs, keeping catcher credit unchanged). Report these as a baseline-fidelity check, not a post-result weight optimization. Distributed-outs model parameters are fixed in `components.py` before any candidate score: 100 boosted trees, 15 leaves, minimum leaf 100, learning rate .05, four folds grouped by game.
