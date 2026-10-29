"""Split-season tests T1 (transfer) and T2 (accounting).

python3 split.py comp 2016 2017 ...   -> compute and cache component tables for 10 splits x 2 halves
Library: team_rows(y, s, fw, prm) -> rows for both directions.
"""
import os, sys, hashlib, pickle, numpy as np, pandas as pd
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from events import build
from attrib import components, credit

SEED = 20261029
NSPLIT = 10
CDIR = '/home/claude/war/comp'
LB = '/home/claude/war/lb'
os.makedirs(CDIR, exist_ok=True)


def sprint_map(y):
    f = f'{LB}/ss_{y}.csv'
    if not os.path.exists(f): return {}
    d = pd.read_csv(f, encoding='utf-8-sig')
    return dict(zip(d['player_id'].astype(np.int64), d['sprint_speed'].astype(float)))


def half_of(game_pks, s):
    return np.array([int(hashlib.sha1(f'{SEED}-{s}-{g}'.encode()).hexdigest(), 16) & 1 for g in game_pks], dtype=np.int8)


def playing_time(pa):
    bat = pa.groupby(['batter', 'bat_team']).size().rename('PA')
    pit = pa.groupby(['pitcher', 'fld_team']).size().rename('BF')
    outs = [pa[[f'fielder_{k}', 'fld_team', 'outs_on_play']].rename(columns={f'fielder_{k}': 'id'}) for k in range(2, 10)]
    outs.append(pa[['pitcher', 'fld_team', 'outs_on_play']].rename(columns={'pitcher': 'id'}))
    fld = pd.concat(outs).groupby(['id', 'fld_team'])['outs_on_play'].sum().rename('outs')
    games = pd.concat([pa[['game_pk', 'bat_team']].rename(columns={'bat_team': 't'}),
                       pa[['game_pk', 'fld_team']].rename(columns={'fld_team': 't'})]).drop_duplicates().groupby('t').size()
    rs = pa.groupby('bat_team')['runs'].sum()
    ra = pa.groupby('fld_team')['runs'].sum()
    team = pd.DataFrame({'G': games, 'RS': rs, 'RA': ra})
    return dict(bat=bat, pit=pit, fld=fld, team=team)


def comp_path(y, s, h): return f'{CDIR}/{y}_{s}_{h}.pkl'


def compute(y, splits=range(NSPLIT)):
    pa, called = build(y)
    sp = sprint_map(y)
    games = pa['game_pk'].unique()
    for s in splits:
        hmap = dict(zip(games, half_of(games, s)))
        ph = pa['game_pk'].map(hmap).values
        ch = called['game_pk'].map(hmap).values
        for h in (0, 1):
            f = comp_path(y, s, h)
            if os.path.exists(f) or os.path.exists(f + '.lock'): continue
            open(f + '.lock', 'w').close()
            sub = pa[ph == h].reset_index(drop=True)
            c = components(sub, called[ch == h].reset_index(drop=True), sp, seed=s)
            out = dict(bat=c['bat'], pit=c['pit'], fld=c['fld'], pt=playing_time(sub))
            with open(f + '.tmp', 'wb') as fh: pickle.dump(out, fh)
            os.replace(f + '.tmp', f)
            os.remove(f + '.lock')
        print(y, 'split', s, 'done', flush=True)


_cache = {}
def load(y, s, h):
    k = (y, s, h)
    if k not in _cache:
        with open(comp_path(y, s, h), 'rb') as fh: _cache[k] = pickle.load(fh)
    return _cache[k]


def predict(meas, tgt, fw, prm=None):
    """Team predictions in half `tgt` from rates measured in `meas`. Returns DataFrame by team."""
    bat, pit, fld = credit(meas, fw, prm)
    rb = bat / meas['bat']['PA']
    rp = pit / meas['pit']['BF']
    o = meas['fld']['outs'].replace(0, np.nan)
    rf = (fld / o).fillna(0)
    pt = tgt['pt']
    b = pt['bat'].reset_index(); b['v'] = b['batter'].map(rb).fillna(0) * b['PA']
    p = pt['pit'].reset_index(); p['v'] = p['pitcher'].map(rp).fillna(0) * p['BF']
    f = pt['fld'].reset_index(); f['v'] = f['id'].map(rf).fillna(0) * f['outs']
    team = pt['team'].copy()
    team['off'] = b.groupby('bat_team')['v'].sum().reindex(team.index).fillna(0) / team['G']
    team['dp'] = p.groupby('fld_team')['v'].sum().reindex(team.index).fillna(0) / team['G']
    team['df'] = f.groupby('fld_team')['v'].sum().reindex(team.index).fillna(0) / team['G']
    team['def'] = team['dp'] + team['df']
    rs, ra = team['RS'] / team['G'], team['RA'] / team['G']
    team['a_off'] = rs - rs.mean(); team['a_def'] = ra.mean() - ra
    team['pred_rd'] = team['off'] + team['def']; team['a_rd'] = team['a_off'] + team['a_def']
    return team


def rows(years, fw, prm=None, mode='transfer', splits=range(NSPLIT)):
    out = []
    for y in years:
        for s in splits:
            H = [load(y, s, 0), load(y, s, 1)]
            for d in (0, 1):
                meas = H[d]; tgt = H[1 - d] if mode == 'transfer' else H[d]
                t = predict(meas, tgt, fw, prm).reset_index().rename(columns={'index': 'team', 't': 'team'})
                t['y'] = y; t['s'] = s; t['d'] = d
                out.append(t)
    return pd.concat(out, ignore_index=True)


if __name__ == '__main__':
    if sys.argv[1] == 'comp':
        for y in map(int, sys.argv[2:]): compute(y)
