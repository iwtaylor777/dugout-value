import numpy as np
from data import seasons, bench, league
from score import established, actual, bench_value
def bias(kind,T,preds,metric):
    D=seasons(kind); B={s:bench(T,s,kind) for s in ('zips','steamer')}
    rows=[]
    for pid,p in preds.items():
        h=D.get(pid)
        if not h or T not in h or (h[T]['PA'] or 0)<200 or not established(h,T,'PA',100): continue
        if not all(B[s] and pid in B[s] for s in B): continue
        a=actual(kind,h[T],metric); rows.append((h[T]['PA'],a,p,bench_value(kind,B['zips'][pid],metric),bench_value(kind,B['steamer'][pid],metric)))
    R=np.array(rows,float); w=R[:,0]
    for j,n in ((2,'dv'),(3,'zips'),(4,'steamer')):
        e=R[:,j]-R[:,1]; print(T,n,'bias %.4f  rmse %.4f  debiased rmse %.4f'%(np.average(e,weights=w),np.sqrt(np.average(e**2,weights=w)),np.sqrt(np.average((e-np.average(e,weights=w))**2,weights=w))))
def bias_generic(kind,T,preds,metric,minT=40,key='IP',minw=20):
    D=seasons(kind); B={s:bench(T,s,kind) for s in ('zips','steamer')}; B={s:b for s,b in B.items() if b}
    rows=[]
    for pid,p in preds.items():
        h=D.get(pid)
        if not h or T not in h or (h[T].get(key) or 0)<minT or not established(h,T,key,minw): continue
        if not all(pid in B[s] for s in B): continue
        vals=[bench_value(kind,B[s][pid],metric) for s in B]
        if any(v is None for v in vals): continue
        rows.append([h[T][key],actual(kind,h[T],metric),p]+vals)
    R=np.array(rows,float); w=R[:,0]
    for j,n in enumerate(['dv']+list(B)):
        e=R[:,2+j]-R[:,1]; mu=np.average(e,weights=w)
        print(T,metric,n,'bias %.3f rmse %.4f debiased %.4f'%(mu,np.sqrt(np.average(e**2,weights=w)),np.sqrt(np.average((e-mu)**2,weights=w))))
