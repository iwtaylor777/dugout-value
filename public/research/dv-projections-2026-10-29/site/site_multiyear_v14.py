"""Site multi-year WAR rates 2027-31 (v1.4): 0.7 x horizon-h model + 0.3 x (h=1 model + the site's fixed age policy,
lib/aging-curve.mjs empiricalRateChange, by role and position). v1.1-1.3 used a historical delta-method curve here;
the fixed policy had lower error in corrected-timing backtests (projection_v2_dev, Oct 30, 2026).
Writes dvp_multiyear.json with per-player rate and expected PT by year."""
import argparse, json, numpy as np
import runtime
runtime.configure(normalize_ip=True)
from data import seasons
from feat_pit import fnum
parser=argparse.ArgumentParser()
parser.add_argument('--input',required=True)
parser.add_argument('--output',required=True)
parser.add_argument('--year',type=int,default=2027)
parser.add_argument('--policy',required=True,help='fixed age policy JSON exported from lib/aging-curve.mjs')
args=parser.parse_args(); YEAR=args.year; CUTOFF=YEAR-1
M = json.load(open(args.input)); POLICY = json.load(open(args.policy))
out = {}
for kind, key, unit, mn in (('bat', 'PA', 600, 200), ('pit', 'IP', 180, 40)):
    D = seasons(kind); ch = {}
    for pid, h in D.items():
        for y in h:
            if y + 1 in h and y + 1 <= CUTOFF and y != 2020 and y + 1 != 2020:
                a, b = h[y], h[y + 1]; na, nb = fnum(a.get(key)) or 0, fnum(b.get(key)) or 0
                if na >= mn and nb >= mn and a.get('Age'):
                    ch.setdefault(int(a['Age']), []).append((min(na, nb), fnum(b['WAR']) / nb * unit - fnum(a['WAR']) / na * unit))
    curve = {}
    for age in range(18, 50):
        pts = [p for g in range(age - 1, age + 2) for p in ch.get(g, [])]
        curve[age] = float(np.average([v for _, v in pts], weights=[w for w, _ in pts])) if len(pts) > 30 else 0.0
    one = M[f'{kind}_{YEAR}']; res = {}
    for pid, v in one.items():
        h = D.get(pid, {}); prior=[y for y in h if y<=CUTOFF]; last = max(prior) if prior else None
        if last is None or not h[last].get('Age'): continue
        age27 = int(h[last]['Age']) + (YEAR - last)
        rates, pts = {}, {}
        pos = str(h[last].get('position') or '').upper().split('/')[0]
        rec = [y for y in prior if y >= CUTOFF - 2]; gs = sum(fnum(h[y].get('GS')) or 0 for y in rec); g = sum(fnum(h[y].get('G')) or 0 for y in rec)
        if kind == 'bat': pk, scale = ('position:C' if pos == 'C' else 'position:SS' if pos in ('SS', '2B', 'CF') else 'position:LF'), 1.0
        else: pk, scale = ('starter:SP', 1.0) if g and gs / g >= .5 else ('reliever:RP', 180 / 65)
        step = lambda a: POLICY[pk].get(str(min(48, max(18, a))), 0.0) * scale
        for k in range(5):
            y = YEAR + k; d = M[f'{kind}_{y}'].get(pid)
            aged = v['rate'] + sum(step(age27 + j + 1) for j in range(k))
            rates[y] = round(0.7 * d['rate'] + 0.3 * aged, 3) if d else round(aged, 3)
            pts[y] = round(d['pt'], 1) if d else None
        res[pid] = dict(age2027=age27, rate=rates, pt=pts)
    out[kind] = res
json.dump(out, open(args.output, 'w'))
