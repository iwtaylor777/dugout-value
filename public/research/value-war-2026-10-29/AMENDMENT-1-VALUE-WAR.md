# Value-WAR protocol, Amendment 1 (October 29, 2026)

Written after a first development look at T1 on three 2016 splits, before any holdout season was computed and before any DV WAR parameters were tuned.

## What the development look showed

Within one season, nearly every player stays with his team in both halves. Because of that, T1 cannot tell credit that belongs to a player from credit that belongs to his team's environment, such as:
- defensive positioning;
- coaching;
- the fielders behind him.

That environment persists into the other half with him. On 2016 splits, the RA9-style framework had the best T1 defense correlation (.64, against .55 for FIP-style), even though it charges pitchers for their fielders' work. T1 is a fair test of whether credit is real signal rather than noise. It is not a test of whether credit sits with the right player.

## Test added: T7, roster churn (co-primary)

Credit that belongs to a player should leave a team when he leaves and arrive with him at his new team. Credit that belongs to the team's environment should not.

For each team and each pair of consecutive seasons (T, T+1):

1. **Predicted change.** Each system's player rates are measured over full season T. The predicted change is

   Σ rate_T × (playing time in T+1 per game − playing time in T per game).

   - Playing time is plate appearances for batting, batters faced for pitching, and defensive outs for fielding.
   - The sum covers each player's time with that team only.
   - This reflects arrivals, departures and changes in role.
2. **Actual change.** The team's run differential per game in T+1 minus that in T.
3. **What carries over cancels.** Anything about the team that carries over from T to T+1 drops out of both sides, so a system scores well only if the credit it gives moves with the players.

Results:
- **Reported:** the correlation between predicted and actual change, and its leave-one-season-out RMSE, with the paired bootstrap over team-pairs (2,000 resamples).
- **Also reported separately:** offense and defense.
- **Seasons:** pairs with T+1 in 2022–26 are the holdout. Pairs with T+1 in 2017, 2018, 2019 and 2021 (2019 to 2021, skipping 2020) are development. Pairs involving 2020 are excluded otherwise.
- **Systems:** the same three Statcast-rebuilt frameworks as T1. For season-level checks, published fWAR and fWAR with FanGraphs RA9-WAR for pitchers are also scored, as WAR per PA and per batter faced.

## Win rules

- **T1 (unchanged):** DV WAR "measures value better" if its pooled 2022–26 average correlation for run differential beats both the FIP-style and RA9-style frameworks, with both bootstrap intervals excluding zero.
- **T7 (new):** DV WAR "assigns credit to the right players better" if its pooled holdout correlation for run differential beats both frameworks, with both intervals excluding zero.

The two claims are made separately. All tests are reported whatever they show.
