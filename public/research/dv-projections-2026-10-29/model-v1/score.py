"""Scoring per PROTOCOL-PROJECTIONS.md."""
import numpy as np
from data import seasons, bench
def established(h,T,key,minw):
    return sum((h.get(y,{}).get(key) or 0) for y in (T-1,T-2,T-3))>=minw
def score(kind,T,preds,metric,systems=('zips','steamer'),boot=2000,seed=20261027):
    """preds: {pid: value}. Returns dict of RMSE per system (ours='dv') on the common set and paired bootstrap CIs."""
    D=seasons(kind); key,minw,minT,wkey=(('PA',100,200,'PA') if kind=='bat' else ('IP',20,40,'IP'))
    B={s:bench(T,s,kind) for s in systems}; B={s:b for s,b in B.items() if b}
    rows=[]
    for pid,p in preds.items():
        h=D.get(pid)
        if not h or T not in h or (h[T].get(wkey) or 0)<minT or not established(h,T,key,minw): continue
        act=actual(kind,h[T],metric)
        if act is None: continue
        bv={}
        for s,b in B.items():
            r=b.get(pid)
            if r is None: break
            v=bench_value(kind,r,metric)
            if v is None: break
            bv[s]=v
        else:
            rows.append((pid,h[T][wkey],act,p,bv))
    if not rows: return None
    w=np.array([r[1] for r in rows],float); a=np.array([r[2] for r in rows]); P={'dv':np.array([r[3] for r in rows])}
    for s in B: P[s]=np.array([r[4][s] for r in rows])
    rmse=lambda x,i=slice(None): float(np.sqrt(np.sum(w[i]*(x[i]-a[i])**2)/np.sum(w[i])))
    out={'n':len(rows),'rmse':{s:rmse(x) for s,x in P.items()}}
    rng=np.random.default_rng(seed); diffs={s:[] for s in B}
    for _ in range(boot):
        i=rng.integers(0,len(rows),len(rows))
        for s in B: diffs[s].append(rmse(P['dv'],i)-rmse(P[s],i))
    out['diff_ci']={s:[float(np.percentile(d,2.5)),float(np.percentile(d,97.5))] for s,d in diffs.items()}
    return out
def actual(kind,r,metric):
    if kind=='bat':
        pa=r['PA'] or 0
        return {'wOBA':r['wOBA'],'K':(r['SO'] or 0)/pa,'BB':(r['BB'] or 0)/pa,'ISO':r['ISO'],'WAR600':(r['WAR'] or 0)/pa*600}[metric]
    ip=r['IP'] or 0; tbf=r['TBF'] or 0
    return {'FIP':r['FIP'],'ERA':r['ERA'],'K':(r['SO'] or 0)/tbf,'BB':(r['BB'] or 0)/tbf,'WAR180':(r['WAR'] or 0)/ip*180}[metric]
def bench_value(kind,r,metric):
    try:
        if kind=='bat':
            pa=r['PA']
            if not pa: return None
            return {'wOBA':r['wOBA'],'K':r['SO']/pa,'BB':r['BB']/pa,'ISO':r['ISO'],'WAR600':r['WAR']/pa*600}[metric]
        ip=r['IP']; tbf=r.get('TBF')
        if not ip: return None
        if metric in ('K','BB') and not tbf: tbf=ip*4.3
        return {'FIP':r['FIP'],'ERA':r['ERA'],'K':r['SO']/tbf,'BB':r['BB']/tbf,'WAR180':r['WAR']/ip*180}[metric]
    except (KeyError,TypeError): return None
