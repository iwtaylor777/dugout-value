import json, numpy as np
R='../proj/raw/'
act={str(r['playerid']):r for r in json.load(open(R+'fg_bat_2026.json'))['data']}
for name in ('zips','steamer'):
    P=json.load(open(R+f'{name}_cur_bat.json'))
    X=[];y=[];w=[]
    for p in P:
        a=act.get(str(p['playerid']))
        if not a or a['PA']<300 or not p.get('PA') or p['PA']<200: continue
        pos=(a.get('position') or '')
        if pos.startswith('C') and not pos.startswith('CF'): continue
        f=600/p['PA']; fld=(p['Def']-p['Pos'])*f; off=p['Off']*f; ps=p['Pos']*f
        X.append([off/10,fld/10,ps/10,1]); y.append(a['WAR']/a['PA']*600); w.append(a['PA'])
    X=np.array(X);y=np.array(y);w=np.array(w); sw=np.sqrt(w)
    b=np.linalg.lstsq(X*sw[:,None],y*sw,rcond=None)[0]
    rng=np.random.default_rng(4); bs=[]
    for _ in range(2000):
        i=rng.integers(0,len(y),len(y)); bb=np.linalg.lstsq(X[i]*sw[i][:,None],y[i]*sw[i],rcond=None)[0]; bs.append(bb[1]/bb[0])
    print(f'{name}: n={len(y)} actual 2026 WAR/600 per projected win/600 — off {b[0]:.2f}, fld {b[1]:.2f}, pos {b[2]:.2f} | fld/off {b[1]/b[0]:.2f} 95% {np.round(np.percentile(bs,[2.5,97.5]),2)}')
