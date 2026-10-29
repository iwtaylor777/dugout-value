"""Site multi-year WAR rates 2027-31: 0.7 x horizon-h model + 0.3 x (h=1 model + standard aging curve).
Writes dvp_multiyear.json with per-player rate and expected PT by year."""
import json, os, numpy as np
from data import seasons
from feat_pit import fnum
SITE = os.path.expanduser('~/mnt/Baseball/analysis/projections/site/')
M = json.load(open(SITE + 'dvp_2027_2031_v3.json'))
out = {}
for kind, key, unit, mn in (('bat', 'PA', 600, 200), ('pit', 'IP', 180, 40)):
    D = seasons(kind); ch = {}
    for pid, h in D.items():
        for y in h:
            if y + 1 in h and y != 2020 and y + 1 != 2020:
                a, b = h[y], h[y + 1]; na, nb = fnum(a.get(key)) or 0, fnum(b.get(key)) or 0
                if na >= mn and nb >= mn and a.get('Age'):
                    ch.setdefault(int(a['Age']), []).append((min(na, nb), fnum(b['WAR']) / nb * unit - fnum(a['WAR']) / na * unit))
    curve = {}
    for age in range(18, 50):
        pts = [p for g in range(age - 1, age + 2) for p in ch.get(g, [])]
        curve[age] = float(np.average([v for _, v in pts], weights=[w for w, _ in pts])) if len(pts) > 30 else 0.0
    one = M[f'{kind}_2027']; res = {}
    for pid, v in one.items():
        h = D.get(pid, {}); last = max(h) if h else None
        if last is None or not h[last].get('Age'): continue
        age27 = int(h[last]['Age']) + (2027 - last)
        rates, pts = {}, {}
        for k in range(5):
            y = 2027 + k; d = M[f'{kind}_{y}'].get(pid)
            aged = v['rate'] + sum(curve.get(age27 + j, 0.0) for j in range(k))
            rates[y] = round(0.7 * d['rate'] + 0.3 * aged, 3) if d else round(aged, 3)
            pts[y] = round(d['pt'], 1) if d else None
        res[pid] = dict(age2027=age27, rate=rates, pt=pts)
    out[kind] = res
json.dump(out, open(SITE + 'dvp_multiyear.json', 'w'))
for pid in ('27769', '25764', '27463', '19755'):
    for kind in ('bat', 'pit'):
        if pid in out[kind]: print(kind, pid, out[kind][pid]['age2027'], out[kind][pid]['rate'])
