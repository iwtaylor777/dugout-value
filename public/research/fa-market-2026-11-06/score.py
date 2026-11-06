from pathlib import Path
import json,math,sys
import numpy as np
H=Path(__file__).resolve().parent
rows=json.loads((H/('private/'+sys.argv[1] if len(sys.argv)>1 else 'private/scored_with_baselines.json')).read_text())
methods={'candidate':'prediction','legacy':'referenceLegacy','role_median':'referenceMedian'}
def metric(rs):
 out={'n':len(rs),'players':len({r['pid'] for r in rs}),'methods':{}}
 for m,key in methods.items():
  out['methods'][m]={'total_log_mae':float(np.mean([abs(math.log(r[key]['total']/r['actualTotal'])) for r in rs])),'aav_log_mae':float(np.mean([abs(math.log(r[key]['aav']/r['actualAav'])) for r in rs])),'years_mae':float(np.mean([abs(r[key]['years']-r['actualYears']) for r in rs])),'total_log_bias':float(np.mean([math.log(r[key]['total']/r['actualTotal']) for r in rs]))}
 return out
out={'pooled':metric(rows),'by_year':{y:metric([r for r in rows if r['year']==y]) for y in [2023,2024,2025,2026]},'by_role':{role:metric([r for r in rows if r['role']==role]) for role in ['position','starter','reliever']},'at_least_10M':metric([r for r in rows if r['actualTotal']>=10]),'at_least_100M':metric([r for r in rows if r['actualTotal']>=100]),'leave_one_class_out':{y:metric([r for r in rows if r['year']!=y]) for y in [2023,2024,2025,2026]}}
players=sorted({r['pid'] for r in rows});rng=np.random.default_rng(20261106);index={p:i for i,p in enumerate(players)};ids=np.array([index[r['pid']] for r in rows])
out['bootstrap']={}
for ref in ['legacy','role_median']:
 err={m:np.array([abs(math.log(r[methods[m]]['total']/r['actualTotal'])) for r in rows]) for m in ['candidate',ref]};gains=[]
 for _ in range(2000):
  count=np.bincount(rng.integers(len(players),size=len(players)),minlength=len(players));w=count[ids];gains.append(100*(1-np.average(err['candidate'],weights=w)/np.average(err[ref],weights=w)))
 out['bootstrap'][ref]={'gain_percent':100*(1-err['candidate'].mean()/err[ref].mean()),'interval95':list(map(float,np.percentile(gains,[2.5,97.5])))}
out['decision']={'status':'candidate-supported' if all(out['bootstrap'][r]['gain_percent']>=5 and sum(out['by_year'][y]['methods']['candidate']['total_log_mae']<out['by_year'][y]['methods'][r]['total_log_mae'] for y in [2023,2024,2025,2026])>=3 and out['by_year'][2026]['methods']['candidate']['total_log_mae']<=out['by_year'][2026]['methods'][r]['total_log_mae'] for r in ['legacy','role_median']) else 'not-supported','interpretation':'Retrospective rolling class checks on the specified saved data; not a new untouched holdout or a full replay of historical DV v1.5 forecasts.'}
if len(sys.argv)>1:
 high=[r for r in rows if r['proxyWar']>=2 or max(r['features'][role+'_last_war'] for role in ['starter','reliever','position'])>=3]
 out['origin_high_value']=metric(high)
 out['decision']['high_value_compatible']=out['origin_high_value']['methods']['candidate']['total_log_mae']<=out['origin_high_value']['methods']['legacy']['total_log_mae']*1.05 and out['at_least_100M']['methods']['candidate']['total_log_mae']<=out['at_least_100M']['methods']['legacy']['total_log_mae']*1.05
 output=sys.argv[2]
else:output='results.json'
(H/output).write_text(json.dumps(out,indent=2)+'\n');print(json.dumps({k:out[k] for k in ['pooled','by_year','bootstrap','decision','at_least_100M']},indent=2))
