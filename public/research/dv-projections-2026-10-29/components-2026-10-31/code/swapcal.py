"""Calibrate the depth chart's position swap: does replacing role defense with projected defense at the positions a player
actually played (and his actual positional value) predict next-season WAR without bias, for moves up and down?"""
import sys, json, glob, numpy as np
sys.path.insert(0, '/home/claude/pw/comp')
import fielding as fl
F, AGE = fl.load(); TH = json.load(open('fielding_params.json'))['theta']
RAW = '/home/claude/pw/build/fa/proj/raw'
bat = {y: {str(r['playerid']): r for r in json.load(open(f'{RAW}/fg_bat_{y}.json'))['data']} for y in range(2021, 2027)}
R = []
for f in sorted(glob.glob('bt_20*.json')):
    d = json.load(open(f)); T = d['T']
    for x in d['rows']:
        pid = x['pid']; r = bat[T].get(pid)
        if not r: continue
        pa = r['PA']; cur = F.get(pid, {}).get(T, {}); age = (AGE.get(pid, {}).get(T - 1) or 26) + 1
        fld_slot = sum(i / pa * 600 / fl.FULL * fl.predict(F[pid], T, p, age, TH) for p, (i, _) in cur.items()) if pid in F else 0.0
        slot = fld_slot + (x['pos_a'] or 0.0); role = x['fld'] + x['pos']
        dh_share = max(0.0, 1 - sum(i for i, _ in cur.values()) / (pa * 1458 / 683))   # share of PA not in the field
        R.append(dict(T=T, pa=x['pa'], actual=x['actual'], blend=(x['comp'] + x['direct']) / 2, swap=(slot - role) / d['rpw'], dh=dh_share,
                      prev_dh=None))
json.dump(R, open('swapcal_rows.json', 'w'))
def stats(rows, lam_up, lam_dn):
    w = np.array([r['pa'] for r in rows])
    e = np.array([r['blend'] + (lam_up if r['swap'] > 0 else lam_dn) * r['swap'] - r['actual'] for r in rows])
    return float(np.sqrt(np.average(e ** 2, weights=w))), float(np.average(e, weights=w))
groups = {'up (swap > +0.3)': lambda r: r['swap'] > 0.3, 'down (swap < -0.3)': lambda r: r['swap'] < -0.3, 'mostly DH (>=60% PA)': lambda r: r['dh'] >= 0.6, 'all': lambda r: True}
for lam in (0, 0.5, 1.0):
    print('lambda', lam, {g: tuple(round(v, 3) for v in stats([r for r in R if fn(r)], lam, lam)) for g, fn in groups.items()})
train = [r for r in R if r['T'] <= 2024]; test = [r for r in R if r['T'] >= 2025]
grid = np.round(np.arange(0, 1.51, 0.05), 2)
best = min(((stats(train, u, d)[0], u, d) for u in grid for d in grid))
print('fit on 2022-24: lam_up %.2f lam_down %.2f' % (best[1], best[2]))
for name, rows in (('2025-26', test), ('all', R)):
    for g, fn in groups.items():
        sub = [r for r in rows if fn(r)]
        print(name, g, len(sub), 'current (1,1)', tuple(round(v, 3) for v in stats(sub, 1, 1)), 'fitted', tuple(round(v, 3) for v in stats(sub, best[1], best[2])), 'none', tuple(round(v, 3) for v in stats(sub, 0, 0)))
