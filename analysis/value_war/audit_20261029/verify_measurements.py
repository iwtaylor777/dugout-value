"""Check saved key metrics with separate statistics implementations."""
import hashlib
import json

import numpy as np
import pandas as pd
from scipy.stats import pearsonr
from sklearn.linear_model import LinearRegression

from runtime import HERE, INPUT, reference


def main():
    result=json.loads((HERE/'results.json').read_text())
    official=pd.read_csv(reference('official_standings_2016_2026.csv'))
    official['team']=official.team.replace({'ATH':'OAK'})
    checked=0;max_delta=0.
    for task in ['transfer','churn']:
        for name in ['fwar','batting_only','fielding_only','both']:
            d=pd.read_csv(INPUT/'evaluation'/f'published_{task}_{name}.csv')
            assert len(d)==150 and not d[['y','team']].duplicated().any()
            for _,row in d.iterrows():
                def actual(y):
                    t=official.loc[official.y==y].copy();v=(t.RS-t.RA)/(t.W+t.L)
                    return float(v.loc[t.team==row.team].iloc[0]-v.mean())
                a=actual(row.y)-(actual(row.y-1) if task=='churn' else 0)
                assert abs(a-row.a_rd)<1e-12
            errors=[]
            for year in sorted(d.y.unique()):
                tr=d.y!=year
                model=LinearRegression().fit(d.loc[tr,['pred_rd']],d.loc[tr,'a_rd'])
                errors.extend(model.predict(d.loc[~tr,['pred_rd']])-d.loc[~tr,'a_rd'])
            rmse=float(np.sqrt(np.mean(np.square(errors))))
            correlation=float(pearsonr(d.pred_rd,d.a_rd).statistic)
            expected=result['published_'+task][name]['pred_rd']
            delta=max(abs(rmse-expected['loso_rmse']),abs(correlation-expected['corr']))
            assert delta<1e-11,(name,task,delta)
            max_delta=max(max_delta,delta);checked+=1
    lock=json.loads((HERE/'candidate_2026_lock.json').read_text())
    for info in lock['private_files'].values():
        p=INPUT/'evaluation'/info['file']
        assert hashlib.sha256(p.read_bytes()).hexdigest()==info['sha256']
        assert len(pd.read_csv(p))==info['rows']
    out=dict(published_comparisons_independently_checked=checked,
        maximum_metric_difference=max_delta,official_targets_checked=checked*150,
        private_candidate_hashes_verified=True)
    (HERE/'verification.json').write_text(json.dumps(out,indent=2)+'\n')
    print(json.dumps(out))


if __name__=='__main__':main()
