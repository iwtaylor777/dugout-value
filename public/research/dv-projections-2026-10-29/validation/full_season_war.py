"""Independent primary-score replay and an all-player season-WAR endpoint.
DV_RAW_DIR/DV_MILB_DIR/DV_ARCHIVE_DIR point to private inputs. --output stays private.
"""
import argparse,hashlib,json,sys
from pathlib import Path
import numpy as np
PACKAGE=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(PACKAGE/'site'))
import runtime
runtime.configure(normalize_ip=False)
import data,dvp
from threadpoolctl import threadpool_limits
threadpool_limits(limits=2);dvp.P['n_jobs']=2
parser=argparse.ArgumentParser();parser.add_argument('--output',type=Path,required=True);args=parser.parse_args();args.output.mkdir(parents=True,exist_ok=True)
codehash=hashlib.sha256(Path(__file__).read_bytes()+(PACKAGE/'site/runtime.py').read_bytes()+(PACKAGE/'site/dvp_site.py').read_bytes()).hexdigest()

def cache(name,fn):
    p=args.output/(name+'.json')
    if p.exists():
        d=json.loads(p.read_text())
        if d['codehash']==codehash:return d['predictions']
    r=fn();p.write_text(json.dumps(dict(codehash=codehash,predictions=r)));print('FIT',name,flush=True);return r

def true_ip(v):return runtime.innings_to_decimal(v)
def eligible(hist,year,kind):
    key='PA' if kind=='bat' else 'IP'
    return sum(float((hist.get(y) or {}).get(key) or 0) for y in (year-1,year-2,year-3)) >= (100 if kind=='bat' else 20)

def score(rows,methods,B=2000):
    w=np.array([r['w'] for r in rows]);a=np.array([r['actual'] for r in rows]);P={m:np.array([r[m] for r in rows]) for m in methods}
    out=dict(n=len(rows),players=len({r['pid'] for r in rows}),scores={})
    ids=sorted({r['pid'] for r in rows});idx={pid:i for i,pid in enumerate(ids)};ix=np.array([idx[r['pid']] for r in rows]);cw=np.bincount(ix,weights=w,minlength=len(ids));draws=np.random.default_rng(20261029).integers(0,len(ids),(B,len(ids)));den=cw[draws].sum(axis=1);rm={}
    for m,p in P.items():
        se=np.bincount(ix,weights=w*(p-a)**2,minlength=len(ids));rm[m]=np.sqrt(se[draws].sum(axis=1)/den)
        out['scores'][m]=dict(rmse=float(np.sqrt(np.average((p-a)**2,weights=w))),mae=float(np.average(abs(p-a),weights=w)),bias=float(np.average(p-a,weights=w)))
    for m in methods:
        if m in ('zips','steamer'):continue
        out['scores'][m]['comparisons']={s:dict(rmse_diff_ci=np.percentile(rm[m]-rm[s],[2.5,97.5]).tolist(),percent_error_reduction=100*(1-out['scores'][m]['rmse']/out['scores'][s]['rmse']),percent_error_reduction_ci=np.percentile(100*(1-rm[m]/rm[s]),[2.5,97.5]).tolist()) for s in ('zips','steamer')}
    return out

# Phase 1 independently reproduces the original locked recipe and legacy weights.
legacy={};primary={};audit={}
expected=json.loads((PACKAGE/'eval_holdout-v1.json').read_text())['results']
for kind,metric,key,minimum in [('bat','wOBA','PA',200),('pit','FIP','IP',40)]:
    D=data.seasons(kind);pooled=[]
    for year in (2025,2026):
        pred=cache(f'legacy_{kind}_{year}',lambda:dvp.project(kind,year));legacy[kind,year]=pred
        Z=data.bench(year,'zips',kind);S=data.bench(year,'steamer',kind);rows=[]
        for pid,value in pred[metric].items():
            hist=D.get(pid,{});r=hist.get(year)
            if not r or float(r.get(key) or 0)<minimum or not eligible(hist,year,kind) or pid not in Z or pid not in S:continue
            if any(x is None for x in (r.get(metric),Z[pid].get(metric),S[pid].get(metric))):continue
            rows.append(dict(pid=pid,year=year,w=float(r[key]),actual=float(r[metric]),dv=value,zips=float(Z[pid][metric]),steamer=float(S[pid][metric])))
        result=score(rows,['dv','zips','steamer']);pooled+=rows;primary[f'{kind}_{year}']=result
        old=expected[f'{kind} {metric} {year}'];deltas={m:result['scores'][m]['rmse']-old['rmse'][m] for m in ('dv','zips','steamer')}
        audit[f'{kind}_{year}']=dict(n_matches=result['n']==old['n'],old_n=old['n'],new_n=result['n'],rmse_deltas=deltas)
        print('PRIMARY',kind,year,json.dumps(audit[f'{kind}_{year}']),flush=True)
    result=score(pooled,['dv','zips','steamer']);primary[f'{kind}_pooled']=result
    old=expected[f'{kind} {metric} pooled'];audit[f'{kind}_pooled']=dict(n_matches=result['n']==old['n'],old_n=old['n'],new_n=result['n'],rmse_deltas={m:result['scores'][m]['rmse']-old['rmse'][m] for m in ('dv','zips','steamer')})

