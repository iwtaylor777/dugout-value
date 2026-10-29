"""Score a model version on given seasons: per-season and pooled, every metric, plus the protocol's win rule."""
import json, sys, warnings; warnings.filterwarnings('ignore')
from dvp import project
from pooled import rows_for, pooled
tag=sys.argv[1]; Ts=[int(x) for x in sys.argv[2].split(',')]
MET={'bat':('wOBA','K','BB','ISO','WAR600'),'pit':('FIP','ERA','K','BB','WAR180')}
res={}
for kind in ('bat','pit'):
    preds={T:project(kind,T) for T in Ts}
    for m in MET[kind]:
        allrows=[]; syss=None
        for T in Ts:
            rows,sy=rows_for(kind,T,preds[T][m],m); allrows+=rows
            res[f'{kind} {m} {T}']=pooled(rows,sy,boot=1000)
            syss=sy if syss is None else [s for s in syss if s in sy]
        # pooled over seasons where every system exists for every season
        common=[r for r in allrows if all(s in r[5] for s in ('zips','steamer'))]
        res[f'{kind} {m} pooled']=pooled(common,['zips','steamer'])
for k,v in res.items(): print(k,'n',v['n'],{s:round(x,4) for s,x in v['rmse'].items()},{s:[round(a,4),round(b,4)] for s,(a,b) in v['diff_ci'].items()})
# protocol win rule
win={}
for kind,m,tol in (('bat','wOBA',0.002),('pit','FIP',0.05)):
    pr=res[f'{kind} {m} pooled']['rmse']; ok=pr['dv']<pr['zips'] and pr['dv']<pr['steamer']
    for T in Ts:
        r=res[f'{kind} {m} {T}']['rmse']
        for s in ('zips','steamer'):
            if s in r and r['dv']>r[s]+tol: ok=False
    win[kind]=ok
print('WIN RULE',win)
json.dump({'tag':tag,'seasons':Ts,'results':res,'win':win},open(f'../eval_{tag}.json','w'),indent=1)
