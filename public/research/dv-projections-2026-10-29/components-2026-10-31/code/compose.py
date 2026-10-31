"""Backtest: composed hitter WAR (batting + baserunning + fielding + positional) vs the direct DV WAR model. See PROTOCOL.md.
Usage: python3 compose.py T [T ...]   (writes /home/claude/pw/comp/bt_T.json)"""
import sys, json
sys.path.insert(0, '/home/claude/pw/pkg/site'); sys.path.insert(0, '/home/claude/pw/comp')
import runtime; runtime.configure(normalize_ip=True)
import numpy as np, dvp, dvp_site
from dvp_site import _feat, has_history
from data import seasons
from feat_pit import fnum
from threadpoolctl import threadpool_limits
import fielding as fl
threadpool_limits(limits=2); dvp.P['n_jobs'] = 2

D = seasons('bat'); F, AGE = fl.load()
TH = json.load(open('/home/claude/pw/comp/fielding_params.json'))['theta']
def per600(r, k):
    pa = fnum(r.get('PA')) or 0; v = fnum(r.get(k))
    return None if not pa or v is None or np.isnan(v) else v / pa * 600
def league_rate(y, k):
    num = den = 0.0
    for h in D.values():
        r = h.get(y)
        if not r: continue
        pa = fnum(r.get('PA')) or 0; v = fnum(r.get(k))
        if pa and v is not None and not np.isnan(v): num += v; den += pa
    return num / den * 600
def league_extra(y):
    """League adjustment per 600 PA and runs per win in season y."""
    lg = pa = rar = war = 0.0
    for h in D.values():
        r = h.get(y)
        if not r or not fnum(r.get('PA')): continue
        g = lambda k: float(np.nan_to_num(fnum(r.get(k)) if r.get(k) is not None else 0.0))
        parts = sum(g(k) for k in ('Batting', 'BaseRunning', 'Fielding', 'Positional', 'Replacement'))
        lg += g('RAR') - parts; pa += g('PA'); rar += g('RAR'); war += g('WAR')
    return lg / pa * 600, rar / war
def anchor(T, fn): return float(np.mean([fn(T - l) for l in (1, 2, 3) if T - l != 2020] or [fn(T - 4)]))

def fit_target(T, key):
    """Same features, learners and windows as dvp_site.fit (v3, h = 1); target = key per 600 PA relative to league."""
    F_, Lr, wkey, start = _feat('bat', 'v3'); unit = 600
    XR, YR, WR = [], [], []
    for t in runtime.training_years(start, T, 1, None):
        if t == 2020: continue
        lgk = league_rate(t, key)
        for pid, hh in D.items():
            if not has_history(hh, t - 1, wkey): continue
            r = hh.get(t); n = fnum((r or {}).get(wkey)) if r else 0.0
            if r and n and n >= 100:
                v = per600(r, key)
                if v is None: continue
                XR.append(F_(hh, t, Lr)); YR.append(v - lgk); WR.append(n)
    keys = sorted(XR[0].keys()); M = lambda X: np.array([[x[k] for k in keys] for x in X], float)
    Xt, ids = [], []
    for pid, hh in D.items():
        if has_history(hh, T - 1, wkey): Xt.append(F_(hh, T, Lr)); ids.append(pid)
    pred = dvp.blend_fit(M(XR), np.array(YR), np.array(WR), M(Xt)) + anchor(T, lambda y: league_rate(y, key))
    return dict(zip(ids, map(float, pred)))

def fielding600(pid, T):
    """Projected fielding runs per 600 PA in the player's T-1 role (position mix and fielding innings per PA)."""
    prev = F.get(pid, {}).get(T - 1, {}); r = D[pid].get(T - 1) or {}
    pa = fnum(r.get('PA')) or 0; inn = sum(i for i, _ in prev.values())
    if not pa or not inn: return 0.0
    age = (AGE.get(pid, {}).get(T - 1) or 26) + 1
    rate = sum(i / inn * fl.predict(F[pid], T, p, age, TH) for p, (i, _) in prev.items())
    return rate * (inn / pa * 600 / fl.FULL)

def run(T):
    direct = dvp_site.fit('bat', T, 1, 'v3')
    bat = fit_target(T, 'Batting'); bsr = fit_target(T, 'BaseRunning')
    lg600 = anchor(T, lambda y: league_extra(y)[0]); rpw = anchor(T, lambda y: league_extra(y)[1])
    repl = anchor(T, lambda y: league_rate(y, 'Replacement'))
    rows = []
    for pid in direct:
        r = D[pid].get(T); prev = D[pid].get(T - 1)
        if not r or (fnum(r['PA']) or 0) < 200 or not prev or (fnum(prev['PA']) or 0) < 100: continue
        if pid not in bat or pid not in bsr: continue
        pos_prev = per600(prev, 'Positional') or 0.0; fld = fielding600(pid, T)
        comp = (bat[pid] + bsr[pid] + fld + pos_prev + lg600 + repl) / rpw
        oracle = (bat[pid] + bsr[pid] + fld + (per600(r, 'Positional') or 0.0) + lg600 + repl) / rpw
        rows.append(dict(pid=pid, pa=float(r['PA']), actual=per600(r, 'WAR'), direct=direct[pid]['rate'], comp=comp, oracle=oracle,
                         bat=bat[pid], bat_a=per600(r, 'Batting'), bsr=bsr[pid], bsr_a=per600(r, 'BaseRunning'), fld=fld, fld_a=per600(r, 'Fielding'),
                         pos=pos_prev, pos_a=per600(r, 'Positional'),
                         bat_m=marcel(pid, T, 'Batting'), bsr_m=marcel(pid, T, 'BaseRunning'), fld_m=marcel(pid, T, 'Fielding')))
    json.dump(dict(T=T, rpw=rpw, lg600=lg600, repl=repl, rows=rows), open(f'/home/claude/pw/comp/bt_{T}.json', 'w'))
    w = np.array([x['pa'] for x in rows]); rm = lambda k, a='actual': float(np.sqrt(np.average([((x[k] or 0.0) - (x[a] or 0.0)) ** 2 for x in rows], weights=w)))
    blend = float(np.sqrt(np.average([((x['comp'] + x['direct']) / 2 - x['actual']) ** 2 for x in rows], weights=w)))
    print(T, 'n', len(rows), 'WAR600 RMSE direct %.3f comp %.3f blend %.3f oracle %.3f' % (rm('direct'), rm('comp'), blend, rm('oracle')),
          '| bat %.2f (marcel %.2f) bsr %.2f (%.2f) fld %.2f (%.2f)' % (rm('bat', 'bat_a'), rm('bat_m', 'bat_a'), rm('bsr', 'bsr_a'), rm('bsr_m', 'bsr_a'), rm('fld', 'fld_a'), rm('fld_m', 'fld_a')), flush=True)

def marcel(pid, T, key):
    """5/4/3 weighted history per 600 PA, regressed with 600 PA of league average (0 for these run components)."""
    num = den = 0.0
    for lag, w in ((1, 5), (2, 4), (3, 3)):
        r = D[pid].get(T - lag)
        if not r: continue
        pa = fnum(r.get('PA')) or 0; v = fnum(r.get(key))
        if pa and v is not None and not np.isnan(v): num += w * v; den += w * pa
    return num / (den + 600 * 5) * 600 if den else 0.0

if __name__ == '__main__':
    for T in map(int, sys.argv[1:]): run(T)
