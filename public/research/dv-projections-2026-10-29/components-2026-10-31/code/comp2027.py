"""2027 component projections for hitters: batting and baserunning runs per 600 PA, fielding runs per full season at each
position, and the defense in each player's 2026 role. Output keyed by FanGraphs id (private)."""
import sys, json
sys.argv = ['x']; sys.path.insert(0, '/home/claude/pw/comp')
import numpy as np, compose as c, fielding as fl
T = 2027
bat = c.fit_target(T, 'Batting'); bsr = c.fit_target(T, 'BaseRunning')
lg = c.anchor(T, lambda y: c.league_extra(y)[0]); rpw = c.anchor(T, lambda y: c.league_extra(y)[1]); repl = c.anchor(T, lambda y: c.league_rate(y, 'Replacement'))
out = {}
for pid in bat:
    h = c.F.get(pid, {}); age = (c.AGE.get(pid, {}).get(T - 1) or 26) + 1
    inn, _ = fl.evidence(h, T)
    fr = {p: round(fl.predict(h, T, p, age, c.TH), 1) for p in fl.POS if p != 'C' or inn.get('C')}
    if not any(inn.values()): fr = {}
    prev = c.D[pid].get(T - 1)
    role = None
    if prev and (c.fnum(prev.get('PA')) or 0) >= 50:
        role = round(c.fielding600(pid, T) + (c.per600(prev, 'Positional') or 0.0), 1)
    out[pid] = dict(bat=round(bat[pid], 1), bsr=round(bsr.get(pid, 0.0), 1), fr=fr, role=role)
json.dump(dict(meta=dict(T=T, rpw=rpw, lg600=lg, repl600=repl, fielding_theta=c.TH, note='runs per 600 PA; fr = fielding runs per 1,281 innings by position'), players=out),
          open('/home/claude/pw/comp/components_2027.json', 'w'))
m = out.get('23986'); print('Mead', m, 'rpw', rpw, 'lg', lg, 'repl', repl)
