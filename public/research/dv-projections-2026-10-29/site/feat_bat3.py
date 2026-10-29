"""Hitter features v3 (WAR-rate model only): v2 features plus per-600-PA WAR components
(FanGraphs Fielding, BaseRunning, Positional), per lag and as multi-scale shrunk aggregates."""
import numpy as np, math
import feat_bat2
WCOLS = ['Fielding', 'BaseRunning', 'Positional']
KS = (60, 250, 1000)
def row_features(h, T, L=None):
    f = feat_bat2.row_features(h, T, L)
    acc = {c: [] for c in WCOLS}
    for lag, wt in feat_bat2.LAGS:
        y = T - lag; r = h.get(y); pa = (r or {}).get('PA') or 0
        sc = 162 / 60 if y == 2020 else 1.0
        for c in WCOLS:
            v = np.nan
            if r and pa > 0:
                try: v = float(r.get(c)) / pa * 600
                except (TypeError, ValueError): v = np.nan
            f[f'{c}_{lag}'] = v
            if not math.isnan(v): acc[c].append((wt * pa / 4.0, v))
    for c in WCOLS:
        sw = sum(a for a, _ in acc[c]); sv = sum(a * v for a, v in acc[c])
        for k in KS: f[f'{c}_s{k}'] = sv / (sw + k)
    return f
