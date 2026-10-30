"""Recover the original full-column input and preserve data provenance locally."""
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
from pathlib import Path
import re
import sys

import numpy as np
import pandas as pd
import pyarrow.parquet as pq

from runtime import CACHE, INPUT, DATA_ROOT, events

KEEP = '''game_date game_year game_type game_pk at_bat_number pitch_number inning inning_topbot batter pitcher events description stand p_throws home_team away_team type hit_location bb_type balls strikes outs_when_up on_1b on_2b on_3b hc_x hc_y launch_speed launch_angle hit_distance_sc fielder_2 fielder_3 fielder_4 fielder_5 fielder_6 fielder_7 fielder_8 fielder_9 estimated_ba_using_speedangle estimated_woba_using_speedangle woba_value woba_denom babip_value iso_value bat_score post_bat_score fld_score post_fld_score home_score away_score post_home_score post_away_score delta_run_exp delta_home_win_exp plate_x plate_z sz_top sz_bot zone pitch_type release_speed if_fielding_alignment of_fielding_alignment'''.split()


def sha(path):
    with open(path, 'rb') as f:
        return hashlib.file_digest(f, 'sha256').hexdigest()


def daily_inventory():
    snapshot=INPUT/'daily_inventory.json'
    if snapshot.exists():return json.loads(snapshot.read_text())
    result={}
    for record in sorted((Path.home()/'.pybaseball/cache').glob('*.cache_record.json')):
        try:
            d=json.loads(record.read_text())
            match=re.search(r'game_date_gt=(\d{4}-\d{2}-\d{2})&game_date_lt=\1',str(d.get('args')))
            if match and Path(d['dataframe']).exists():
                date=match[1];result.setdefault(date[:4],{})[date]=d['dataframe']
        except (ValueError,KeyError):
            continue
    snapshot.write_text(json.dumps(result,indent=2))
    return result


def prepare(y):
    dest = CACHE / f'pitches_{y}.parquet'
    meta = CACHE / f'input_{y}.json'
    if dest.exists() and meta.exists():
        return json.loads(meta.read_text())
    frames, sources = [], []
    if y <= 2025:
        archive = INPUT / 'data/statcast_era_pitches.parquet'
        a = pq.read_table(archive, columns=KEEP, filters=[('game_year', '=', y), ('game_type', '=', 'R')]).to_pandas()
        frames.append(a)
        sources.append(dict(path=str(archive), sha256=sha(archive)))
        # Local daily downloads are later than the archive and complete September 2025.
        inv = daily_inventory()
        for date, path in sorted(inv.get(str(y), {}).items()):
            f = pd.read_parquet(path, columns=KEEP)
            frames.append(f[f.game_type == 'R'])
            sources.append(dict(path=path, sha256=sha(path)))
    else:
        dirs = [DATA_ROOT / 'analysis/attackability/data/raw/current', DATA_ROOT / 'analysis/deception_residual/data/outcomes_2026/raw']
        files = sorted(p for d in dirs for p in d.glob('*.csv.gz'))
        for path in files:
            f = pd.read_csv(path, usecols=lambda c: c.lstrip('\ufeff') in KEEP, low_memory=False)
            f.columns = [c.lstrip('\ufeff') for c in f.columns]
            frames.append(f[f.game_type == 'R'])
            sources.append(dict(path=str(path), sha256=sha(path)))
    d = pd.concat(frames, ignore_index=True)
    before = len(d)
    d = d.drop_duplicates(['game_pk', 'at_bat_number', 'pitch_number'], keep='last')
    d = d.sort_values(['game_pk', 'at_bat_number', 'pitch_number']).reset_index(drop=True)
    occupied = {c:d[c].notna().astype(np.int8) for c in ('on_1b', 'on_2b', 'on_3b')}
    # NumPy scalar types avoid pandas nullable extension/object matrices in LightGBM.
    for c in d.select_dtypes('number').columns:
        d[c] = pd.to_numeric(d[c]).astype(float)
    for c,v in occupied.items():
        d[c] = v
    for c in ('game_pk', 'at_bat_number', 'pitch_number', 'batter', 'pitcher'):
        d[c] = d[c].astype(np.int64)
    d['game_date'] = pd.to_datetime(d['game_date'])
    d.to_parquet(dest, index=False)
    # Independent official game-ending score, distinct from terminal-PA run sums.
    g = d.groupby('game_pk').agg(home=('home_team', 'first'), away=('away_team', 'first'),
        hr=('post_home_score', 'max'), ar=('post_away_score', 'max'))
    teams = pd.concat([g.rename(columns={'home':'team','hr':'RS','ar':'RA'})[['team','RS','RA']],
                       g.rename(columns={'away':'team','ar':'RS','hr':'RA'})[['team','RS','RA']]])
    totals = teams.groupby('team').agg(G=('RS','size'), RS=('RS','sum'), RA=('RA','sum'))
    totals.to_csv(CACHE / f'game_totals_{y}.csv')
    result = dict(year=y, rows=len(d), duplicate_rows_removed=before-len(d), games=len(g),
        start=str(d.game_date.min()), end=str(d.game_date.max()), sources=sources,
        pitches_sha256=sha(dest), team_totals=totals.reset_index().to_dict('records'))
    meta.write_text(json.dumps(result, indent=2))
    print('PREPARED', y, len(d), len(g), flush=True)
    return result


if __name__ == '__main__':
    for year in map(int, sys.argv[1:]):
        prepare(year)
