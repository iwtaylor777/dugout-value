import json, numpy as np, collections
R='../proj/raw/'
D={}
for y in range(2015,2027):
    for r in json.load(open(f'{R}fg_bat_{y}.json'))['data']:
        pos=(r.get('position') or r.get('Pos') or '')
        D.setdefault(str(r['playerid']),{})[y]=dict(pa=r.get('PA') or 0,bat=r.get('Batting') or 0,bsr=r.get('BaseRunning') or 0,fld=r.get('Fielding') or 0,pos=r.get('Positional') or 0,war=r.get('WAR') or 0,age=r.get('Age'),p=str(pos))
def is_c(h,y): return h[y]['p'].startswith('C') and not h[y]['p'].startswith('CF')
def per600(s,k): return s[k]/s['pa']*600
comps=['bat','bsr','fld','pos']
print('A) year-to-year correlation of per-600 runs (>=400 PA both years, non-catchers, excl. 2020)')
pairs=collections.defaultdict(list)
for pid,h in D.items():
    for y in range(2015,2026):
        if y in h and y+1 in h and 2020 not in (y,y+1) and h[y]['pa']>=400 and h[y+1]['pa']>=400 and not is_c(h,y):
            for k in comps: pairs[k].append((per600(h[y],k),per600(h[y+1],k)))
for k in comps:
    a=np.array(pairs[k]); print(f'  {k:4s} n={len(a)} r={np.corrcoef(a[:,0],a[:,1])[0,1]:.3f} sd={a[:,0].std():.2f} runs/600')
# B) persistence: next-1-3-year per-600 component on 3yr weighted component (5/4/3 by PA), plus aging
print('B) persistence: slope of future (t+1..t+3, PA-weighted) per-600 on past 3-yr weighted per-600; non-catchers')
rows=[]
for pid,h in D.items():
    for t in range(2017,2024):
        if t==2020 or t not in h or h[t]['pa']<300 or is_c(h,t): continue
        past={k:0 for k in comps}; ppa=0
        for i,w in enumerate((5,4,3)):
            s=h.get(t-i)
            if not s or (t-i)==2020: continue
            for k in comps: past[k]+=w*s[k]
            ppa+=w*s['pa']
        fut={k:0 for k in comps+['war']}; fpa=0
        for y in (t+1,t+2,t+3):
            s=h.get(y)
            if not s or y==2020 or y>2026: continue
            for k in comps+['war']: fut[k]+=s[k]
            fpa+=s['pa']
        rows.append(dict(pid=pid,t=t,age=h[t]['age'],ppa=ppa/12,past={k:past[k]/ppa*600 for k in comps},fpa=fpa,fut=fut,pwar=sum(w*(h.get(t-i,{}).get('war',0)) for i,w in enumerate((5,4,3)))/12))
json.dump(rows,open('rows.json','w'))
R2=[r for r in rows if r['fpa']>=300]
for k in comps:
    x=np.array([r['past'][k] for r in R2]); y=np.array([r['fut'][k]/r['fpa']*600 for r in R2]); w=np.array([r['fpa'] for r in R2])
    X=np.c_[x,np.ones(len(x))]; b=np.linalg.lstsq(X*np.sqrt(w)[:,None],y*np.sqrt(w),rcond=None)[0]
    print(f'  {k:4s} n={len(x)} persistence slope={b[0]:.3f}')
# C) aging deltas per 600 by age bucket (component change year to year, >=300 PA both years)
print('C) average year-to-year change in runs per 600, by age (non-catchers, >=300 PA both years)')
ag=collections.defaultdict(lambda: collections.defaultdict(list))
for pid,h in D.items():
    for y in range(2015,2026):
        if y in h and y+1 in h and 2020 not in (y,y+1) and h[y]['pa']>=300 and h[y+1]['pa']>=300 and not is_c(h,y):
            a=h[y]['age']; b=min(max(a,24),35)//2*2 if a else None
            if a is None: continue
            bucket=('<=26' if a<=26 else '27-29' if a<=29 else '30-32' if a<=32 else '33+')
            for k in ('bat','fld','bsr'): ag[bucket][k].append(per600(h[y+1],k)-per600(h[y],k))
for b in ('<=26','27-29','30-32','33+'):
    print('  ',b,{k:round(float(np.mean(v)),2) for k,v in ag[b].items()}, 'n',len(ag[b]['bat']))
