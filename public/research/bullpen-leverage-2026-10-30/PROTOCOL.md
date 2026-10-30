# Bullpen leverage study: plan (written October 30, 2026, before any result was computed)

Question: do teams give their highest-leverage relief work to their best relievers, and what does misallocation cost? Secondary: do managers move relievers into and out of big spots based on ERA, which is mostly noise in a half-season, rather than on the underlying skill?

Data: Statcast pitch-level data, regular seasons 2015-2026 (2020 excluded from the leverage table). FanGraphs season leaderboards for pitcher identity. DV preseason projections (data through the prior season) for 2021-2026; archived preseason ZiPS for 2023-2026 as a robustness check.

Definitions (fixed now)
- Leverage index (LI): for each game state (inning 1-8, 9, extra; top/bottom; batting team's score margin clipped to -4..+4; outs; base occupancy), the mean absolute change in home win expectancy over a plate appearance, divided by the mean over all plate appearances. Win-expectancy changes come from Statcast's delta_home_win_exp summed over the PA. States with fewer than 200 PAs borrow from the same state with innings 1-6 pooled.
- Reliever PA: any PA where the pitcher is not his team's first pitcher of the game. Position players pitching are excluded (pitchers without a DV or ZiPS projection, or with a projection worse than 6.50 FIP, are dropped).
- Talent: DV preseason FIP projection. A second, in-season version updates it daily with the pitcher's season-to-date FIP, treating the projection as 60 innings of prior evidence (credible weight IP/(IP+60)).
- Run value of a PA: (league FIP - talent FIP) / 9 / 4.25 runs saved per batter faced, times LI. Wins = runs / 10.
- Allocation efficiency (team-season): PA-weighted correlation between talent and LI among relievers; and wins lost = (value if the team's reliever PAs were reassigned so the highest-LI PAs go to its best relievers, holding each reliever's PA count fixed) - (actual value). This is an upper bound: it ignores fatigue, handedness and injuries.
- Realistic misses: for each relief PA with LI >= 1.5, the best reliever on the same team who did not pitch on the previous day and pitched for that team within 10 days either side of the game (a proxy for being on the active roster), using in-season talent. Cost = LI x (talent gap) for PAs where that reliever was at least 0.50 FIP better than the one used. Fatigue beyond the previous day is not modeled.
- ERA-chasing test: relievers with 15+ first-half IP for one team. Outcome: change in mean LI from the first half to the second half (split at the All-Star break, approximated as July 15). Predictors entered together: first-half ERA minus first-half FIP (luck), first-half FIP minus preseason projection (skill news) and the preseason projection. If managers respond to luck, the first coefficient is positive in the expected direction (higher ERA, lower leverage). Separately, check that first-half ERA - FIP does not predict second-half FIP or RA9 beyond the other two.

Case studies: the 2026 World Series teams (Milwaukee, Tampa Bay), and the most and least efficient 2026 bullpens.

These are descriptive estimates from seasons not previously used for this question. No result will be withheld for being unflattering.
