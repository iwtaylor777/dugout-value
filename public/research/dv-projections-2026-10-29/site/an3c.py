import json, sys, os
sys.path.insert(0, os.environ.get('DV_DEV_HARNESS', '.'))  # exp_score.py from analysis/projection_v2_dev
from exp_score import compare
R = json.load(open('/tmp/exp3c_rows.json'))
for kind in ('bat', 'pit'):
    for lab, Os in (('pre-registered origins 2018/19/21 (targets <=2024)', (2018, 2019, 2021)), ('origins 2022-24 (targets <=2026, reused)', (2022, 2023, 2024))):
        rows = [r for r in R if r['kind'] == kind and r['O'] in Os]
        print(kind, lab, 'n', len(rows), 'direct-model share', round(sum(r['has_direct'] for r in rows) / max(1, len(rows)), 2))
        for v in ('fixed_sm', 'direct_sm', 'site', 'fixed'):
            c = compare(rows, v, 'site_sm', boot=800)
            print(f"   {v:10} vs site(smoothed): {c['rel']*100:+.1f}% [{c['ci'][0]*100:+.1f}, {c['ci'][1]*100:+.1f}]  rmse {c['a']:.3f} vs {c['b']:.3f}")
        for h in (2, 3, 4, 5):
            rr = [r for r in rows if r['h'] == h]
            if len(rr) >= 30:
                c = compare(rr, 'fixed_sm', 'site_sm', boot=500); print(f"      h{h} n={len(rr)} fixed_sm {c['rel']*100:+.1f}% [{c['ci'][0]*100:+.1f}, {c['ci'][1]*100:+.1f}]")
