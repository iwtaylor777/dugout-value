"""2027 rate projections for the projections page: hitters AVG, OBP, SLG, wRC+; pitchers ERA, FIP, K%, BB%.
Same v3 (hitters) / v1 (pitchers) features, learners and training windows as the WAR model; targets are rates relative to
each season's PA- or IP-weighted league mean, anchored to the 3-year league mean before 2027."""
import sys, json
sys.argv = ['x']; sys.path.insert(0, '/home/claude/pw/pkg/site'); sys.path.insert(0, '/home/claude/pw/comp')
import runtime; runtime.configure(normalize_ip=True)
import numpy as np, dvp
from dvp_site import _feat, has_history
from data import seasons
from feat_pit import fnum
from threadpoolctl import threadpool_limits
threadpool_limits(limits=2); dvp.P['n_jobs'] = 2
T = 2027
def val(r, k):
    v = r.get(k)
    try: v = float(v)
    except (TypeError, ValueError): return None
    return None if np.isnan(v) else v
def fit_rate(kind, key, fv):
    F_, Lr, wkey, start = _feat(kind, fv); D = seasons(kind); minw = 100 if kind == 'bat' else 20
    lg = {}
    for y in range(start - 3, T):
        num = den = 0.0
        for h in D.values():
            r = h.get(y); n = fnum((r or {}).get(wkey)) if r else 0
            v = val(r, key) if r else None
            if n and v is not None and not np.isnan(n): num += v * n; den += n
        if den: lg[y] = num / den
    XR, YR, WR = [], [], []
    for t in runtime.training_years(start, T, 1, None):
        if t == 2020 or t not in lg: continue
        for pid, hh in D.items():
            if not has_history(hh, t - 1, wkey): continue
            r = hh.get(t); n = fnum((r or {}).get(wkey)) if r else 0.0
            v = val(r, key) if r else None
            if r and n and n >= minw and v is not None:
                XR.append(F_(hh, t, Lr)); YR.append(v - lg[t]); WR.append(n)
    keys = sorted(XR[0].keys()); M = lambda X: np.array([[x[k] for k in keys] for x in X], float)
    Xt, ids = [], []
    for pid, hh in D.items():
        if has_history(hh, T - 1, wkey): Xt.append(F_(hh, T, Lr)); ids.append(pid)
    anchor = float(np.mean([lg[y] for y in (T - 1, T - 2, T - 3) if y in lg and y != 2020]))
    pred = dvp.blend_fit(M(XR), np.array(YR), np.array(WR), M(Xt)) + anchor
    return dict(zip(ids, map(float, pred)))
out = {'bat': {}, 'pit': {}}
for key in ('AVG', 'OBP', 'SLG', 'wRC+'):
    for pid, v in fit_rate('bat', key, 'v3').items(): out['bat'].setdefault(pid, {})[key] = v
    print('bat', key, flush=True)
for key in ('ERA', 'FIP', 'K%', 'BB%'):
    for pid, v in fit_rate('pit', key, 'v1').items(): out['pit'].setdefault(pid, {})[key] = v
    print('pit', key, flush=True)
json.dump(out, open('/home/claude/pw/comp/detail_2027.json', 'w'))
print('Mead', out['bat'].get('23986'))
