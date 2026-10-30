"""Coordinate-descent tuning of DV attribution weights on development seasons only."""
import sys, os, json, numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import split, season
from evalsplit import matrices, wcorr_rows

DEV_YEARS = [2016, 2017, 2018, 2019, 2021]
GRID = dict(lam_b=[0, .25, .5, .75, 1], sig_b=[0, .5, 1], kap=[0, .25, .5, .75, 1], lam_p=[0, .25, .5, 1], kap_hr=[0, .5, 1], lam_hr=[0, .5, 1],
            sig_p=[0, .5, 1], gam_p=[0, .5, 1], lam_f=[0, .25, .5, .75, 1], gam_c=[0, .5, 1])


def t1(fw, prm, years=DEV_YEARS, col=('pred_rd', 'a_rd')):
    R = split.rows(years, fw, prm, 'transfer')
    P, A, y, _ = matrices(R, *col)
    return float(np.mean(wcorr_rows(P, A, np.ones(P.shape[1]))))


def t7(fw, prm, pairs=season.PAIRS_DEV, col=('pred_rd', 'a_rd')):
    return season.corr(season.churn_rows(pairs, fw, prm), *col)


def objective(prm):
    a, b = t1('dv', prm), t7('dv', prm)
    return (a + b) / 2, a, b


if __name__ == '__main__':
    log = []
    for fw in ('fip', 'ra9'):
        print(fw, 'T1 %.4f T7 %.4f' % (t1(fw, None), t7(fw, None)), flush=True)
    cur = dict(lam_b=1, sig_b=0, kap=1, lam_p=0, kap_hr=1, lam_hr=1, sig_p=0, gam_p=0, lam_f=1, gam_c=1)
    best = objective(cur); print('start', cur, best, flush=True)
    for it in range(3):
        changed = False
        for k, vals in GRID.items():
            for v in vals:
                if v == cur[k]: continue
                trial = dict(cur, **{k: v}); s = objective(trial)
                log.append(dict(prm=trial, obj=s))
                if s[0] > best[0] + 1e-4:
                    best, cur, changed = s, trial, True
            print('pass', it, k, cur[k], 'obj %.4f T1 %.4f T7 %.4f' % best, flush=True)
        if not changed: break
    json.dump(dict(best=cur, score=best, log=log), open('/home/claude/war/tune_dev.json', 'w'), indent=1)
    print('BEST', cur, best)
