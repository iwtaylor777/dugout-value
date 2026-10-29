"""Usage: build_dv_site.py DB DVP QMAP ESTABLISHED WORKLOADS OUT
Build app/data/dv-projections.json: Dugout Value projections v1.1 on the site's full-season scale.

2027 WAR = DV WAR rate (per 600 PA / 180 IP, data through 2026) x full-season playing time, where full-season
playing time is the larger of (a) the model's expected playing time mapped onto ZiPS's playing-time scale by
rank and (b) the player's healthy workload, the mean of his two largest PA or IP totals in 2024-26 (one season if
he has only one), capped at 700 PA / 200 IP. (b) keeps a recent injury from cutting a regular's season, matching
ZiPS's full-workload convention that the $/WAR calibration used.
Later seasons keep the site's existing aging shape: each year is scaled by DV 2027 / site 2027 (additive, fading
15% a year, when the site's 2027 WAR is under 0.5).
"""
import json, sys, numpy as np
DB, DVP, QMAP, EST, WL, OUT = sys.argv[1:7]
D = json.load(open(DB)); P = json.load(open(DVP)); M = json.load(open(QMAP))
EST = {k: set(v) for k, v in json.load(open(EST)).items()}
WL = json.load(open(WL)); CAP = {'bat': 700, 'pit': 200}
def mp(k, x): return float(np.interp(x, M[k]['dv'], M[k]['zips']))
def healthy(k, fg):
    v = WL[k].get(fg) or []
    if not v: return 0.0
    return min(CAP[k], float(np.mean(v[:2])))
def part(k, fg):
    v = P[f'{k}_2027'].get(fg)
    if not v: return None
    unit = 600 if k == 'bat' else 180
    pt = max(mp(k, v['pt']), healthy(k, fg))
    return dict(war=v['rate'] * pt / unit, rate=v['rate'], pt=pt)
out = {}
for p in D['players']:
    if p.get('kind') != 'mlb' or p.get('custom'): continue
    fg = str(p.get('fangraphsId') or '')
    role = p.get('role')
    kinds = ['bat', 'pit'] if role == 'two-way' else (['pit'] if role in ('starter', 'reliever') else ['bat'])
    if not all(fg in EST[k] for k in kinds): continue
    parts = [part(k, fg) for k in kinds]
    if any(x is None for x in parts): continue
    w27 = sum(x['war'] for x in parts)
    site = {s['year']: s['war'] for s in p.get('seasons', []) if not s.get('ros')}
    three = {s['year']: s['war'] for s in p.get('threeYearProjection', [])}
    b27 = site.get(2027, three.get(2027))
    if b27 is None: continue
    def shift(y, w):
        if y < 2027: return w
        return w * w27 / b27 if b27 >= 0.5 else w + (w27 - b27) * 0.85 ** (y - 2027)
    out[p['id']] = dict(three={str(y): round(shift(y, w), 2) for y, w in three.items() if y >= 2027},
                        seasons={str(y): round(shift(y, w), 2) for y, w in site.items() if y >= 2027},
                        rate2027=round(parts[0]['rate'], 2) if len(parts) == 1 else None,
                        pt2027=round(parts[0]['pt']) if len(parts) == 1 else None)
meta = dict(model='Dugout Value projections v1.1', built='2026-10-29', dataThrough=2026,
            note=('2027 WAR = Dugout Value WAR rate x full-season playing time (the larger of the model\'s expected '
                  'playing time mapped onto ZiPS\'s scale and the player\'s healthy 2024-26 workload). Later seasons keep '
                  'the site\'s aging shape. Only players with 100+ PA or 20+ IP in 2024-26 get DV numbers; everyone else keeps ZiPS.'),
            players=len(out))
json.dump(dict(meta=meta, players=out), open(OUT, 'w'), separators=(',', ':'))
print(meta['players'])
