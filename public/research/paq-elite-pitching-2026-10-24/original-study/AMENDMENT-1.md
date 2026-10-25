# Amendment 1 to the locked PAQ protocol (draft 4)

October 23, 2026. Written after the lock and before any real pitch-level data was parsed. Only synthetic fixtures had been run. The locked PROTOCOL.md is unchanged; its hash is still in LOCK.json. This amendment has its own hash, recorded in LOCK.json under `amendments`.

## A1. Q2's outcome measures the swing side of hittability

**Problem, found in synthetic testing.** H(i) = max(EV_swing, EV_take) − V(c) is high for obvious balls as well as for meatballs, because taking an obvious ball is valuable. The referee flagged this as minor note m1. Disciplined hitters may be attacked in the zone more often and see fewer obvious balls. Their mean H could then fall even when they get more pitches worth swinging at. On a fixture with a planted decision skill, the P1 coefficient came out negative, so Q2's "positive P1 coefficient" condition could fail exactly when the hypothesis is true. That does not test what Q2 states: "Does process earn better pitches *to hit*?"

**Change.** Q2's outcome becomes the hitter's later-period mean count-centred **swing hittability**:

- H_s(i) = EV_swing(i) − V(c_i)
- H_s*(i) = H_s(i) − h̄_s(c_i)

Here h̄_s(c) is the 2023 league mean of H_s in count c. Every other part of Q2 is unchanged: the baseline, the challenger, the fitting, the pass rule and the positive-P1 condition. The take side, H_t*(i) = EV_take(i) − V(c_i) minus its count mean, is reported descriptively, as minor note m1 already requires. The opponent-mix control becomes the later-period mean H_s* that his opponents threw to all other hitters.

Q5's elite-pitcher definition (bottom 20% by prior-season mean H) is changed the same way: it uses mean H_s.

## A2. T1 positive controls: what "predicts" means

**Positive control 1:** season-to-date lineup pitches per PA must predict the starter's outs recorded with a **negative** coefficient. More pitches per PA means fewer outs. The 95% CI must exclude 0.

**Positive control 2:** lineup P3 must predict the starter's pitches per BF with a **positive** coefficient whose 95% CI excludes 0.

A failed positive control is reported, and T1's result is then flagged as unreliable.

## A3. Home-plate umpire

The T1 home-plate-umpire fixed effect comes from the MLB Stats API game feed (`/api/v1/game/{game_pk}/boxscore`, `officials`). Requests are keyed by the `game_pk` values in the scheduled-games list for each date from `/api/v1/schedule`. Requests and hashes are saved. If a game's umpire can't be retrieved, that game gets its own "unknown" level, and the count of unknowns is reported.

## A4. No change to the power rule

T1's power rule stands as written. It is computed on 2022–2024 before any test-season scoring.
