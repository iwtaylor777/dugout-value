# DV WAR audit

Independent reconstruction and exploratory follow-up of the October 29, 2026
value WAR project. Read [REPORT.md](REPORT.md) for the findings. This directory
does not change the production WAR table, player projections or original v2
registration.

## Inputs

The original v1 model code is read from `../src_v1` when available, otherwise
from the tracked `public/research/value-war-2026-10-29/src` directory. The original
locks and official standings are available in that tracked research package.
`source_integrity.json` checks the local study sources against their recorded
locks. `reference_parameters.json` preserves the original v1 and v2 settings and
the hashes and times of their source locks. Original source files are not edited.

Raw and intermediate data stay outside this directory. By default the cache is
`/private/tmp/dv-war-audit-inputs`; set `DV_WAR_AUDIT_INPUT` to move it. A different
checkout can set `DV_WAR_FG_DIR` to the directory containing the existing
`fg_bat_YEAR.json` and `fg_pit_YEAR.json` leaderboards. The default is `tmp/war`
under the checkout root. Set `DV_WAR_SOURCE_ROOT` to an existing data checkout
when the raw 2026 files and `tmp/war` live outside the audit checkout.

The historical public archive is pinned to Hugging Face revision
`dd622b29bceca28b09ecdb08d2c54a9956aae345` of
`Jensen-holm/statcast-era-pitches`, file
`data/statcast_era_pitches.parquet`. Its SHA-256 is
`1dc14059e0d16c92b772133f3d83264da5133cbd1e3655f478e5ef6b9d935f3c`.
This matches the input archive already used by the Attackability study.

Download it into the input cache with `hf download`, using `--type dataset`,
the revision above and `--local-dir` set to the input directory. `prepare.py`
also uses later full-column daily downloads in the user's pybaseball cache to
complete and refresh 2023–25. Without those downloads, the September 2025 archive
alone is incomplete and must not be silently treated as a full season.

For 2026, the source files are the existing compressed CSVs in
`analysis/attackability/data/raw/current` and
`analysis/deception_residual/data/outcomes_2026/raw`. Sprint speed comes from the
official Savant endpoint `/leaderboard/sprint_speed?year=YEAR&position=&team=&min=10&csv=true`;
save each year as `lb/ss_YEAR.csv` under the input cache. This audit uses 2016–26
speed tables, including the 2022 table for the prior-speed sensitivity.

The private `cache/input_YEAR.json` files preserve every source hash, deduplication
count, coverage and prepared input hash. The local daily-file inventory is saved
as `daily_inventory.json`. Raw sources and private prediction rows are not
redistributed.

## Run

Install `requirements.txt` in an isolated Python environment. On macOS, LightGBM
also needs OpenMP available to the loader. Set `MPLCONFIGDIR` to a writable cache
directory when rendering figures. Limit native threads to one when running two
component jobs concurrently.

From the repository root, with that environment active:

```bash
python analysis/value_war/audit_20261029/prepare.py 2016 2017 2018 2019 2021 2022 2023 2024 2025 2026
python analysis/value_war/audit_20261029/components.py full 2016 2017 2018 2019 2021 2022 2023 2024 2025 2026
python analysis/value_war/audit_20261029/components.py splits 2023 2024 2025
python analysis/value_war/audit_20261029/prior_speed.py 2023 2024 2025
python analysis/value_war/audit_20261029/test_audit.py
python analysis/value_war/audit_20261029/evaluate.py
python analysis/value_war/audit_20261029/calibration_check.py
python analysis/value_war/audit_20261029/descriptive_checks.py
python analysis/value_war/audit_20261029/report.py
python analysis/value_war/audit_20261029/verify_measurements.py
```

The component cache is keyed by year, split and half. Use a new input directory
when changing the model or preprocessing. Reusing old component files after
changing a recipe is invalid. The calibration and descriptive scripts were
added after the first fixed-candidate results; that order is recorded in
`MEASUREMENT-NOTES.md`. The initial `AUDIT-LOCK.json` is retained, while the final
release manifest records subsequent implementation and diagnostic additions.

## Outputs

- `results.json`: all fixed comparisons, uncertainty, prior-team control and 100
  identity permutations.
- `calibration_results.json`: batting information beyond a calibrated outcomes
  baseline, using only development years for fitting.
- `fielding_agreement.json`: descriptive comparison with published fielding.
- `candidate_2026_lock.json`: hashes of private, frozen 2026 player snapshots for
  the candidate retaining full fielding and pitching credit.
- `REPORT.md` and `war-component-comparison.png` / `.svg`: readable findings and
  the comparison chart.

The season target comparisons must contain 150 unique, finite team-season
observations for every variant. `test_audit.py` checks credit identities and
Athletics name normalization. The broader original site tests are not rerun for
this research-only addition.
