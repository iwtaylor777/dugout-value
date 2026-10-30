"""Usage: build_dv_site.py DB DVP_2027 MULTIYEAR QMAP ESTABLISHED WORKLOADS RETENTION OUT
Build app/data/dv-projections.json: Dugout Value projections v1.3 on the site's full-season scale.

Rates. 2027-31 WAR rates (per 600 PA / 180 IP) come from horizon-specific models (h = 1..5, data through 2026),
blended 0.7 / 0.3 with the 2027 rate plus a standard aging curve, then smoothed: the 2027 rate is kept and later
years follow each player's least-squares linear trend through his 2028-31 rates. Each player gets his own aging path.
Playing time. Full season = the larger of (a) the model's expected 2027 playing time mapped onto ZiPS's scale by rank
and (b) the player's healthy workload (mean of his two largest 2024-26 PA or IP totals, capped at 700 PA / 200 IP).
Later years multiply it by the site's workload retention for the player's role at each age.
After 2031 the site's existing aging shape continues from the 2031 level.
"""
import json, sys, numpy as np
DB, DVP, MY, QMAP, EST, WL, RET, OUT = sys.argv[1:9]
RET = json.load(open(RET))  # site workload retention by role and age (lib/aging-curve.mjs)
D = json.load(open(DB)); P = json.load(open(DVP)); MY = json.load(open(MY)); M = json.load(open(QMAP))
EST = {k: set(v) for k, v in json.load(open(EST)).items()}
WL = json.load(open(WL)); CAP = {'bat': 700, 'pit': 200}
YRS = [2027, 2028, 2029, 2030, 2031]
def mp(k, x, role):
    key=f'pit_{role}' if k=='pit' and f'pit_{role}' in M else k
    value=float(np.interp(x,M[key]['dv'],M[key]['zips']))
    if k=='pit' and role=='reliever': value=min(value,M[key]['zips'][80])
    return value
def healthy(k, fg):
    v = WL[k].get(fg) or []
    return min(CAP[k], float(np.mean(v[:2]))) if v else 0.0
def smooth(r):
    r0 = r[0]; ks = np.arange(1, len(r)); d = np.array(r[1:]) - r0
    b = float((ks * d).sum() / (ks * ks).sum())
    return [r0 + b * k for k in range(len(r))]
def part(k, fg, role):
    v = P[f'{k}_2027'].get(fg); m = MY[k].get(fg)
    if not v or not m: return None
    unit = 600 if k == 'bat' else 180
    pt0 = max(mp(k, v['pt'], role), healthy(k, fg))
    rates = smooth([m['rate'][str(y)] for y in YRS])
    rr = role if k == 'pit' else 'position'
    pts, f = [], 1.0
    for i in range(len(YRS)):
        if i: f *= RET[rr].get(str(min(48, m['age2027'] + i)), 1.0)
        pts.append(pt0 * f)
    return dict(war=[r * p / unit for r, p in zip(rates, pts)], rate=rates, pt=pts)
import os
WITH_PATH = os.environ.get('WITH_PATH') == '1'; paths = {}
out = {}
for p in D['players']:
    if p.get('kind') != 'mlb' or p.get('custom'): continue
    fg = str(p.get('fangraphsId') or '')
    role = p.get('role')
    kinds = ['bat', 'pit'] if role == 'two-way' else (['pit'] if role in ('starter', 'reliever') else ['bat'])
    if not all(fg in EST[k] for k in kinds): continue
    prole = role if role in ('starter', 'reliever') else 'starter'
    parts = [part(k, fg, prole) for k in kinds]
    if any(x is None for x in parts): continue
    war = {y: sum(x['war'][i] for x in parts) for i, y in enumerate(YRS)}
    site = {s['year']: s['war'] for s in p.get('seasons', []) if not s.get('ros')}
    three = {s['year']: s['war'] for s in p.get('threeYearProjection', [])}
    s31 = site.get(2031)
    def val(y, w):
        if y < 2027: return w
        if y in war: return war[y]
        if s31 is not None and s31 >= 0.5: return w * war[2031] / s31
        return w + (war[2031] - (s31 if s31 is not None else w)) * 0.85 ** (y - 2031)
    one = parts[0] if len(parts) == 1 else None
    if WITH_PATH: paths[p['id']] = {str(y): round(war[y], 2) for y in YRS}
    out[p['id']] = dict(war={str(y):round(war[y],2) for y in YRS},
                        three={str(y): round(val(y, w), 2) for y, w in three.items() if y >= 2027},
                        seasons={str(y): round(val(y, w), 2) for y, w in site.items() if y >= 2027},
                        rate={str(y): round(one['rate'][i], 2) for i, y in enumerate(YRS)} if one else None,
                        pt={str(y): round(one['pt'][i]) for i, y in enumerate(YRS)} if one else None,
                        unit=('600 PA' if kinds == ['bat'] else '180 IP') if one else None)
meta = dict(model='Dugout Value projections v1.3', built='2026-10-29', dataThrough=2026,
            note=('2027-31 WAR = Dugout Value WAR rate (player-specific multi-year model) x full-season playing time. '
                  'After 2031 the site aging shape continues. Only players with 100+ PA or 20+ IP in 2024-26 get DV numbers; everyone else keeps ZiPS.'),
            players=len(out))
json.dump(dict(meta=meta, players=out), open(OUT, 'w'), separators=(',', ':'))
if WITH_PATH: json.dump(paths, open(OUT + '.paths.json', 'w'))
print(meta['players'])
