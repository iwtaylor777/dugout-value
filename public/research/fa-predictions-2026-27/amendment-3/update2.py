import json, numpy as np, os
exec(open('marcel.py').read().split("rows=[]")[0])
CFG={'bat':('pa',1200,200,100,600),'pit':('ip',300,30,20,180)}
DS={'bat':H,'pit':P}
# history rows: rate-level age slope and total calibration
AGE={};CAL={}
for kind,(key,ball,bpt,minw,unit) in CFG.items():
    D=DS[kind]; A=[];T=[]
    for pid,h in D.items():
        for t in range(2018,2026):
            if t==2020 or t+1==2020 or t not in h or h[t][key]<minw: continue
            age=(h[t]['age'] or 29)+1
            if age>38: continue
            m,mr,pt=marcel(h,key,t,1,ball,bpt); nx=h.get(t+1)
            if nx and nx[key]>=minw: A.append((nx['war']/nx[key]-mr, age-29, nx[key]))
            T.append((m,age,mr,pt,nx['war'] if nx else 0.0))
    A=np.array(A); s=float((A[:,2]*A[:,0]*A[:,1]).sum()/(A[:,2]*A[:,1]**2).sum()); AGE[kind]=s
    T=np.array(T); x=(T[:,2]+s*(T[:,1]-29))*T[:,3]; X=np.c_[x,np.ones(len(x))]; b,*_=np.linalg.lstsq(X,T[:,4],rcond=None); CAL[kind]=b
    res=T[:,4]-X@b; print(kind,'age slope per',unit,round(s*unit,3),'| total calib',np.round(b,3),'rmse',round(float(np.sqrt((res**2).mean())),3))
K={'bat':0.575,'pit':0.628}
json.dump({'AGE':AGE,'CAL':{k:list(map(float,v)) for k,v in CAL.items()},'K':K},open('update2_params.json','w'),indent=1)
# apply to database players
db=json.load(open(os.path.expanduser('~/build/model/app/data/player-database.json')))
cands=json.load(open('../predictions_v6.json'))['rows']; names={r['dbName'] or r['name'] for r in cands}
out={}
for p in db['players']:
    if p['kind']!='mlb' or p['name'] not in names: continue
    fid=str(p.get('fangraphsId')); tp={x['year']:x for x in p['threeYearProjection']}
    s27=next((s for s in p.get('seasons',[]) if s['year']==2027),None)
    ph=P.get(fid,{}); hh=H.get(fid,{})
    # role from 2026 usage for pitchers
    role=p['role']
    if role in ('starter','reliever') and 2026 in ph and ph[2026]['g']>0:
        gs,g,ip=ph[2026]['gs'],ph[2026]['g'],ph[2026]['ip']
        if gs>=10 and gs/g>=0.5: role='starter'
        elif gs/g<0.2 and ip>=20: role='reliever'
    kind='bat' if p['role']=='position' else 'pit'; key,ball,bpt,minw,unit=CFG[kind]; h=hh if kind=='bat' else ph
    if not h: continue
    age27=p['age']+1
    m,mr,pt=marcel(h,key,2026,1,ball,bpt); ms,mrs,_=marcel(h,key,2025,2,ball,bpt)
    z27=tp.get(2027,{}).get('war'); zwork=(s27 or {}).get('arbMetrics',{}).get(key)
    if z27 is None: continue
    zr=(z27/zwork) if zwork else mrs
    rate=mr+AGE[kind]*(age27-29)+K[kind]*(zr-(mrs+AGE[kind]*(age27-29)))
    b=CAL[kind]; new27=b[0]*rate*pt+b[1]
    out[p['name']]=dict(role_db=p['role'],role_new=role,age27=age27,zips27=z27,zips28=tp.get(2028,{}).get('war'),war26=h.get(2026,{}).get('war'),new27=round(new27,1),pt=round(pt),zwork=zwork)
json.dump(out,open('updated27.json','w'),indent=1)
for n in ['Randy Arozarena','Seiya Suzuki','Daulton Varsho','Trent Grisham','Dustin May','Foster Griffin','Bo Bichette','Tarik Skubal','Kris Bubic','Jazz Chisholm Jr.','Freddy Peralta','Gleyber Torres','Trevor Rogers','Drew Rasmussen','Brady Singer','TJ Friedl','Zac Gallen','Zack Littell','Ha-Seong Kim','Ian Happ','J.P. Crawford','Luis Arraez','Brandon Lowe','Jack Flaherty','Shane Bieber','Brandon Woodruff','Casey Mize','Clay Holmes','Jeff McNeil','David Peterson','Adrian Morejon','Bryan Abreu','Hunter Harvey','Corbin Burnes','Ronald Acuña Jr.']:
    print(n, out.get(n))
