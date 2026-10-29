"""Scoring for T1/T2: average correlation over splits and directions, LOSO RMSE, bootstrap over team-seasons."""
import numpy as np, pandas as pd
from split import rows, NSPLIT

BOOT_SEED = 20261029


def matrices(R, col_p, col_a):
    R = R.copy(); R['ts'] = R['y'].astype(str) + '-' + R['team'].astype(str)
    R['k'] = R['s'] * 2 + R['d']
    P = R.pivot(index='k', columns='ts', values=col_p)
    A = R.pivot(index='k', columns='ts', values=col_a)
    yrs = np.array([int(c.split('-')[0]) for c in P.columns])
    return P.values, A.values, yrs, list(P.columns)


def wcorr_rows(P, A, w):
    w = w / w.sum()
    mp = (P * w).sum(1, keepdims=True); ma = (A * w).sum(1, keepdims=True)
    cov = ((P - mp) * (A - ma) * w).sum(1)
    return cov / np.sqrt(((P - mp) ** 2 * w).sum(1) * ((A - ma) ** 2 * w).sum(1))


def loso(P, A, yrs):
    if len(np.unique(yrs)) < 2: return np.nan
    out = []
    for k in range(P.shape[0]):
        e = []
        for t in np.unique(yrs):
            tr = yrs != t
            b = np.polyfit(P[k, tr], A[k, tr], 1)
            e.append(np.polyval(b, P[k, ~tr]) - A[k, ~tr])
        out.append(np.sqrt(np.mean(np.concatenate(e) ** 2)))
    return float(np.mean(out))


def score(years, systems, mode='transfer', B=0, cols=(('rd', 'pred_rd', 'a_rd'), ('off', 'off', 'a_off'), ('def', 'def', 'a_def'))):
    """systems: dict name -> (fw, prm). Returns dict of metrics; bootstrap diffs vs 'dv' when B>0."""
    R = {n: rows(years, fw, prm, mode) for n, (fw, prm) in systems.items()}
    res = {}
    for lab, cp, ca in cols:
        M = {n: matrices(R[n], cp, ca) for n in systems}
        n0 = next(iter(M))
        yrs = M[n0][2]; nts = len(yrs)
        res[lab] = {n: dict(corr=round(float(np.mean(wcorr_rows(M[n][0], M[n][1], np.ones(nts)))), 4),
                            loso_rmse=round(loso(M[n][0], M[n][1], yrs), 4)) for n in systems}
        if B and 'dv' in systems:
            rng = np.random.default_rng(BOOT_SEED)
            diffs = {n: [] for n in systems if n != 'dv'}
            for _ in range(B):
                w = np.bincount(rng.integers(0, nts, nts), minlength=nts).astype(float)
                base = np.mean(wcorr_rows(M['dv'][0], M['dv'][1], w))
                for n in diffs: diffs[n].append(base - np.mean(wcorr_rows(M[n][0], M[n][1], w)))
            res[lab]['dv_minus_ci'] = {n: [round(float(np.percentile(v, 2.5)), 4), round(float(np.percentile(v, 97.5)), 4)]
                                       for n, v in diffs.items()}
        res[lab]['n_team_seasons'] = nts
    return res
