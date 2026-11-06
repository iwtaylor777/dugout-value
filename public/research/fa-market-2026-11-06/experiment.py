"""Origin-only market contract features and fixed ridge candidate."""
from pathlib import Path
import json,re,hashlib,math,copy,os
import numpy as np
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import Ridge
H=Path(__file__).resolve().parent;ROOT=Path(os.environ.get('DV_BASEBALL_ROOT',H.parents[1]));P=H/'private';P.mkdir(exist_ok=True)
RAW=ROOT/'analysis/fa_market_calibration/raw/fg_fa_tracker_2020_2027.json'
INPUT={str(RAW.relative_to(ROOT)):hashlib.sha256(RAW.read_bytes()).hexdigest()}
D={'bat':{},'pit':{}}
def num(v,default=np.nan):
 try:
  x=float(v);return x if np.isfinite(x) else default
 except (ValueError,TypeError):return default
def innings(v):
 x=num(v,0);whole=math.floor(x);outs=round((x-whole)*10)
 assert outs in [0,1,2] and abs(x-whole-outs/10)<1e-5
 return whole+outs/3
for kind in D:
 for y in range(2015,2027):
  path=ROOT/f'tmp/war/fg_{kind}_{y}.json';INPUT[str(path.relative_to(ROOT))]=hashlib.sha256(path.read_bytes()).hexdigest()
  for r in json.loads(path.read_text())['data']:
   r=copy.deepcopy(r)
   if kind=='pit':r['IP']=innings(r.get('IP'))
   pid=str(r['playerid']);history=D[kind].setdefault(pid,{})
   if y in history:
    k='PA' if kind=='bat' else 'IP'
    if num(history[y].get(k),0)>num(r.get(k),0):continue
   history[y]=r
def role_for(pid,S):
 pit=[D['pit'].get(pid,{}).get(S-l,{}) for l in [1,2,3]]
 if sum(num(r.get('IP'),0) for r in pit)>=20:
  latest=next(r for r in pit if num(r.get('IP'),0)>0)
  return 'starter' if num(latest.get('GS'),0)>=10 and num(latest.get('GS'),0)>=num(latest.get('G'),0)/2 else 'reliever'
 return 'position'
def profile(pid,S,override=None):
 role=role_for(pid,S);kind='bat' if role=='position' else 'pit';hist=D[kind].get(pid,{}) if override is None else override
 key='PA' if kind=='bat' else 'IP';unit=600 if kind=='bat' else 180
 prior=[(w,hist.get(S-l,{})) for l,w in [(1,5),(2,4),(3,3)]]
 n=sum(num(r.get(key),0) for w,r in prior)
 if n<(100 if kind=='bat' else 20):return None
 last=next((r for w,r in prior if num(r.get(key),0)>0),None)
 if last is None or not np.isfinite(num(last.get('Age'))):return None
 year=int(last.get('Season') or last.get('SeasonMin'));age=num(last['Age'])+S-year
 def total(k):return sum(w*num(r.get(k),0) for w,r in prior)/4
 den=total(key);war=total('WAR');rate=war/den*unit
 wl=[num(r.get(key),0)*(2.7 if int(r.get('Season') or r.get('SeasonMin') or 0)==2020 else 1) for w,r in prior]
 annual=[num(r.get('WAR'),0)*(2.7 if int(r.get('Season') or r.get('SeasonMin') or 0)==2020 else 1) for w,r in prior]
 healthy=min(700 if kind=='bat' else 200 if role=='starter' else 90,float(np.mean(sorted(wl,reverse=True)[:2])))
 league=[]
 for l in [1,2,3]:
  rs=[h[S-l] for h in D[kind].values() if S-l in h];lg=sum(num(r.get('WAR'),0) for r in rs)/sum(num(r.get(key),0) for r in rs)*unit;league.append(lg)
 ballast=1200 if kind=='bat' else 300;proxy_rate=(war*unit+ballast*np.mean(league))/(den+ballast);proxy_war=proxy_rate*healthy/unit
 f={'age':age,'age2':(age-30)**2,'starter':float(role=='starter'),'reliever':float(role=='reliever'),'hitter':float(kind=='bat')}
 for ro in ['starter','reliever','position']:
  f['age_'+ro]=(age-30)*float(role==ro)
  vals={'war_rate':rate,'last_war':annual[0],'weighted_war':sum(w*a for (w,r),a in zip(prior,annual))/12,'last_workload':wl[0]/unit,'healthy_workload':healthy/unit,'history':n/unit,'workload_change':(wl[0]-wl[1])/unit,'strong_years':sum(a>=2 for a in annual),'proxy_war':proxy_war}
  for k,v in vals.items():f[ro+'_'+k]=v if role==ro else 0.
 def rate_stat(k,multiple=1):
  vals=[(w*num(r.get(key),0),num(r.get(k))) for w,r in prior if num(r.get(key),0)>0 and np.isfinite(num(r.get(k)))]
  return sum(n*v for n,v in vals)/sum(n for n,v in vals)*multiple if vals else np.nan
 for k in ['Batting','Fielding','Positional','BaseRunning']:
  f['bat_'+k]=total(k)/den*600 if kind=='bat' else 0.
 for k in ['wRC+','ISO','BB%','K%']:
  f['bat_'+k]=rate_stat(k) if kind=='bat' else 0.
 for k in ['HR','RBI','SB']:
  f['bat_'+k]=sum(w*num(r.get(k),0)*(2.7 if int(r.get('Season') or r.get('SeasonMin') or 0)==2020 else 1) for w,r in prior)/12 if kind=='bat' else 0.
 for k in ['ERA','FIP','K%','BB%','FBv']:
  f['pit_'+k]=rate_stat(k) if kind=='pit' else 0.
 for k in ['G','GS','SV','HLD','W']:
  f['pit_'+k]=sum(w*num(r.get(k),0)*(2.7 if int(r.get('Season') or r.get('SeasonMin') or 0)==2020 else 1) for w,r in prior)/12 if kind=='pit' else 0.
 return dict(features=f,age=age,role=role,proxyWar=proxy_war,healthyWorkload=healthy,priorYears=[S-l for l in [1,2,3]],origin=S-1)
