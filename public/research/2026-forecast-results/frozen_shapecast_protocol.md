# ShapeCast 2026 prospective protocol

Version: 0.1  
Frozen July 23, 2026, before importing or inspecting any post–All-Star-break
2026 Statcast data.

## Status

The local 2026 source contains regular-season pitches from March 25 through July
12. There are no post-break games in the workspace. Because this protocol is
being written after some post-break games have occurred in the world, it is
described as **workspace-blind prospective**, not calendar-pristine prospective.
No external post-break results may be queried while constructing the forecast.

## Coordinate harmonization

Through 2025, Statcast `plate_x` and `plate_z` were measured at the front of home
plate. In 2026 they are measured at the middle to align with ABS. Reconstruct the
ball trajectory using:

`q(t) = q0 + vq0*t + 0.5*aq*t^2`, for `q` in `x, y, z`.

Solve the positive flight-time root for:

- historical front plane: `y = 17/12 ft`;
- 2026 middle plane: `y = 17/24 ft`.

The bridge is accepted only if:

1. Reconstructed front-plane 2024 and 2025 coordinates have median absolute
   error below 0.03 ft against published `plate_x` and `plate_z`.
2. Reconstructed 2026 middle-plane coordinates fit published coordinates
   materially better than reconstructed front-plane coordinates.
3. At least 97% of eligible 2026 pitches have valid trajectory solutions.

For ShapeCast, replace 2026 `plate_x` and `plate_z` with reconstructed
front-plane values before computing batter-relative horizontal location and
normalized vertical location. Preserve release, movement, and velocity as
published. The ABS-defined `sz_top`/`sz_bot` remain a known rules-era difference
and are disclosed rather than retrospectively quantile-mapped.

## Historical cutoff analog

Rebuild the locked full 61-input ShapeCast and 16-input comparator using July 15
as the source cutoff and July 16 through season end as target.

- Development/training: 2021-2023.
- Robustness holdout: 2024-2025.
- Same features and hyperparameters as the validated June 30 model.
- Eligibility: 100 source BF, 200 source swings, and 75 target BF.

The July 15 analog is considered supportive if ShapeCast has lower pooled RMSE
and MAE, lower RMSE in both years, and a pitcher-clustered interval whose point
estimate is positive. The already validated June 30 model remains the primary
historical evidence if this later-cutoff robustness check is weaker.

## Frozen 2026 forecast

After the bridge and cutoff analog are complete:

1. Refit locked ShapeCast on July 15 analogs from 2021-2025.
2. Score 2026 pitchers using all local pitches through July 12.
3. Require 100 BF and 200 swings; no future-BF criterion is possible.
4. Save projected post-break K-BB%, the 16-input baseline, ShapeCast adjustment,
   role, workload, eligibility, model/version hash, and data-manifest hash.
5. Do not revise features, parameters, eligibility, or rankings after importing
   post-break data.

Primary prospective metric: target-BF-weighted K-BB RMSE among pitchers with at
least 75 post-break BF. Secondary metrics are MAE, bias, calibration deciles,
starter/reliever results, and forecast-direction accuracy for adjustments of at
least two K-BB percentage points.

## External projections

Attempt an archived point-in-time comparison against ZiPS and Steamer pitcher
K% and BB% forecasts closest to the same cutoff. Use a source only if the archive
contains complete pitcher rows, stable player identifiers, and an explicit
rest-of-season or full-season workload. Do not compare ShapeCast against a
current page, a partial archive, or a projection retrieved after the target
period.

If no audit-quality archive exists, record that as a data limitation and begin
prospective daily snapshot collection instead of manufacturing a comparison.

