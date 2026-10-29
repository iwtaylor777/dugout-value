"""Pooled holdout scoring over several seasons (paired bootstrap over player-seasons)."""
import numpy as np
from data import seasons, bench
from score import established, actual, bench_value
def rows_for(kind,T,preds,metric,systems=('zips','steamer')):
    D=seasons(kind); key,minw,minT=(('PA',100,200) if kind=='bat' else ('IP',20,40))
    B={s:bench(T,s,kind) for s in systems}; B={s:b for s,b in B.items() if b}
    out=[]
    for pid,p in preds.items():
        h=D.get(pid)
        if not h or T not in h or (h[T].get(key) or 0)<minT or not established(h,T,key,minw): continue
        a=actual(kind,h[T],metric)
        if a is None: continue
        bv={}
        for s,b in B.items():
            r=b.get(pid); v=bench_value(kind,r,metric) if r else None
            if v is None: break
            bv[s]=v
        else: out.append((T,pid,h[T][key],a,p,bv))
    return out,list(B)
def pooled(rows,systems,boot=2000,seed=20261027):
    w=np.array([r[2] for r in rows],float); a=np.array([r[3] for r in rows]); P={'dv':np.array([r[4] for r in rows])}
    for s in systems: P[s]=np.array([r[5][s] for r in rows])
    rm=lambda x,i=slice(None): float(np.sqrt(np.sum(w[i]*(x[i]-a[i])**2)/np.sum(w[i])))
    res={'n':len(rows),'rmse':{s:rm(x) for s,x in P.items()}}
    rng=np.random.default_rng(seed); d={s:[] for s in systems}
    for _ in range(boot):
        i=rng.integers(0,len(rows),len(rows))
        for s in systems: d[s].append(rm(P['dv'],i)-rm(P[s],i))
    res['diff_ci']={s:[float(np.percentile(v,2.5)),float(np.percentile(v,97.5))] for s,v in d.items()}
    return res
