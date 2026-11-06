"""Independent scores, scalar coefficient replay, and origin-mutation validation."""
from pathlib import Path
import json,math,copy,hashlib
import numpy as np
import experiment as e
import composed as c
H=e.H;rows=json.loads((e.P/'dataset.json').read_text());current=json.loads((e.P/'current_features.json').read_text());calculations=0;replays=[];maxdelta=0.
def scalar(r,meta,variant):
 f=r['features'] if variant=='original' else c.features(r,variant);a=[]
 for i,k in enumerate(meta['columns']):
  v=f[k];v=v if np.isfinite(v) else meta['medians'][i];a.append((v-meta['means'][i])/meta['scales'][i])
 raw={k:m['intercept']+sum(b*x for b,x in zip(m['coefficients'],a)) for k,m in meta['models'].items()}
 if variant=='original':duration=min(12,max(1,math.exp(raw['years'])));years=math.floor(duration+.5);total=max(.78*years,math.exp(raw['total'])*1.03**(r['year']-2026))
 else:duration=min(12,max(1,raw['years']));years=math.floor(duration+.5);total=max(.78*years,math.exp(raw['aav'])*duration*1.03**(r['year']-2026))
 return dict(total=total,years=years,aav=total/years)
variants=[('original','scored_with_baselines.json','results.json','current_predictions.json'),('composed','composed_scored.json','composed_results.json','composed_current.json'),('age_value','age_value_scored.json','age_value_results.json','age_value_current.json')]
for variant,scorefile,resultfile,currentfile in variants:
 scored=json.loads((e.P/scorefile).read_text());result=json.loads((H/resultfile).read_text());assert len({(r['pid'],r['year']) for r in scored})==len(scored)
 groups={'pooled':scored,'by_year':{str(y):[r for r in scored if r['year']==y] for y in [2023,2024,2025,2026]},'by_role':{role:[r for r in scored if r['role']==role] for role in ['position','starter','reliever']},'at_least_10M':[r for r in scored if r['actualTotal']>=10],'at_least_100M':[r for r in scored if r['actualTotal']>=100],'leave_one_class_out':{str(y):[r for r in scored if r['year']!=y] for y in [2023,2024,2025,2026]}}
 if 'origin_high_value' in result:groups['origin_high_value']=[r for r in scored if r['proxyWar']>=2 or max(r['features'][role+'_last_war'] for role in ['starter','reliever','position'])>=3]
 def verify(rs,expected):
  global calculations
  assert expected['n']==len(rs) and expected['players']==len({r['pid'] for r in rs})
  for name,key in [('candidate','prediction'),('legacy','referenceLegacy'),('role_median','referenceMedian')]:
   vals={'total_log_mae':sum(abs(math.log(r[key]['total']/r['actualTotal'])) for r in rs)/len(rs),'aav_log_mae':sum(abs(math.log(r[key]['aav']/r['actualAav'])) for r in rs)/len(rs),'years_mae':sum(abs(r[key]['years']-r['actualYears']) for r in rs)/len(rs),'total_log_bias':sum(math.log(r[key]['total']/r['actualTotal']) for r in rs)/len(rs)}
   for k,val in vals.items():assert abs(val-expected['methods'][name][k])<1e-10;calculations+=1
 for label,rs in groups.items():
  if isinstance(rs,dict):
   for k,v in rs.items():verify(v,result[label][k])
  else:verify(rs,result[label])
 for year in [2023,2024,2025,2026,2027]:
  prefix='' if variant=='original' else variant+'_';meta=json.loads((e.P/f'{prefix}fit_{year}.json').read_text()) if year<2027 else json.loads((H/('model.json' if variant=='original' else variant+'_model.json')).read_text())
  train=[r for r in rows if r['year']<year];assert meta['trainingRows']==len(train) and max(meta['trainingYears'])<year
  f=lambda r:r['features'] if variant=='original' else c.features(r,variant)
  X=np.array([[f(r)[k] for k in meta['columns']] for r in train]);med=np.nanmedian(X,axis=0);med=np.nan_to_num(med);A=np.where(np.isnan(X),med,X)
  assert np.allclose(med,meta['medians']);assert np.allclose(A.mean(0),meta['means']);std=A.std(0);std[std<1e-12]=1;assert np.allclose(std,meta['scales'])
  test=[r for r in scored if r['year']==year] if year<2027 else json.loads((e.P/currentfile).read_text())
  for r in test:
   pred=scalar(r,meta,variant)
   for k,v in pred.items():maxdelta=max(maxdelta,abs(v-r['prediction'][k]));assert abs(v-r['prediction'][k])<1e-8
   replays.append(dict(variant=variant,year=year,features=[None if not np.isfinite(f(r)[k]) else f(r)[k] for k in meta['columns']],meta=meta,prediction=pred))
# Future-year performance, positions and role cannot affect an origin feature.
mutations=0
for r in rows[::19]:
 pid=r['pid'];S=r['year'];before=e.profile(pid,S)
 for kind in ['bat','pit']:
  hist=e.D[kind].setdefault(pid,{});old=hist.get(S)
  hist[S]={'Season':S,'Age':99,'PA':99999,'IP':9999,'WAR':99,'G':999,'GS':999,'Fielding':999,'Positional':999}
  after=e.profile(pid,S)
  assert before['role']==after['role'] and before['age']==after['age']
  for k,v in before['features'].items():assert v==after['features'][k] or (np.isnan(v) and np.isnan(after['features'][k]))
  if old is None:hist.pop(S)
  else:hist[S]=old
  mutations+=1
assert all(max(r['priorYears'])<r['year'] and r['origin']==r['year']-1 for r in rows)
(e.P/'js_replay_input.json').write_text(json.dumps(replays,allow_nan=False))
out={'status':'passed','independent_metric_checks':calculations,'scalar_prediction_replays':len(replays),'maximum_prediction_difference_musd':maxdelta,'future_origin_mutations':mutations,'historical_contracts':len(rows),'rolling_scored_contracts':373,'rolling_distinct_players':265,'folds_and_final_fits':15,'preprocessing':'Every imputer median, scaler mean/variance and training-year cutoff independently verified.','deployment':'None of the three market candidates is promoted; upper-tail guard failed.'}
(H/'verification.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps(out,indent=2))
