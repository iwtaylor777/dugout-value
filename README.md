# Data Science Hiring Screener

This folder contains a polished candidate response and the code used to reproduce every numerical result.

## Files

- `output/pdf/red_sox_data_science_hiring_screener.pdf` - final seven-page submission
- `analysis/run_analysis.py` - statistical analysis for Questions 1-4
- `analysis/build_submission.py` - PDF builder, including both diagnostic charts
- `data/mlb_team_runs_per_game_2025.csv` - supplied team-run data
- `data/mpg.csv` - seaborn automobile dataset referenced by the prompt

## Reproduce

From this directory, run:

```bash
python3 analysis/run_analysis.py
python3 analysis/build_submission.py
```

The analysis requires Python 3.10+, NumPy, and Pandas. PDF generation also requires ReportLab.

The analysis uses a fixed random seed (`20260728`) for the game-cluster bootstrap and 10-fold cross-validation split.

## External sources

- Automobile data: https://raw.githubusercontent.com/mwaskom/seaborn-data/refs/heads/master/mpg.csv
- FanGraphs article: https://blogs.fangraphs.com/faster-fastballs-produce-worse-swings/
