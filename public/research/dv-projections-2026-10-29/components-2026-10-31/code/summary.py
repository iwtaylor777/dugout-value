import json, numpy as np, glob
allr=[]; per={}
z=lambda v: v or 0.0
for f in sorted(glob.glob('/home/claude/pw/comp/bt_20*.json')):
    d=json.load(open(f)); R=d['rows']; w=np.array([x['pa'] for x in R])
    rm=lambda fn: float(np.sqrt(np.average([fn(x)**2 for x in R],weights=w)))
    per[d['T']]=dict(n=len(R),direct=rm(lambda x:x['direct']-x['actual']),comp=rm(lambda x:x['comp']-x['actual']),blend=rm(lambda x:(x['comp']+x['direct'])/2-x['actual']),oracle=rm(lambda x:x['oracle']-x['actual']),
        bat=rm(lambda x:x['bat']-z(x['bat_a'])),bat_m=rm(lambda x:x['bat_m']-z(x['bat_a'])),bsr=rm(lambda x:x['bsr']-z(x['bsr_a'])),bsr_m=rm(lambda x:x['bsr_m']-z(x['bsr_a'])),
        fld=rm(lambda x:x['fld']-z(x['fld_a'])),fld_m=rm(lambda x:x['fld_m']-z(x['fld_a'])),pos=rm(lambda x:x['pos']-z(x['pos_a'])),
        bias_direct=float(np.average([x['direct']-x['actual'] for x in R],weights=w)),bias_comp=float(np.average([x['comp']-x['actual'] for x in R],weights=w)))
    allr+=R
w=np.array([x['pa'] for x in allr]); rm=lambda fn: float(np.sqrt(np.average([fn(x)**2 for x in allr],weights=w)))
pooled=dict(n=len(allr),direct=rm(lambda x:x['direct']-x['actual']),comp=rm(lambda x:x['comp']-x['actual']),blend=rm(lambda x:(x['comp']+x['direct'])/2-x['actual']),oracle=rm(lambda x:x['oracle']-x['actual']))
for T,v in per.items(): print(T,{k:round(x,3) if isinstance(x,float) else x for k,x in v.items()})
print('pooled',{k:round(x,3) if isinstance(x,float) else x for k,x in pooled.items()})
json.dump(dict(per=per,pooled=pooled),open('/home/claude/pw/comp/results.json','w'),indent=1)
