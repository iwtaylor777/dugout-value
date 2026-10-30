"""Full-season components and the T7 roster-churn test.

python3 season.py comp 2016 2017 ...  -> cache full-season components per year
"""
import os, sys, pickle, numpy as np, pandas as pd
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from events import build
from attrib import components, credit
from split import sprint_map, playing_time, CDIR

PAIRS_DEV = [(2016, 2017), (2017, 2018), (2018, 2019), (2019, 2021)]
PAIRS_HOLD = [(2021, 2022), (2022, 2023), (2023, 2024), (2024, 2025), (2025, 2026)]


def full_path(y): return f'{CDIR}/{y}_full.pkl'


def compute_full(y):
    f = full_path(y)
    if os.path.exists(f): return
    pa, called = build(y)
    c = components(pa, called, sprint_map(y), seed=0)
    out = dict(bat=c['bat'], pit=c['pit'], fld=c['fld'], pt=playing_time(pa))
    with open(f + '.tmp', 'wb') as fh: pickle.dump(out, fh)
    os.replace(f + '.tmp', f)
    print(y, 'full done', flush=True)


_c = {}
def load_full(y):
    if y not in _c:
        with open(full_path(y), 'rb') as fh: _c[y] = pickle.load(fh)
    return _c[y]


def team_value(rates, pt):
    """Predicted runs per game (offense, defense) for each team given player rates and playing time."""
    rb, rp, rf = rates
    b = pt['bat'].reset_index(); b['v'] = b['batter'].map(rb).fillna(0) * b['PA']
    p = pt['pit'].reset_index(); p['v'] = p['pitcher'].map(rp).fillna(0) * p['BF']
    f = pt['fld'].reset_index(); f['v'] = f['id'].map(rf).fillna(0) * f['outs']
    t = pt['team'].copy()
    t['off'] = b.groupby('bat_team')['v'].sum().reindex(t.index).fillna(0) / t['G']
    t['def'] = (p.groupby('fld_team')['v'].sum().reindex(t.index).fillna(0)
                + f.groupby('fld_team')['v'].sum().reindex(t.index).fillna(0)) / t['G']
    rs, ra = t['RS'] / t['G'], t['RA'] / t['G']
    t['a_off'] = rs - rs.mean(); t['a_def'] = ra.mean() - ra
    return t


def rates_from(comp, fw, prm=None):
    bat, pit, fld = credit(comp, fw, prm)
    return (bat / comp['bat']['PA'], pit / comp['pit']['BF'],
            (fld / comp['fld']['outs'].replace(0, np.nan)).fillna(0))


def churn_rows(pairs, fw, prm=None, rate_fn=None):
    out = []
    for T, U in pairs:
        cT = load_full(T); cU = load_full(U)
        rates = rate_fn(T) if rate_fn else rates_from(cT, fw, prm)
        a = team_value(rates, cT['pt']); b = team_value(rates, cU['pt'])
        d = pd.DataFrame({'off': b['off'] - a['off'], 'def': b['def'] - a['def'],
                          'a_off': b['a_off'] - a['a_off'], 'a_def': b['a_def'] - a['a_def']}).dropna()
        d['pred_rd'] = d['off'] + d['def']; d['a_rd'] = d['a_off'] + d['a_def']
        d['y'] = U; d['team'] = d.index
        out.append(d.reset_index(drop=True))
    return pd.concat(out, ignore_index=True)


def transfer_rows(pairs, fw, prm=None, rate_fn=None):
    """T3-style: season-T rates applied to T+1 playing time (levels, not changes)."""
    out = []
    for T, U in pairs:
        rates = rate_fn(T) if rate_fn else rates_from(load_full(T), fw, prm)
        b = team_value(rates, load_full(U)['pt'])
        b['pred_rd'] = b['off'] + b['def']; b['a_rd'] = b['a_off'] + b['a_def']; b['y'] = U; b['team'] = b.index
        out.append(b.reset_index(drop=True))
    return pd.concat(out, ignore_index=True)


def corr(d, p='pred_rd', a='a_rd'): return float(np.corrcoef(d[p], d[a])[0, 1])


def boot_diff(D, base='dv', B=2000, seed=20261029, p='pred_rd', a='a_rd'):
    """D: dict name -> rows (same order of team-pairs). Paired bootstrap of corr difference base minus others."""
    rng = np.random.default_rng(seed); n = len(D[base]); out = {k: [] for k in D if k != base}
    X = {k: (v[p].values, v[a].values) for k, v in D.items()}
    for _ in range(B):
        i = rng.integers(0, n, n)
        cb = np.corrcoef(X[base][0][i], X[base][1][i])[0, 1]
        for k in out: out[k].append(cb - np.corrcoef(X[k][0][i], X[k][1][i])[0, 1])
    return {k: [round(float(np.percentile(v, 2.5)), 4), round(float(np.percentile(v, 97.5)), 4)] for k, v in out.items()}


if __name__ == '__main__':
    if sys.argv[1] == 'comp':
        for y in map(int, sys.argv[2:]): compute_full(y)
