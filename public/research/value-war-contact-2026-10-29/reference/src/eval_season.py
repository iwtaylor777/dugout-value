"""Season-level tests: T3 (season transfer), T4 (season accounting), T5 (pay), T6 (stability), T7 (roster churn)."""
import os, sys, json, numpy as np, pandas as pd
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import season, fg, dvwar
from events import build

FA = '/mnt/user-data/uploads/Baseball/analysis/fa_market_calibration/raw/fg_fa_tracker_2020_2027.json'
_w = {}


def team_wins(y):
    if y not in _w:
        pa, _ = build(y)
        g = pa.groupby(['game_pk', 'bat_team'])['runs'].sum().reset_index()
        opp = g.merge(g, on='game_pk', suffixes=('', '_o'))
        opp = opp[opp['bat_team'] != opp['bat_team_o']]
        opp['W'] = (opp['runs'] > opp['runs_o']).astype(int)
        t = opp.groupby('bat_team').agg(Wn=('W', 'sum'), Gn=('W', 'size'))
        _w[y] = t
    return _w[y]


def systems(prm):
    """name -> rate_fn(y)"""
    sc = lambda fw, p=None: (lambda y: season.rates_from(season.load_full(y), fw, p))
    return {'fip_sc': sc('fip'), 'ra9_sc': sc('ra9'), 'dv_sc': sc('dv', prm),
            'fwar': dvwar.rate_fn_factory(None, published='WAR'),
            'ra9war': dvwar.rate_fn_factory(None, published='RA9-Wins'),
            'dvwar': dvwar.rate_fn_factory('dv', prm)}


OFFICIAL = '/home/claude/war/standings/official.csv'   # MLB statsapi standings


def add_wins(d):
    d = d.copy()
    o = pd.read_csv(OFFICIAL)
    d = d.merge(o[['y', 'team', 'W', 'L']].rename(columns={'W': 'Wn', 'L': 'Ln'}), on=['y', 'team'], how='left')
    d['wpct162'] = d['Wn'] / (d['Wn'] + d['Ln']) * 162
    return d


def loso(d, p, a):
    e = []
    for t in d['y'].unique():
        tr = d['y'] != t
        b = np.polyfit(d.loc[tr, p], d.loc[tr, a], 1)
        e.append(np.polyval(b, d.loc[~tr, p]) - d.loc[~tr, a])
    return float(np.sqrt(np.mean(np.concatenate(e) ** 2)))


def team_test(kind, pairs, S, B=2000, base='dv_sc', targets=(('pred_rd', 'a_rd'), ('off', 'a_off'), ('def', 'a_def'))):
    D = {}
    for n, f in S.items():
        if kind == 'churn': D[n] = season.churn_rows(pairs, None, rate_fn=f)
        else: D[n] = season.transfer_rows(pairs, None, rate_fn=f)
    out = {}
    tg = list(targets) + ([('pred_rd', 'wpct162')] if kind != 'churn' else [])
    if kind != 'churn': D = {n: add_wins(d) for n, d in D.items()}
    for p, a in tg:
        lab = f'{p}->{a}'
        out[lab] = {n: dict(corr=round(season.corr(d, p, a), 4), loso_rmse=round(loso(d, p, a), 4) if d['y'].nunique() > 1 else None)
                    for n, d in D.items()}
        for b0 in [base, 'dvwar']:
            if b0 in D:
                out[lab][f'{b0}_minus_ci'] = season.boot_diff(D, b0, B, p=p, a=a) if B else None
    out['n'] = len(next(iter(D.values())))
    return out


# ---------------- T5 pay ----------------
def season_wars(y, prm):
    hb, hp, _, _ = dvwar.season_war(y, prm, 'dv')
    fb, fp = fg.fg('bat', y), fg.fg('pit', y)
    sc = 162 / 60 if y == 2020 else 1.0
    h = pd.DataFrame({'fwar': hb['WAR'], 'ra9war': hb['WAR'], 'dvwar': hb['WAR_new']})
    p = pd.DataFrame({'fwar': hp['WAR'], 'ra9war': hp['RA9-Wins'], 'dvwar': hp['WAR_new']})
    return h * sc, p * sc


