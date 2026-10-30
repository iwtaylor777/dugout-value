"""Run every protocol test on the 2022-26 holdout with the locked DV WAR v1 weights."""
import os, sys, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import evalsplit, eval_season as E, season

best = json.load(open('/home/claude/war/LOCK-DVWAR-v1.json'))['params']
HY = [2022, 2023, 2024, 2025, 2026]
SYS = {'fip': ('fip', None), 'ra9': ('ra9', None), 'dv': ('dv', best)}
res = dict(params=best)
res['T1 split-season transfer (primary)'] = evalsplit.score(HY, SYS, 'transfer', B=2000)
print('T1', json.dumps(res['T1 split-season transfer (primary)']), flush=True)
res['T2 split-season accounting'] = evalsplit.score(HY, SYS, 'acc', B=2000)
print('T2 done', flush=True)
S = E.systems(best)
res['T7 roster churn (co-primary)'] = E.team_test('churn', season.PAIRS_HOLD, S, B=2000)
print('T7', json.dumps(res['T7 roster churn (co-primary)']['pred_rd->a_rd']), flush=True)
res['T3 season transfer'] = E.team_test('transfer', [p for p in season.PAIRS_HOLD if p[1] >= 2023], S, B=2000)
res['T4 season accounting'] = E.team_test('transfer', [(y, y) for y in HY], S, B=2000)
print('T3/T4 done', flush=True)
res['T5 pay'] = E.pay_test(best)
res['T6 stability'] = E.stability(best, season.PAIRS_HOLD)
json.dump(res, open('/home/claude/war/holdout_results_v1.json', 'w'), indent=1)
print('ALL DONE', flush=True)
