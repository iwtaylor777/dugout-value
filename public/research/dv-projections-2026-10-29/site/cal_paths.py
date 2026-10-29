"""DV WAR paths at signing for 2021-26 free agents, built exactly like the site's DV projections."""
import json, os, numpy as np
from data import seasons
from feat_pit import fnum
SITE = os.path.expanduser('~/mnt/Baseball/analysis/projections/site/')
CAL = os.path.expanduser('~/build/proj/cal/')
QM = json.load(open(SITE + 'pt_quantile_map_2026.json')); RET = json.load(open(SITE + 'retention.json'))
FA = json.load(open(os.path.expanduser('~/mnt/Baseball/analysis/fa_market_calibration/raw/fg_fa_tracker_2020_2027.json')))
CAP = {'bat': 700, 'pit': 200}
def curve_for(kind, S):
    D = seasons(kind); key = 'PA' if kind == 'bat' else 'IP'; unit = 600 if kind == 'bat' else 180; mn = 200 if kind == 'bat' else 40; ch = {}
    for pid, h in D.items():
        for y in h:
            if y + 1 in h and y + 1 <= S - 1 and y != 2020 and y + 1 != 2020:
                a, b = h[y], h[y + 1]; na, nb = fnum(a.get(key)) or 0, fnum(b.get(key)) or 0
                if na >= mn and nb >= mn and a.get('Age'):
                    ch.setdefault(int(a['Age']), []).append((min(na, nb), fnum(b['WAR']) / nb * unit - fnum(a['WAR']) / na * unit))
    c = {}
    for age in range(18, 50):
        pts = [p for g in range(age - 1, age + 2) for p in ch.get(g, [])]
        c[age] = float(np.average([v for _, v in pts], weights=[w for w, _ in pts])) if len(pts) > 30 else 0.0
    return c
deals = []; cache = {}
for d in FA:
    S = d['tracker_season']
    if d['ContractType'] != 'Free Agent' or not d['ContractTotal'] or not d['YearsTotal'] or not (2021 <= S <= 2026): continue
    aav = d['ContractTotal'] / d['YearsTotal'] / 1e6 * 1.03 ** (2026 - S)
    if aav < 2: continue
    pos = (d.get('position') or '').split('/')[0]
    kind = 'pit' if pos in ('SP', 'RP', 'CL', 'P') else 'bat'; role = 'reliever' if pos in ('RP', 'CL') else ('starter' if kind == 'pit' else 'position')
    pid = str(d['playerId']); D = seasons(kind)
    if (kind, S) not in cache:
        cache[(kind, S)] = ([json.load(open(f'{CAL}{kind}_{S}_{h}.json')) for h in range(1, 6)], curve_for(kind, S))
    F, curve = cache[(kind, S)]
    if pid not in F[0]: continue
    hh = D.get(pid, {}); prior = [y for y in hh if y <= S - 1]
    if not prior: continue
    last = max(prior); age = int(hh[last]['Age']) + (S - last) if hh[last].get('Age') else d.get('age')
    key = 'PA' if kind == 'bat' else 'IP'; unit = 600 if kind == 'bat' else 180
    wl = sorted([fnum(hh[y].get(key)) or 0 for y in (S - 3, S - 2, S - 1) if y in hh], reverse=True)
    healthy = min(CAP[kind], float(np.mean(wl[:2]))) if wl else 0.0
    r1, p1 = F[0][pid]
    pt0 = max(float(np.interp(p1, QM[kind]['dv'], QM[kind]['zips'])), healthy)
    raw = []
    for h in range(5):
        dr = F[h].get(pid); aged = r1 + sum(curve.get(age + j, 0.0) for j in range(h))
        raw.append(0.7 * dr[0] + 0.3 * aged if dr else aged)
    ks = np.arange(1, 5); b = float((ks * (np.array(raw[1:]) - raw[0])).sum() / (ks * ks).sum())
    yrs = d['YearsTotal']; rr = role if kind == 'pit' else 'position'; path = []; f = 1.0; rate = raw[0]
    for k in range(yrs):
        if k: f *= RET[rr].get(str(min(48, age + k)), 1.0)
        rate = raw[0] + b * k if k < 5 else rate + curve.get(age + k, 0.0)
        path.append(round(rate * pt0 * f / unit, 3))
    deals.append(dict(name=d['playerName'], season=S, role=role, pos=pos, age=age, yrs=yrs, aav=aav, w1=path[0], path=path,
                      fg_proj=d.get('war_proj')))
json.dump(deals, open(SITE + 'cal_deals_dv.json', 'w'))
print('deals', len(deals), 'by season', {s: sum(1 for x in deals if x['season'] == s) for s in range(2021, 2027)})