def fgid_map():
    m = {}
    for y in range(2015, 2027):
        for kind in ('bat', 'pit'):
            d = fg.fg(kind, y)
            if 'playerid' in d.columns:
                for mid, pid in zip(d.index, d['playerid']): m[str(pid)] = int(mid)
    return m


def pay_test(prm, years=range(2020, 2027), B=2000):
    FAd = json.load(open(FA)); ids = fgid_map()
    W = {y: season_wars(y, prm) for y in range(2017, 2026)}
    rows = []
    for d in FAd:
        S = d['tracker_season']
        if S not in years or d['ContractType'] != 'Free Agent' or not d['ContractTotal'] or not d['YearsTotal']: continue
        aav = d['ContractTotal'] / d['YearsTotal']
        if aav < 2e6: continue
        mid = ids.get(str(d['playerId']))
        if mid is None: continue
        pos = (d.get('position') or '').split('/')[0]; k = 1 if pos in ('SP', 'RP', 'CL', 'P') else 0
        v = {}
        for sysn in ('fwar', 'ra9war', 'dvwar'):
            v[sysn] = sum(float(W[y][k][sysn].get(mid, 0.0)) for y in (S - 3, S - 2, S - 1)) / 3
        if all(float(W[y][k]['fwar'].get(mid, 0) or 0) == 0 for y in (S - 3, S - 2, S - 1)): continue
        rows.append(dict(S=S, y=np.log(aav), pit=k, **v))
    R = pd.DataFrame(rows)
    R['y'] = R['y'] - R.groupby('S')['y'].transform('mean')
    out = {}
    for lab, sub in (('all', R), ('hitters', R[R.pit == 0]), ('pitchers', R[R.pit == 1])):
        c = {s: round(float(np.corrcoef(sub[s], sub['y'])[0, 1]), 4) for s in ('fwar', 'ra9war', 'dvwar')}
        rng = np.random.default_rng(20261029); dd = {s: [] for s in ('fwar', 'ra9war')}
        X = sub[['fwar', 'ra9war', 'dvwar', 'y']].values
        for _ in range(B):
            i = rng.integers(0, len(X), len(X)); x = X[i]
            cd = np.corrcoef(x[:, 2], x[:, 3])[0, 1]
            for j, s in enumerate(('fwar', 'ra9war')): dd[s].append(cd - np.corrcoef(x[:, j], x[:, 3])[0, 1])
        out[lab] = dict(n=len(sub), corr=c, dvwar_minus_ci={s: [round(float(np.percentile(v, 2.5)), 4), round(float(np.percentile(v, 97.5)), 4)] for s, v in dd.items()})
    return out


# ---------------- T6 stability ----------------
def stability(prm, pairs):
    out = {}
    for kind, k, opp, scale, mn in (('hitters', 0, 'PA', 600, 300), ('pitchers', 1, 'IP', 180, 60)):
        xs = {s: [] for s in ('fwar', 'ra9war', 'dvwar')}
        for T, U in pairs:
            a, b = season_wars(T, prm)[k], season_wars(U, prm)[k]
            fa, fb_ = fg.fg('bat' if k == 0 else 'pit', T), fg.fg('bat' if k == 0 else 'pit', U)
            oa = fa[opp].groupby(level=0).sum(); ob = fb_[opp].groupby(level=0).sum()
            ids = oa[oa >= mn].index.intersection(ob[ob >= mn].index)
            for s in xs:
                xs[s].append(pd.DataFrame({'a': a[s].reindex(ids) / oa[ids] * scale, 'b': b[s].reindex(ids) / ob[ids] * scale}))
        out[kind] = {s: dict(n=len(pd.concat(v)), r=round(float(pd.concat(v).corr().iloc[0, 1]), 4)) for s, v in xs.items()}
    return out
