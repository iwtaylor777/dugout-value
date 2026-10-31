"""Fielding-by-position projections (see PROTOCOL.md)."""
import json, numpy as np, collections
from scipy.optimize import minimize
RAW = '/home/claude/pw/comp/raw'; BRAW = '/home/claude/pw/build/fa/proj/raw'
ADJ = {'C': 12.5, '1B': -12.5, '2B': 2.5, '3B': 2.5, 'SS': 7.5, 'LF': -7.5, 'CF': 2.5, 'RF': -7.5}
FULL = 1281.0  # innings for 600 PA of a full-time player (1,458 x 600 / 683)
POS = list(ADJ)

def load():
    """F[pid][year][pos] = (innings, fielding runs); AGE[pid][year]."""
    F = collections.defaultdict(lambda: collections.defaultdict(dict)); AGE = collections.defaultdict(dict)
    for y in range(2016, 2027):
        for r in json.load(open(f'{RAW}/fg_fld_{y}.json'))['data']:
            p = r['Pos']
            if p not in ADJ or not r.get('Inn') or r.get('Defense') is None: continue
            fld = r['Defense'] - ADJ[p] * r['Inn'] / 1458.0
            F[str(r['playerid'])][y][p] = (float(r['Inn']), float(fld))
        for r in json.load(open(f'{BRAW}/fg_bat_{y}.json'))['data']:
            if r.get('Age') is not None: AGE[str(r['playerid'])][y] = float(r['Age'])
    return F, AGE

W = {1: 5.0, 2: 4.0, 3: 3.0}
def evidence(h, T):
    """Weighted innings and runs at each position from T-1..T-3."""
    inn = collections.defaultdict(float); runs = collections.defaultdict(float)
    for lag, w in W.items():
        for p, (i, f) in h.get(T - lag, {}).items():
            inn[p] += w * i; runs[p] += w * f
    return inn, runs

def predict(h, T, p, age, th):
    """Projected fielding runs per FULL innings at position p for season T."""
    k1, k2, alpha, aging = th
    inn, runs = evidence(h, T)
    num = 0.0; den = 0.0
    if inn.get(p):
        num += runs[p]; den += inn[p] / FULL      # own position: rate (runs per FULL innings) x weighted full seasons
    other_num = 0.0; other_den = 0.0
    if p != 'C':
        for q in POS:
            if q == p or q == 'C' or not inn.get(q): continue
            rate_q = runs[q] / inn[q] * FULL
            other_num += (rate_q + alpha * (ADJ[q] - ADJ[p])) * inn[q] / FULL
            other_den += inn[q] / FULL
    # other positions count as weaker evidence: discount by k1/(k1+k2)
    disc = k1 / (k1 + k2) if (k1 + k2) > 0 else 0.0
    num += disc * other_num; den += disc * other_den
    est = num / (den + k1) if den > 0 else 0.0   # k1: regression toward average, in weighted full seasons
    if age is not None: est += aging * (age - 27.0)
    return est

def targets(F, AGE, years, min_inn=300):
    rows = []
    for pid, h in F.items():
        for T in years:
            for p, (i, f) in h.get(T, {}).items():
                if i < min_inn: continue
                if not any(T - l in h for l in W): continue
                age = AGE.get(pid, {}).get(T)
                rows.append((pid, T, p, i, f / i * FULL, age))
    return rows

def loss(th, F, rows):
    if th[0] <= 0 or th[1] < 0: return 1e9
    e = [(predict(F[pid], T, p, age, th) - y) ** 2 * i for pid, T, p, i, y, age in rows]
    return float(np.sum(e) / np.sum([r[3] for r in rows]))

def fit(F, AGE, years=range(2017, 2022)):
    rows = targets(F, AGE, years)
    best = None
    for x0 in ([10, 10, 0.5, -0.2], [3, 30, 0.8, -0.3], [20, 5, 0.3, 0.0]):
        r = minimize(loss, x0, args=(F, rows), method='Nelder-Mead', options=dict(maxiter=400, xatol=1e-3, fatol=1e-4))
        if best is None or r.fun < best.fun: best = r
    return best.x.tolist(), best.fun, len(rows)

def marcel(h, T, p):
    inn, runs = evidence(h, T)
    return runs[p] / (inn[p] + 5.0 * FULL) * FULL if inn.get(p) else 0.0   # one weighted season (weight 5) of average

if __name__ == '__main__':
    F, AGE = load()
    th, l, n = fit(F, AGE)
    print('params k1,k2,alpha,aging =', [round(v, 3) for v in th], 'train MSE', round(l, 2), 'n', n)
    json.dump({'theta': th, 'train_mse': l, 'n': n}, open('/home/claude/pw/comp/fielding_params.json', 'w'))
    for T in range(2022, 2027):
        rows = targets(F, AGE, [T])
        tot = sum(r[3] for r in rows)
        rm = lambda f: np.sqrt(sum((f(r) - r[4]) ** 2 * r[3] for r in rows) / tot)
        print(T, 'n', len(rows), 'RMSE model %.2f  marcel %.2f  zero %.2f' % (
            rm(lambda r: predict(F[r[0]], r[1], r[2], r[5], th)), rm(lambda r: marcel(F[r[0]], r[1], r[2])), rm(lambda r: 0.0)))