def contracts():
 raw=json.loads(RAW.read_text());eligible={};excluded={};counts={}
 for r in raw:
  S=r['tracker_season'];reason=None
  if not 2020<=S<=2026:reason='outside-years'
  elif r['ContractType']!='Free Agent' or r['option_type']!='GUARANTEED':reason='not-guaranteed-free-agent'
  elif not r['ContractTotal'] or not r['YearsTotal'] or r['ContractTotal']/r['YearsTotal']<2e6:reason='under-2M-AAV-or-missing'
  elif r['YearsTotal']==1 and r['ContractTotal']==r['qo']:reason='accepted-QO'
  if reason:excluded[reason]=excluded.get(reason,0)+1;continue
  key=(S,str(r['playerId']))
  if key not in eligible or r['ContractTotal']>eligible[key]['ContractTotal']:eligible[key]=r
 rows=[]
 for (S,pid),r in sorted(eligible.items()):
  pr=profile(pid,S)
  if pr is None:excluded['insufficient-history']=excluded.get('insufficient-history',0)+1;continue
  rows.append(dict(pid=pid,year=S,name=r['playerName'],actualTotal=r['ContractTotal']/1e6,actualYears=r['YearsTotal'],actualAav=r['ContractTotal']/r['YearsTotal']/1e6,**pr));counts[S]=counts.get(S,0)+1
 return rows,dict(counts=counts,excluded=excluded,retained=len(rows),deduplicated_eligible=len(eligible),inputs=INPUT)
def fit_predict(train,test):
 columns=sorted(train[0]['features']);X=np.array([[r['features'][k] for k in columns] for r in train]);B=np.array([[r['features'][k] for k in columns] for r in test])
 imputer=SimpleImputer(strategy='median',keep_empty_features=True);scaler=StandardScaler();A=scaler.fit_transform(imputer.fit_transform(X));BB=scaler.transform(imputer.transform(B));models={};pred={}
 for target in ['total','years']:
  y=np.array([math.log(r['actualTotal']*1.03**(2026-r['year'])) if target=='total' else math.log(r['actualYears']) for r in train]);m=Ridge(alpha=10).fit(A,y);models[target]=dict(coefficients=list(map(float,m.coef_)),intercept=float(m.intercept_))
  raw=m.predict(BB);pred[target]=np.exp(raw)
 out=[]
 for i,r in enumerate(test):
  years=max(1,min(12,float(pred['years'][i])));display=max(1,min(12,int(math.floor(years+.5))));total=float(pred['total'][i])*1.03**(r['year']-2026);total=max(total,display*.78)
  out.append(dict(total=total,years=display,expectedYears=years,aav=total/display))
 meta=dict(columns=columns,medians=list(map(float,imputer.statistics_)),means=list(map(float,scaler.mean_)),scales=list(map(float,scaler.scale_)),models=models,trainingYears=sorted({r['year'] for r in train}),trainingRows=len(train),baseYear=2026,inflation=3,alpha=10)
 return out,meta
if __name__=='__main__':
 rows,audit=contracts();(P/'dataset.json').write_text(json.dumps(rows));(H/'input_audit.json').write_text(json.dumps(audit,indent=2)+'\n')
 scored=[]
 for y in [2023,2024,2025,2026]:
  train=[r for r in rows if r['year']<y];test=[r for r in rows if r['year']==y];pred,meta=fit_predict(train,test)
  for r,p in zip(test,pred):scored.append(r|dict(prediction=p))
  (P/f'fit_{y}.json').write_text(json.dumps(meta));print('FIT',y,len(train),len(test),flush=True)
 (P/'scored.json').write_text(json.dumps(scored))
 # Forecast the complete current class; matching is by the site's stored numeric identity.
 W=Path(os.environ.get('DV_APP_ROOT',ROOT/'tmp/fa-market-current'));db=json.loads((W/'app/data/player-database.json').read_text());tracker=json.loads((W/'app/data/free-agent-tracker.json').read_text());byId={p['id']:p for p in db['players'] if p['kind']=='mlb'}
 test=[];missing=[]
 for p in tracker['players']:
  player=byId.get(p['id']);pid=str(player.get('fangraphsId')) if player else None;pr=profile(pid,2027) if pid else None
  if pr is None:missing.append(p['id']);continue
  test.append(dict(pid=pid,id=p['id'],name=p['name'],year=2027,**pr))
 pred,meta=fit_predict(rows,test);(H/'model.json').write_text(json.dumps(meta,indent=2)+'\n');(P/'current_features.json').write_text(json.dumps(test));(P/'current_predictions.json').write_text(json.dumps([r|dict(prediction=p) for r,p in zip(test,pred)]))
 print('CURRENT',len(test),'MISSING',missing,flush=True)
 for r,p in zip(test,pred):
  if r['name'] in ['Seiya Suzuki','Trevor Rogers','Tarik Skubal','Adrian Morejon']:print(r['name'],p,flush=True)
