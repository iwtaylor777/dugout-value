import json, numpy as np
rows=json.load(open('all.json'))
def role(p):
    p=(p or '').upper().split('/')
    if p[0] in ('RP','CL'): return 'RP'
    if p[0]=='SP': return 'SP'
    return 'H'
def model_v1(w, r):
    burden = 0.2 if r=='RP' else 0.5
    net=max(0,w-burden); return min(net,2)*12 + max(net-2,0)*12*1.3
D=[]
for r in rows:
    if r['tracker_season']>2026 or r['ContractType']!='Free Agent': continue
    tot,yrs,w=r['ContractTotal'],r['YearsTotal'],r['war_proj']
    if not tot or not yrs or w is None: continue
    aav=tot/yrs/1e6; infl=1.03**(2026-r['tracker_season'])
    D.append(dict(name=r['playerName'],season=r['tracker_season'],role=role(r['position']),age=r['age'],w=w,yrs=yrs,aav=aav*infl,tot=tot/1e6*infl,qo=r['qo'],mv=model_v1(w,role(r['position'])),med_aav=(r['med_aav'] or 0)/1e6*infl,med_years=r['med_years']))
import collections
print("n signings:",len(D), collections.Counter(d['role'] for d in D))
def ratio(sub): 
    a=sum(d['aav'] for d in sub); m=sum(d['mv'] for d in sub); return a/m if m else float('nan')
rng=np.random.default_rng(20261025)
def boot(f, sub, B=2000):
    idx=np.arange(len(sub)); out=[f([sub[i] for i in rng.choice(idx,len(idx))]) for _ in range(B)]; return np.percentile(out,[2.5,97.5])
for label,filt in [("all deals, AAV >= $2M", lambda d: d['aav']>=2), ("1-year deals, AAV >= $2M", lambda d: d['aav']>=2 and d['yrs']==1), ("multi-year deals", lambda d: d['yrs']>=2), ("proj WAR >= 0.5", lambda d: d['aav']>=2 and d['w']>=0.5)]:
    sub=[d for d in D if filt(d)]
    out={}
    for rl in ('RP','SP','H'):
        s=[d for d in sub if d['role']==rl]; out[rl]=(len(s),ratio(s))
    rp=[d for d in sub if d['role']=='RP']; oth=[d for d in sub if d['role']!='RP']
    prem=lambda: None
    def premf(s):
        r1=[d for d in s if d['role']=='RP']; r2=[d for d in s if d['role']!='RP']; return ratio(r1)/ratio(r2)-1
    ci=boot(premf, sub)
    print(f"{label}: actual/model  RP {out['RP'][1]:.2f} (n={out['RP'][0]})  SP {out['SP'][1]:.2f} (n={out['SP'][0]})  H {out['H'][1]:.2f} (n={out['H'][0]})  -> reliever premium {premf(sub)*100:+.0f}% [{ci[0]*100:+.0f}%, {ci[1]*100:+.0f}%]")
# $ per projected WAR (simple, no burden), by role
for rl in ('RP','SP','H'):
    s=[d for d in D if d['role']==rl and d['aav']>=2 and d['w']>=0.3]
    print(rl, "median AAV per proj WAR: $%.1fM"%np.median([d['aav']/d['w'] for d in s]), "n",len(s))
json.dump(D,open('signings.json','w'))
