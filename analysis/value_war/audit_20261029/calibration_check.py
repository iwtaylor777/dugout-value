"""Post-result falsification: is contact useful beyond ordinary mean regression?"""
import json
import numpy as np
import pandas as pd

from evaluate import HERE, INPUT_PRIVATE, PAIRS, SEED, load, primary_teams, rates


def panel(pairs):
    out=[]
    for t,u in pairs:
        a,b=load(t),load(u);ta,tb=primary_teams(a,'bat'),primary_teams(b,'bat')
        B=a['bat'];C=b['bat']
        actual=(C.nonbip+C.x+C.r-C.park)/C.PA
        raw=(B.nonbip+B.x+B.r-B.park)/B.PA
        contact=(B.nonbip+B.x-B.park)/B.PA
        ids=B.index.intersection(C.index)
        ids=ids[(B.PA.reindex(ids)>=200)&(C.PA.reindex(ids)>=200)]
        d=pd.DataFrame({'id':ids,'y':u,'actual':actual.reindex(ids).to_numpy(),
          'raw':raw.reindex(ids).to_numpy(),'contact':contact.reindex(ids).to_numpy(),
          'weight':C.PA.reindex(ids).to_numpy(),'mover':(ta.reindex(ids)!=tb.reindex(ids)).to_numpy()})
        out.append(d)
    return pd.concat(out,ignore_index=True)


def main(B=2000):
    dev=panel([(2016,2017),(2017,2018),(2018,2019),(2019,2021)])
    test=panel(PAIRS)
    fits={}
    for n,cols in [('outcome_calibrated',['raw']),('contact_calibrated',['raw','contact'])]:
        X=np.c_[np.ones(len(dev)),dev[cols]];w=np.sqrt(dev.weight.to_numpy())
        coef=np.linalg.lstsq(X*w[:,None],dev.actual*w,rcond=None)[0]
        test[n]=np.c_[np.ones(len(test)),test[cols]]@coef
        fits[n]=dict(columns=cols,coefficients=coef.tolist())
    test['fixed_50_50']=.5*test.raw+.5*test.contact
    models=['raw','fixed_50_50','outcome_calibrated','contact_calibrated'];out={}
    for name,sub in [('all',test),('movers',test[test.mover]),('stayers',test[~test.mover])]:
        def metrics(w):return {n:float(np.sqrt(np.average((sub[n]-sub.actual)**2,weights=w))) for n in models}
        m=metrics(sub.weight);ids=sorted(sub.id.unique());rng=np.random.default_rng(SEED)
        diffs={n:[] for n in models if n!='outcome_calibrated'}
        for _ in range(B):
            count=dict(zip(ids,np.bincount(rng.integers(0,len(ids),len(ids)),minlength=len(ids))))
            z=metrics(sub.weight*sub.id.map(count))
            for n in diffs:diffs[n].append(100*(1-z[n]/z['outcome_calibrated']))
        out[name]=dict(n=len(sub),distinct_players=len(ids),rmse=m,
          pct_better_than_calibrated_outcomes={n:100*(1-m[n]/m['outcome_calibrated']) for n in diffs},
          player_cluster_ci={n:list(np.percentile(v,[2.5,97.5])) for n,v in diffs.items()},
          yearly={str(y):{n:float(np.sqrt(np.average((s[n]-s.actual)**2,weights=s.weight))) for n in models} for y,s in sub.groupby('y')})
    result=dict(status='Post-result falsification, not an untouched confirmatory test',development_pairs=[[2016,2017],[2017,2018],[2018,2019],[2019,2021]],development_n=len(dev),fits=fits,results=out)
    (HERE/'calibration_results.json').write_text(json.dumps(result,indent=2))
    test.to_csv(INPUT_PRIVATE/'calibrated_portable_batting_rows.csv',index=False)
    print(json.dumps(result,indent=1))


if __name__=='__main__':main()
