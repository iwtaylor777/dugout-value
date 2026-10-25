import json, glob, numpy as np, collections
W=collections.defaultdict(float)  # (playerid, season) -> WAR (bat + pit)
for f in glob.glob('fg_*_*.json'):
    st,y=f[3:6],int(f[7:11]); d=json.load(open(f)); d=d.get('data',d)
    for r in d:
        w=r.get('WAR') or 0; W[(str(r['playerid']),y)]+= w*(162/60 if y==2020 else 1)
rows=json.load(open('all.json'))
def role(p):
    p=(p or '').upper().split('/')
    return 'RP' if p[0] in ('RP','CL') else 'SP' if p[0]=='SP' else 'H'
def model_v1(w, r):
    net=max(0,w-(0.2 if r=='RP' else 0.5)); return min(net,2)*12+max(net-2,0)*12*1.3
D=[]
for r in rows:
    if r['tracker_season']>2026 or r['ContractType']!='Free Agent' or not r['ContractTotal'] or not r['YearsTotal']: continue
    s=r['tracker_season']; pid=str(r['playerId'])
    ws=[W.get((pid,s-k)) for k in (1,2,3)]
    if ws[0] is None and ws[1] is None: continue
    ws=[x if x is not None else 0.0 for x in ws]
    marcel=(5*ws[0]+4*ws[1]+3*ws[2])/12
    infl=1.03**(2026-s); aav=r['ContractTotal']/r['YearsTotal']/1e6*infl
    rl=role(r['position'])
    D.append(dict(name=r['playerName'],season=s,role=rl,age=r['age'],w=marcel,wp=r['war_proj'],yrs=r['YearsTotal'],aav=aav,tot=r['ContractTotal']/1e6*infl,mv=model_v1(marcel,rl),qo=r['qo']))
print("signings with WAR history:",len(D),collections.Counter(d['role'] for d in D))
rng=np.random.default_rng(20261025)
ratio=lambda s:(sum(d['aav'] for d in s)/sum(d['mv'] for d in s)) if s and sum(d['mv'] for d in s)>0 else float('nan')
def prem(s): return ratio([d for d in s if d['role']=='RP'])/ratio([d for d in s if d['role']!='RP'])-1
def ci(f,s,B=2000):
    names=sorted(set(d['name'] for d in s)); by=collections.defaultdict(list)
    for d in s: by[d['name']].append(d)
    out=[]
    for _ in range(B):
        pick=rng.choice(len(names),len(names)); ss=[x for i in pick for x in by[names[i]]]; out.append(f(ss))
    return np.nanpercentile(out,[2.5,97.5])
res={}
for label,filt in [("A. all MLB FA deals, AAV>=$2M, 2020-26",lambda d:d['aav']>=2),
                   ("B. same, proxy WAR>=0.5",lambda d:d['aav']>=2 and d['w']>=0.5),
                   ("C. 1-year deals, AAV>=$2M",lambda d:d['aav']>=2 and d['yrs']==1),
                   ("D. multi-year deals",lambda d:d['aav']>=2 and d['yrs']>=2),
                   ("E. 2023-26 signings only",lambda d:d['aav']>=2 and d['season']>=2023)]:
    s=[d for d in D if filt(d)]; c=ci(prem,s)
    r={rl:(len([d for d in s if d['role']==rl]),ratio([d for d in s if d['role']==rl])) for rl in ('RP','SP','H')}
    res[label]=dict(n={k:v[0] for k,v in r.items()},ratio={k:round(v[1],3) for k,v in r.items()},premium=round(prem(s),3),ci=[round(x,3) for x in c])
    print(f"{label}: actual/model RP {r['RP'][1]:.2f} (n={r['RP'][0]}) SP {r['SP'][1]:.2f} (n={r['SP'][0]}) H {r['H'][1]:.2f} (n={r['H'][0]}) | reliever premium {prem(s)*100:+.0f}% [{c[0]*100:+.0f}%, {c[1]*100:+.0f}%]")
# cross-check on 2026 with FanGraphs' own projections at signing
s=[dict(d,w=d['wp'],mv=model_v1(d['wp'],d['role'])) for d in D if d['season']==2026 and d['wp'] is not None and d['aav']>=2]
print("F. 2026 signings using FanGraphs projection at signing: premium %+.0f%% (n RP=%d)"%(prem(s)*100,len([d for d in s if d['role']=='RP'])))
json.dump({'results':res,'n':len(D)},open('relprem_results.json','w'),indent=1); json.dump(D,open('signings_marcel.json','w'))
