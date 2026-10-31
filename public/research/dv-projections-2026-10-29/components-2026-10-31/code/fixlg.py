import sys, json, glob
sys.argv = ['x']
sys.path.insert(0, '/home/claude/pw/comp')
import compose as c
for f in sorted(glob.glob('/home/claude/pw/comp/bt_20*.json')):
    d = json.load(open(f)); T = d['T']
    lg = c.anchor(T, lambda y: c.league_extra(y)[0]); rpw = c.anchor(T, lambda y: c.league_extra(y)[1])
    for x in d['rows']:
        base = x['bat'] + x['bsr'] + x['fld'] + lg + d['repl']
        x['comp'] = (base + x['pos']) / rpw; x['oracle'] = (base + (x['pos_a'] or 0.0)) / rpw
    d['lg600'] = lg; d['rpw'] = rpw; json.dump(d, open(f, 'w')); print(T, round(lg, 3), round(rpw, 3))
