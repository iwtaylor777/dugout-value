import json, numpy as np
exec(open('marcel.py').read().split("rows=[]")[0])
Z={'bat':{str(r['playerid']):r for r in json.load(open('raw/zips_cur_bat.json'))},'pit':{str(r['playerid']):r for r in json.load(open('raw/zips_cur_pit.json'))}}
A=json.load(open('update2_params.json'))['AGE']
for kind,D,key,ball,bpt,minw,unit,minact in (('bat',H,'pa',1200,200,100,600,200),('pit',P,'ip',300,30,20,180,40)):
    xs=[];ys=[];w=[]
    for pid,z in Z[kind].items():
        h=D.get(pid,{})
        if h.get(2025,{}).get(key,0)>=minw: continue          # low-history only
        if h.get(2026,{}).get(key,0)<minact: continue
        zw=z.get('PA' if kind=='bat' else 'IP')
        if not zw: continue
        age=(h[2026]['age'] or 25)
        m,mr,_=marcel(h,key,2025,1,ball,bpt); mr+=A[kind]*(age-29)
        zr=z['WAR']/zw; ar=h[2026]['war']/h[2026][key]
        xs.append((zr-mr)*unit); ys.append((ar-mr)*unit); w.append(h[2026][key])
    xs,ys,w=map(np.array,(xs,ys,w)); k=(w*xs*ys).sum()/(w*xs*xs).sum()
    rng=np.random.default_rng(3); bs=[]
    for _ in range(2000):
        i=rng.integers(0,len(xs),len(xs)); bs.append((w[i]*xs[i]*ys[i]).sum()/(w[i]*xs[i]**2).sum())
    print(kind,'low-history n',len(xs),'k',round(k,3),np.round(np.percentile(bs,[2.5,97.5]),3))
