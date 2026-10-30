"""Corrected-timing rerun of the aging-piece test (Amendment-TIMING rules: training outcomes only through the origin).
Origins 2018, 2019, 2021 (pre-registered; targets through 2024) and 2022-24 (targets through 2026, reused seasons).
When a horizon has no observable training outcomes, the direct forecast falls back to one-year + the variant's aging rule."""
import os, sys, json, pickle, numpy as np
import runtime
runtime.configure(normalize_ip=True)
import dvp_site, dvp
from data import seasons
from feat_pit import fnum
from threadpoolctl import threadpool_limits
dvp.P['n_jobs'] = 2; threadpool_limits(limits=2)
FIX = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'fixed_age_policy.json')))
FV = {'bat': 'v3', 'pit': 'v1'}; KEY = {'bat': 'PA', 'pit': 'IP'}; UNIT = {'bat': 600, 'pit': 180}; MN = {'bat': 200, 'pit': 40}
def getfit(kind, O, h):
    f = f'/tmp/cfit_{kind}_{O}_{h}.pkl'
    if not os.path.exists(f): pickle.dump(dvp_site.fit(kind, O + h, h, FV[kind]), open(f, 'wb')); print('fit', kind, O, h, flush=True)
    return pickle.load(open(f, 'rb'))
def delta_curve(kind, O):
    D = seasons(kind); key, unit, mn = KEY[kind], UNIT[kind], MN[kind]; ch = {}
    for pid, h in D.items():
        for y in h:
            if y + 1 in h and y + 1 <= O and 2020 not in (y, y + 1):
                a, b = h[y], h[y + 1]; na, nb = fnum(a.get(key)) or 0, fnum(b.get(key)) or 0
                if na >= mn and nb >= mn and a.get('Age'):
                    ch.setdefault(int(a['Age']), []).append((min(na, nb), fnum(b['WAR']) / nb * unit - fnum(a['WAR']) / na * unit))
    c = {}
    for age in range(18, 50):
        pts = [p for g in range(age - 1, age + 2) for p in ch.get(g, [])]
        c[age] = float(np.average([v for _, v in pts], weights=[w for w, _ in pts])) if len(pts) > 30 else 0.0
    return c
def fixed(kind, age, pos, gss):
    a = str(min(48, max(18, age)))
    if kind == 'bat':
        p = pos.upper().split('/')[0]; k = 'position:C' if p == 'C' else 'position:SS' if p in ('SS', '2B', 'CF') else 'position:LF'
        return FIX[k].get(a, 0.0)
    return FIX['starter:SP'].get(a, 0.0) if gss >= .5 else FIX['reliever:RP'].get(a, 0.0) * 180 / 65
def smooth(r):
    r0 = r[0]; ks = np.arange(1, len(r)); d = np.array(r[1:]) - r0; b = float((ks * d).sum() / (ks * ks).sum())
    return [r0 + b * k for k in range(len(r))]
out = []
for kind in ('bat', 'pit'):
    D = seasons(kind); key, unit = KEY[kind], UNIT[kind]
    for O in (2018, 2019, 2021, 2022, 2023, 2024):
        F = {h: getfit(kind, O, h) for h in range(1, 6)}; cur = delta_curve(kind, O)
        for pid, v1 in F[1].items():
            hh = D[pid]; past = [y for y in hh if y <= O]; last = max(past); age0 = hh[last].get('Age')
            if not age0: continue
            age1 = int(age0) + (O + 1 - last); pos = str(hh[last].get('position') or '')
            gs = sum(fnum(hh[y].get('GS')) or 0 for y in past[-3:]); g = sum(fnum(hh[y].get('G')) or 0 for y in past[-3:]); gss = gs / g if g else 0
            r1 = v1['rate']
            agedD = [r1 + sum(cur.get(age1 + j, 0.0) for j in range(h - 1)) for h in range(1, 6)]
            agedF = [r1 + sum(fixed(kind, age1 + j + 1, pos, gss) for j in range(h - 1)) for h in range(1, 6)]
            dD = [r1] + [F[h][pid]['rate'] if pid in F[h] else agedD[h - 1] for h in range(2, 6)]
            dF = [r1] + [F[h][pid]['rate'] if pid in F[h] else agedF[h - 1] for h in range(2, 6)]
            V = {'site': [.7 * a + .3 * b for a, b in zip(dD, agedD)], 'fixed': [.7 * a + .3 * b for a, b in zip(dF, agedF)], 'direct': dD}
            for n in list(V): V[n + '_sm'] = smooth(V[n])
            for h in range(2, 6):
                T = O + h
                if T > 2026 or T == 2020: continue
                r = hh.get(T); n = fnum((r or {}).get(key)) if r else 0.0
                if not r or not np.isfinite(n) or n < MN[kind]: continue
                out.append(dict(kind=kind, O=O, h=h, pid=pid, age1=age1, w=n, a=fnum(r['WAR']) / n * unit, has_direct=pid in F[h], **{k: v[h - 1] for k, v in V.items()}))
    print(kind, 'done', flush=True)
json.dump(out, open('/tmp/exp3c_rows.json', 'w')); print(len(out))
