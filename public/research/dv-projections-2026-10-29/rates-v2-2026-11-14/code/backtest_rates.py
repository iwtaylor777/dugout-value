"""Walk-forward backtest behind the v2 rate blend (results.json).

Production recipe for each rate: dvp.blend_fit (LightGBM + ridge, 50/50) on feat_bat2 features, PA-weighted, targets
relative to each season's league rate and anchored to the mean of the three prior league seasons, as in dvp.project.
For each target season T in 2018-19 and 2021-26 the model is fit only on seasons before T. Beta-binomial k and delta
are fit once on target seasons 2011-17, before every test season. Scored: hitters with 100+ PA in T-3..T-1 and 200+ PA
in T (the protocol's scored set); PA-weighted RMSE; player bootstrap, 2,000 resamples, seed 20261027."""
import json
import numpy as np
import _paths
import dvp
import feat_bat2
from data import league, seasons
from feat_pit import fnum
import eb_rates as E

TEST = [2018, 2019, 2021, 2022, 2023, 2024, 2025, 2026]
FIT_TARGETS = range(2011, 2018)


def build():
    D = seasons('bat'); Lr = league('bat')
    counts = {st: E.counts(D, st) for st in E.STATS}
    params = {}
    for st, (by_player, lg) in counts.items():
        k, delta, n = E.fit_k_delta(by_player, lg, FIT_TARGETS)
        params[st] = dict(k=k, delta=delta, fit_rows=n, single_season_k=E.single_season_k(by_player, lg, range(2010, 2017)))
    rows = []
    for t in range(2016, 2027):
        if t == 2020:
            continue
        for pid, h in D.items():
            if sum(fnum(h.get(t - l, {}).get('PA')) or 0 for l in (1, 2, 3) if t - l in h) <= 0:
                continue
            r = h.get(t)
            if not r or (fnum(r['PA']) or 0) < 100:
                continue
            y, eb = {}, {}
            for st, (by_player, lg) in counts.items():
                s, n = by_player.get(pid, {}).get(t, (0.0, 0.0))
                y[st] = s / n if n else np.nan
                eb[st] = E.estimate(by_player, lg, pid, t, params[st]['k'], params[st]['delta'])
            est = sum((h.get(q, {}).get('PA') or 0) for q in (t - 1, t - 2, t - 3))
            rows.append(dict(pid=pid, t=t, x=feat_bat2.row_features(h, t, Lr), y=y, eb=eb, n=fnum(r['PA']), est=est))
    return rows, counts, params


def rmse(p, y, w):
    return float(np.sqrt(np.sum(w * (p - y) ** 2) / np.sum(w)))


def main():
    rows, counts, params = build()
    keys = sorted(rows[0]['x'])
    X = np.array([[r['x'].get(k, np.nan) for k in keys] for r in rows], float)
    T_ = np.array([r['t'] for r in rows]); W = np.array([r['n'] for r in rows], float)
    est = np.array([r['est'] for r in rows]); pid = np.array([r['pid'] for r in rows])
    scored = np.isin(T_, TEST) & (est >= 100) & (W >= 200)
    out = dict(meta=dict(recipe='dvp.blend_fit on feat_bat2, targets relative to league, 3-season league anchor',
                         test_seasons=TEST, beta_binomial_fit_targets=[min(FIT_TARGETS), max(FIT_TARGETS)],
                         scored='100+ PA in T-3..T-1 and 200+ PA in T', bootstrap='player, 2000, seed 20261027'),
               params=params, rates={})
    rng = np.random.default_rng(20261027)
    for st, (by_player, lg) in counts.items():
        Y = np.array([r['y'][st] for r in rows])
        anchor = lambda T: float(np.mean([lg[T - i] for i in (1, 2, 3)]))
        dv = np.full(len(rows), np.nan)
        for T in TEST:
            tr = (T_ < T) & ~np.isnan(Y); te = T_ == T
            rel = Y[tr] - np.array([lg[t] for t in T_[tr]])
            dv[te] = dvp.blend_fit(X[tr], rel, W[tr], X[te]) + anchor(T)
        bb = np.array([anchor(r['t']) + r['eb'][st] for r in rows])
        bl = E.blend(dv, bb)
        m = scored & ~np.isnan(Y)
        res = dict(n=int(m.sum()), windows={}, by_season={})
        for label, (a, b) in {'2018-22': (2018, 2022), '2023-26': (2023, 2026), 'all': (2018, 2026)}.items():
            mm = m & (T_ >= a) & (T_ <= b)
            res['windows'][label] = dict(n=int(mm.sum()), dv=rmse(dv[mm], Y[mm], W[mm]), beta_binomial=rmse(bb[mm], Y[mm], W[mm]),
                                         blend=rmse(bl[mm], Y[mm], W[mm]))
        for T in TEST:
            mm = m & (T_ == T)
            res['by_season'][T] = dict(dv=rmse(dv[mm], Y[mm], W[mm]), beta_binomial=rmse(bb[mm], Y[mm], W[mm]), blend=rmse(bl[mm], Y[mm], W[mm]))
        ids = np.unique(pid[m]); idx = {p: np.where(m & (pid == p))[0] for p in ids}; diffs = []
        for _ in range(2000):
            j = np.concatenate([idx[p] for p in rng.choice(ids, len(ids))])
            diffs.append(rmse(bl[j], Y[j], W[j]) - rmse(dv[j], Y[j], W[j]))
        res['blend_minus_dv_ci95'] = [float(v) for v in np.percentile(diffs, [2.5, 97.5])]
        res['seasons_blend_better'] = sum(1 for T in TEST if res['by_season'][T]['blend'] < res['by_season'][T]['dv'])
        out['rates'][st] = res
        a = res['windows']['all']
        print(f"{st:6s} DV {a['dv']:.4f} beta-binomial {a['beta_binomial']:.4f} blend {a['blend']:.4f} "
              f"({100 * (a['blend'] / a['dv'] - 1):+.1f}%) CI {res['blend_minus_dv_ci95']} wins {res['seasons_blend_better']}/8", flush=True)
    json.dump(out, open(_paths.HERE / 'results.json', 'w'), indent=1)


if __name__ == '__main__':
    main()
