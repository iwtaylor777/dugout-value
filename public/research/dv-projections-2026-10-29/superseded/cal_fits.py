"""Fits for the $/WAR recalibration: DV rates and expected PT for every FA class S (data through S-1), horizons 1..5."""
import sys, json, os, dvp_site
S, kind = int(sys.argv[1]), sys.argv[2]
for h in range(1, 6):
    f = os.path.expanduser(f'~/build/proj/cal/{kind}_{S}_{h}.json')
    if os.path.exists(f): continue
    r = dvp_site.fit(kind, S + h - 1, h, 'v3' if kind == 'bat' else 'v1')
    json.dump({k: [round(v['rate'], 3), round(v['pt'], 1)] for k, v in r.items()}, open(f, 'w'))
    print(kind, S, h, len(r), flush=True)
