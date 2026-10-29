# Validation protocol, Amendment 1 (October 28, 2026)

Written after tests W, R and A were scored and before any of the tests below was computed.

## What the first results showed

Tests W, R and A had little power to separate the systems. All their 95% intervals for the differences cross zero, with 90 pooled team-seasons. On wins, the last-season baseline had the highest point estimate.

## Tests added

These tests are exploratory, added because the first ones had too little power:

### E: player run value

The test is at the player level, so the sample is much larger.

- **Hitters:** correlation of projected wOBA with actual RE24 per PA in season T, weighted by PA. RE24 is FanGraphs' base-out run expectancy, which is measured independently of the wOBA linear weights. The sample is players projected by every system with at least 200 PA.
- **Pitchers:** correlation of projected FIP with actual RE24 per batter faced (RE24 allowed), weighted by innings. The sample is pitchers with at least 40 IP.
- **Reporting:** pooled 2024–26 and by season, with paired bootstrap intervals over players.

### W2: wins with separate slopes

Wins on projected hitter WAR and projected pitcher WAR as two separate predictors. Reported as the leave-one-season-out RMSE. This checks whether a system's ranking on test W comes from how it scales hitters against pitchers rather than from how it ranks players.

## Unchanged

Test P (pay) runs as specified in the original protocol.
