"""Backtest multi-year WAR-rate projections: horizon-h model vs (h=1 model + standard aging curve).
Usage: python3 bt_horizon.py KIND U H  -> /tmp/bth_KIND_U_H.json"""
import sys, json, numpy as np, dvp_site
from data import seasons
from feat_pit import fnum
kind, U, H = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
fv = 'v3' if kind == 'bat' else 'v1'
D = seasons(kind); key = 'PA' if kind == 'bat' else 'IP'; unit = 600 if kind == 'bat' else 180; mn = 200 if kind == 'bat' else 40
direct = dvp_site.fit(kind, U, H, fv)                 # data through U-H, predicting U
one = dvp_site.fit(kind, U - H + 1, 1, fv)            # data through U-H, predicting U-H+1
# standard aging curve: mean change in WAR rate by age, consecutive seasons with data through U-H (both 200 PA/40 IP)
ch = {}
for pid, h in D.items():
    for y in h:
        if y + 1 in h and y + 1 <= U - H and y != 2020 and y + 1 != 2020:
            a, b = h[y], h[y + 1]; na, nb = fnum(a.get(key)) or 0, fnum(b.get(key)) or 0
            if na >= mn and nb >= mn and a.get('Age'):
                w = min(na, nb); ch.setdefault(int(a['Age']), []).append((w, fnum(b['WAR']) / nb * unit - fnum(a['WAR']) / na * unit))
curve = {}
for age in range(18, 46):
    pts = [p for g in range(age - 1, age + 2) for p in ch.get(g, [])]
    curve[age] = float(np.average([v for _, v in pts], weights=[w for w, _ in pts])) if len(pts) > 30 else 0.0
rows = []
for pid, v in direct.items():
    r = D[pid].get(U)
    if not r or pid not in one: continue
    n = fnum(r.get(key)) or 0
    if n < mn: continue
    last = max(y for y in D[pid] if y <= U - H) if any(y <= U - H for y in D[pid]) else None
    age0 = D[pid][last].get('Age') if last else None
    if age0 is None: continue
    age_next = int(age0) + (U - H + 1 - last)          # age in season U-H+1
    aging = sum(curve.get(age_next + k, 0.0) for k in range(H - 1))
    rows.append(dict(pid=pid, n=n, actual=fnum(r['WAR']) / n * unit, direct=v['rate'], flat=one[pid]['rate'],
                     aged=one[pid]['rate'] + aging, age=age_next + H - 1))
json.dump(dict(kind=kind, U=U, H=H, rows=rows), open(f'/tmp/bth_{kind}_{U}_{H}.json', 'w'))
A = np.array([[r['direct'], r['flat'], r['aged'], r['actual'], r['n']] for r in rows]); w = A[:, 4]
rm = lambda j: np.sqrt(np.average((A[:, j] - A[:, 3]) ** 2, weights=w))
print(kind, U, 'h', H, 'n', len(A), 'RMSE direct %.3f | h1 flat %.3f | h1+aging curve %.3f' % (rm(0), rm(1), rm(2)))