(args.output/'independent_primary_replay.json').write_text(json.dumps(dict(audit=audit,results=primary),indent=2)+'\n')
# Phase 2 normalizes actual historical innings at the input boundary.
import dvp_site
current_primary={};season_results={};workload_maps={}
for kind,key,unit in [('bat','PA',600),('pit','IP',180)]:
    D=data.seasons(kind);pooled=[];rate_rows=[]
    for year in (2025,2026):
        pred=cache(f'current_{kind}_{year}',lambda:dvp_site.fit(kind,year,1,'v3' if kind=='bat' else 'v1'))
        Z=data.bench(year,'zips',kind);S=data.bench(year,'steamer',kind)
        common=[pid for pid in pred if pid in Z and pid in S and Z[pid].get('WAR') is not None and S[pid].get('WAR') is not None and eligible(D.get(pid,{}),year,kind)]
        # Quantile maps use the preseason projection universe, without outcome filters.
        def role(pid):
            z=Z[pid];g=float(z.get('G') or 0);gs=float(z.get('GS') or 0)
            return 'starter' if g>0 and gs/g>=.5 else 'reliever'
        def qmap(ids):
            ids=[p for p in ids if float(Z[p].get(key) or 0)>0]
            return dict(dv=np.quantile([pred[p]['pt'] for p in ids],np.linspace(0,1,101)).tolist(),zips=np.quantile([float(Z[p][key]) for p in ids],np.linspace(0,1,101)).tolist())
        ids=[p for p in pred if p in Z and float(Z[p].get(key) or 0)>0]
        maps={'all':qmap(ids)}
        if kind=='pit':
            for rr in ('starter','reliever'):maps[rr]=qmap([p for p in ids if role(p)==rr])
        workload_maps[f'{kind}_{year}']=maps
        rows=[]
        for pid in common:
            hist=D[pid];actual=hist.get(year) or {};n=float(actual.get(key) or 0);war=float(actual.get('WAR') or 0)
            past=sorted([float(hist[y].get(key) or 0) for y in (year-1,year-2,year-3) if y in hist],reverse=True)
            healthy=min(700 if kind=='bat' else 200,float(np.mean(past[:2]))) if past else 0.
            rawpt=pred[pid]['pt'];globalpt=max(float(np.interp(rawpt,maps['all']['dv'],maps['all']['zips'])),healthy)
            rr=role(pid) if kind=='pit' else 'hitter';rolemap=maps.get(rr,maps['all']);mapped=float(np.interp(rawpt,rolemap['dv'],rolemap['zips']))
            if rr=='reliever':mapped=min(mapped,rolemap['zips'][80])
            rolept=max(mapped,healthy)
            rows.append(dict(pid=pid,year=year,w=1.,actual=war,actual_pt=n,role=rr,dv_expected=pred[pid]['rate']*rawpt/unit,dv_full=pred[pid]['rate']*globalpt/unit,dv_role_full=pred[pid]['rate']*rolept/unit,zips=float(Z[pid]['WAR']),steamer=float(S[pid]['WAR'])))
        methods=['dv_expected','dv_full','dv_role_full','zips','steamer'];season_results[f'{kind}_{year}']=score(rows,methods);pooled+=rows
        (args.output/f'private_season_rows_{kind}_{year}.json').write_text(json.dumps(rows))
        # Current FIP uses corrected innings in its component target denominators.
        if kind=='pit':
            current=cache(f'current_rates_{kind}_{year}',lambda:dvp.project(kind,year))['FIP']
            for pid,p in current.items():
                hist=D[pid];r=hist.get(year)
                if not r or float(r.get('IP') or 0)<40 or not eligible(hist,year,kind) or pid not in Z or pid not in S:continue
                rate_rows.append(dict(pid=pid,year=year,w=float(r['IP']),actual=float(r['FIP']),dv=p,zips=float(Z[pid]['FIP']),steamer=float(S[pid]['FIP'])))
    season_results[f'{kind}_pooled']=score(pooled,methods)
    if kind=='pit':current_primary['pit_pooled']=score(rate_rows,['dv','zips','steamer'])
    else:current_primary['bat_pooled']=primary['bat_pooled']
    print('SEASON WAR',kind,json.dumps(season_results[f'{kind}_pooled']),flush=True)

(args.output/'full_season_war_results.json').write_text(json.dumps(dict(protocol='FULL-SEASON-VALIDATION.md',status='New endpoint on reused historical seasons; no outcome-PA filter; no tuning.',results=season_results),indent=2)+'\n')
(args.output/'current_primary_results.json').write_text(json.dumps(current_primary,indent=2)+'\n')
(args.output/'workload_maps.json').write_text(json.dumps(workload_maps))
(args.output/'measurement_metadata.json').write_text(json.dumps(dict(code_sha256=codehash,innings='Actual historical IP converted from baseball notation; projected IP are continuous decimal expectations and are not converted.',bootstrap='Paired by player, preserving both years; 2,000 resamples.',status='Descriptive reused seasons, not a fresh holdout.'),indent=2)+'\n')
print('DONE',flush=True)
