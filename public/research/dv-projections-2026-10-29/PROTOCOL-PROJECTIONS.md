# Dugout Value projections: benchmark protocol

Written October 27, 2026, before any Dugout Value projection was scored. The hash and time of this file are in `LOCK-PROTOCOL.json`. Later changes are dated amendments.

## Goal

Build a projection system that predicts next-season performance at least as well as ZiPS and Steamer, using only information available before the season.

## Comparison systems

The comparison systems are the preseason ZiPS and Steamer projections, as published on FanGraphs before Opening Day. They are read from Internet Archive captures, or for 2026 from FanGraphs' preseason endpoint, with the timestamps and checksums recorded in `archive/manifest.json`. Coverage:

| Season | ZiPS hitters | ZiPS pitchers | Steamer hitters | Steamer pitchers |
|---|---|---|---|---|
| 2023 | ✓ | ✓ | ✓ | no capture |
| 2024 | ✓ | ✓ | ✓ | ✓ |
| 2025 | ✓ | ✓ | ✓ | ✓ |
| 2026 | ✓ | ✓ | ✓ | ✓ |

## Information set

A Dugout Value projection for season T may use FanGraphs season leaderboards through T−1, including Statcast-derived columns, plus age, handedness and position. Phase 2 adds minor-league statistics through T−1. The model is fit only on seasons that ended before T. Nothing from season T enters a projection for T.

## Scored players

**Phase 1 covers established players.** A hitter is included if he has at least 100 MLB plate appearances in T−3 through T−1. A pitcher is included if he has at least 20 MLB innings in that window.

**Each comparison uses only players that every compared system projected.** Players are matched by FanGraphs ID.

**Minimum playing time in season T:**
- Hitters: at least 200 plate appearances.
- Pitchers: at least 40 innings.

Players below the minimum are not scored on rates. Playing time is scored separately in Phase 3.

## Metrics

| Group | Primary metric | Secondary metrics |
|---|---|---|
| Hitters | PA-weighted RMSE of wOBA | PA-weighted RMSE of K%, BB%, ISO and WAR per 600 PA |
| Pitchers | IP-weighted RMSE of FIP | IP-weighted RMSE of ERA, K%, BB% and WAR per 180 IP |

Every comparison is reported with a paired bootstrap 95% interval over players (2,000 resamples, seed 20261027). The interval covers each difference against ZiPS and against Steamer.

## Seasons

- **Development:** 2023 and 2024. Models may be fit, compared and tuned freely on these seasons. Every development run is logged.
- **Holdout:** 2025 and 2026. A model is scored on the holdout only after its code is locked by hash. Every holdout run is reported, including failures.

**Disclosure.** These seasons have been examined in other Dugout Value studies, and the 2026 season-update calibration used 2026 outcomes. The holdout is untouched only in the sense that no Dugout Value projection model has been fit or tuned on it.

## Win rule

A locked model wins a group (hitters or pitchers) if both hold on the pooled 2025–26 holdout:

1. Its primary-metric RMSE is lower than both ZiPS's and Steamer's.
2. It is not worse than either system by more than 0.002 wOBA (hitters) or 0.05 FIP (pitchers) in either single season.

The site may offer the Dugout Value system as an option once it wins a group. It may become the default only after winning both groups.
