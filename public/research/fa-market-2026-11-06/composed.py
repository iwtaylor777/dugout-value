"""Fixed post-result salary/duration candidates; original outputs preserved."""
import json,math,copy
import numpy as np
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import Ridge
import experiment as e
def features(r,variant):
 f=copy.deepcopy(r['features'])
 if variant=='age_value':
  for role in ['starter','reliever','position']:f[role+'_age_value']=(30-r['age'])*f[role+'_war_rate']
 return f
def fit(train,test,variant):
 columns=sorted(features(train[0],variant))
 X=np.array([[features(r,variant)[k] for k in columns] for r in train]);B=np.array([[features(r,variant)[k] for k in columns] for r in test])
 im=SimpleImputer(strategy='median',keep_empty_features=True);sc=StandardScaler();A=sc.fit_transform(im.fit_transform(X));BB=sc.transform(im.transform(B));models={};pred={}
 for target in ['aav','years']:
  y=np.array([math.log(r['actualAav']*1.03**(2026-r['year'])) if target=='aav' else r['actualYears'] for r in train]);m=Ridge(alpha=10).fit(A,y)
  models[target]=dict(coefficients=list(map(float,m.coef_)),intercept=float(m.intercept_));pred[target]=m.predict(BB)
 out=[]
 for i,r in enumerate(test):
  duration=float(np.clip(pred['years'][i],1,12));years=int(math.floor(duration+.5));aav=math.exp(pred['aav'][i])*1.03**(r['year']-2026);total=max(.78*years,aav*duration)
  out.append(dict(total=total,years=years,durationYears=duration,aav=total/years))
 return out,dict(columns=columns,medians=list(map(float,im.statistics_)),means=list(map(float,sc.mean_)),scales=list(map(float,sc.scale_)),models=models,trainingYears=sorted({r['year'] for r in train}),trainingRows=len(train),baseYear=2026,inflation=3,alpha=10,variant=variant)
if __name__=='__main__':
 rows=json.loads((e.P/'dataset.json').read_text());current=json.loads((e.P/'current_features.json').read_text());references=json.loads((e.P/'scored_with_baselines.json').read_text());refs={(r['pid'],r['year']):r for r in references}
 for variant in ['composed','age_value']:
  scored=[]
  for year in [2023,2024,2025,2026]:
   train=[r for r in rows if r['year']<year];test=[r for r in rows if r['year']==year];pred,meta=fit(train,test,variant)
   (e.P/f'{variant}_fit_{year}.json').write_text(json.dumps(meta))
   for r,p in zip(test,pred):scored.append(refs[(r['pid'],r['year'])]|dict(prediction=p))
  (e.P/f'{variant}_scored.json').write_text(json.dumps(scored));pred,meta=fit(rows,current,variant)
  (e.H/f'{variant}_model.json').write_text(json.dumps(meta,indent=2)+'\n');(e.P/f'{variant}_current.json').write_text(json.dumps([r|dict(prediction=p) for r,p in zip(current,pred)]));print('FIT',variant,flush=True)
