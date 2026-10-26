import json, numpy as np
exec(open('update.py').read().split("# 2) k on 2026")[0])
Z={'bat':{str(r['playerid']):r for r in json.load(open('raw/zips_cur_bat.json'))},'pit':{str(r['playerid']):r for r in json.load(open('raw/zips_cur_pit.json'))}}
for kind,unit,minact in (('bat',600,300),('pit',180,60)):
    D,key,ball,bpt,minw=CFG[kind]; xs=[];ys=[];w=[]
    for pid,h in D.items():
        z=Z[kind].get(pid)
        if not z or 2025 not in h or h[2025][key]<minw or h.get(2026,{}).get(key,0)<minact or not z.get(key.upper() if key=='pa' else 'IP'): continue
        m,mr,_=marcel(h,key,2025,1,ball,bpt)
        zr=z['WAR']/z['PA' if key=='pa' else 'IP']; ar=h[2026]['war']/h[2026][key]
        xs.append((zr-mr)*unit); ys.append((ar-mr)*unit); w.append(h[2026][key])
    xs=np.array(xs);ys=np.array(ys);w=np.array(w); k=(w*xs*ys).sum()/(w*xs*xs).sum()
    rng=np.random.default_rng(2); bs=[]
    for _ in range(2000):
        i=rng.integers(0,len(xs),len(xs)); bs.append((w[i]*xs[i]*ys[i]).sum()/(w[i]*xs[i]**2).sum())
    print(kind,'rate-level n',len(xs),'k',round(k,3),np.round(np.percentile(bs,[2.5,97.5]),3))
