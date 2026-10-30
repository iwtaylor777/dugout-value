"""Post-result agreement checks and examples; published fielding is a proxy."""
import json
import re

import numpy as np

from evaluate import HERE, fg, load


def main():
    out=[]
    for y in [2016,2017,2018,2019,2021,2022,2023,2024,2025,2026]:
        c=load(y);b=fg.fg('bat',y);f=c['fld'];ids=b.index.intersection(f.index)
        s=b.reindex(ids);f=f.reindex(ids)
        catcher=s.position.fillna('').astype(str).str.split('/').str[0].eq('C')
        ids=ids[(s.PA>=200)&(f.outs>=600)&(~catcher)]
        s=s.loc[ids];f=f.loc[ids]
        actual=(s.Fielding.fillna(0)-s.CFraming.fillna(0)).to_numpy()
        old=f.r.to_numpy();new=f.soft.to_numpy()
        out.append(dict(year=y,n=len(ids),old_correlation=float(np.corrcoef(old,actual)[0,1]),
            new_correlation=float(np.corrcoef(new,actual)[0,1]),
            old_rmse=float(np.sqrt(np.mean((old-actual)**2))),new_rmse=float(np.sqrt(np.mean((new-actual)**2))),
            actual_sd=float(np.std(actual)),old_sd=float(np.std(old)),new_sd=float(np.std(new))))
    (HERE/'fielding_agreement.json').write_text(json.dumps({'status':'Post-result descriptive agreement check; published fielding is a proxy, not individual ground truth','results':out},indent=2))
    b=fg.fg('bat',2026);c=load(2026);rpw=b.RAR.sum()/b.WAR.sum()
    delta=-.5*c['bat'].r;delta=delta-c['bat'].PA*(delta.sum()/c['bat'].PA.sum())
    fielding=b.Fielding.fillna(0)-b.CFraming.fillna(0);rows=[]
    for mid in [678882,665742,677951,691718]:
        r=b.loc[mid];bat=float(delta.get(mid,0)/rpw);fld=-.5*float(fielding.loc[mid])/rpw
        rows.append(dict(id=mid,name=r.get('PlayerName') or re.sub('<[^>]+>','',r.Name),
            pa=float(r.PA),fwar=float(r.WAR),batting_adjustment=bat,fielding_haircut=fld,
            contact_only=float(r.WAR)+bat,both=float(r.WAR)+bat+fld))
    (HERE/'player_examples.json').write_text(json.dumps(rows,indent=2))
    print('Descriptive checks saved')


if __name__=='__main__':main()
