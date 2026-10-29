"""Corrected horizon benchmark and signing-path replay.

Set DV_RAW_DIR, DV_MILB_DIR and DV_ARCHIVE_DIR; run:
  python site/replay.py --output /path/to/private-cache --contracts /path/to/tracker.json --retention /path/to/retention.json
Only aggregate JSON files should be copied into the public research package.
"""
import argparse, hashlib, json, os, platform, time
from pathlib import Path
import numpy as np
import runtime
runtime.configure()
import dvp_site, dvp, data
from feat_pit import fnum
from threadpoolctl import threadpool_limits

parser=argparse.ArgumentParser()
parser.add_argument('--output',type=Path,required=True)
parser.add_argument('--contracts',type=Path)
parser.add_argument('--retention',type=Path)
parser.add_argument('--only',choices=['benchmark','calibration','rafaela','all'],default='all')
args=parser.parse_args()
args.output.mkdir(parents=True,exist_ok=True)
dvp.P['n_jobs']=2
threadpool_limits(limits=2)
cache=args.output/'fits'; cache.mkdir(exist_ok=True)
codehash=hashlib.sha256((Path(__file__).read_bytes()+Path(dvp_site.__file__).read_bytes()+Path(runtime.__file__).read_bytes())).hexdigest()

def fit(kind,target,h=1,fv=None):
    fv=fv or ('v3' if kind=='bat' else 'v1')
    p=cache/f'{kind}_{target}_{h}_{fv}.json'
    if p.exists():
        d=json.loads(p.read_text())
        if d['codehash']==codehash: return d['predictions']
    started=time.monotonic()
    r=dvp_site.fit(kind,target,h,fv)
    p.write_text(json.dumps(dict(codehash=codehash,target=target,horizon=h,cutoff=target-h,predictions=r)))
    print('FIT',kind,target,h,fv,'n',len(r),'seconds',round(time.monotonic()-started,1),flush=True)
    return r

def curve(kind,cutoff):
    D=data.seasons(kind); key='PA' if kind=='bat' else 'IP'; unit=600 if kind=='bat' else 180; mn=200 if kind=='bat' else 40
    ch={}
    for hist in D.values():
        for year in hist:
            if year+1 not in hist or year+1>cutoff or year==2020 or year+1==2020: continue
            a,b=hist[year],hist[year+1]; na,nb=fnum(a.get(key)),fnum(b.get(key))
            if na>=mn and nb>=mn and a.get('Age'):
                ch.setdefault(int(a['Age']),[]).append((min(na,nb),fnum(b['WAR'])/nb*unit-fnum(a['WAR'])/na*unit))
    out={}
    for age in range(18,50):
        pts=[p for g in range(age-1,age+2) for p in ch.get(g,[])]
        out[age]=float(np.average([v for _,v in pts],weights=[w for w,_ in pts])) if len(pts)>30 else 0.0
    return out

def age_at(hist,season,cutoff):
    prev=[y for y in hist if y<=cutoff and hist[y].get('Age')]
    if not prev: return None
    last=max(prev); return int(hist[last]['Age'])+season-last

def benchmark():
    summary=[]
    for kind in ('bat','pit'):
        D=data.seasons(kind); key='PA' if kind=='bat' else 'IP'; unit=600 if kind=='bat' else 180; mn=200 if kind=='bat' else 40
        for target in (2024,2025,2026):
            for horizon in range(2,6):
                if (kind,target,horizon) not in [('bat',2024,2),('bat',2024,3),('bat',2025,2),('bat',2025,3),('bat',2025,4),('bat',2026,2),('bat',2026,3),('bat',2026,4),('bat',2026,5),('pit',2024,2),('pit',2024,3),('pit',2025,2),('pit',2025,3),('pit',2026,2),('pit',2026,3),('pit',2026,4),('pit',2026,5)]: continue
                origin=target-horizon; direct=fit(kind,target,horizon); one=fit(kind,origin+1); c=curve(kind,origin); rows=[]
                for pid,v in direct.items():
                    r=D[pid].get(target); age=age_at(D[pid],origin+1,origin)
                    if not r or pid not in one or age is None or fnum(r.get(key))<mn: continue
                    aged=one[pid]['rate']+sum(c.get(age+j,0.0) for j in range(horizon-1))
                    rows.append(dict(pid=pid,n=fnum(r[key]),actual=fnum(r['WAR'])/fnum(r[key])*unit,direct=v['rate'],aged=aged,blend=.7*v['rate']+.3*aged))
                w=np.array([r['n'] for r in rows]); y=np.array([r['actual'] for r in rows]); pr={k:np.array([r[k] for r in rows]) for k in ('direct','aged','blend')}
                rm=lambda k,ix=slice(None): float(np.sqrt(np.average((pr[k][ix]-y[ix])**2,weights=w[ix])))
                res=dict(kind=kind,target=target,years_ahead=horizon,cutoff=origin,n=len(rows),rmse_horizon_model=rm('direct'),rmse_one_year_plus_aging_curve=rm('aged'),rmse_blend_70_30=rm('blend'))
                rng=np.random.default_rng(20261029); diffs={k:[] for k in ('direct','blend')}
                for _ in range(2000):
                    ix=rng.integers(0,len(rows),len(rows))
                    for k in diffs: diffs[k].append(rm(k,ix)-rm('aged',ix))
                res['paired_rmse_difference_95ci']={k:np.percentile(v,[2.5,97.5]).tolist() for k,v in diffs.items()}
                summary.append(res)
                (args.output/f'rows_{kind}_{target}_{horizon}.json').write_text(json.dumps(rows))
                print('BENCHMARK',json.dumps(res),flush=True)
                (args.output/'horizon_backtest_corrected.json').write_text(json.dumps(summary,indent=2)+'\n')

def calibration():
    if not args.contracts or not args.retention: raise ValueError('contracts and retention required')
    contracts=json.loads(args.contracts.read_text()); retention=json.loads(args.retention.read_text()); maps={}; curves={}; deals=[]
    for season in range(2023,2027):
        for kind in ('bat','pit'):
            D=data.seasons(kind); key='PA' if kind=='bat' else 'IP'
            P=fit(kind,season); Z=data.bench(season,'zips',kind)
            if not Z: raise ValueError(f'missing archived ZiPS workloads {season} {kind}')
            ids=[pid for pid in P if pid in Z and fnum(Z[pid].get(key))>0]
            maps[kind,season]=(np.quantile([P[pid]['pt'] for pid in ids],np.linspace(0,1,101)),np.quantile([fnum(Z[pid][key]) for pid in ids],np.linspace(0,1,101)))
            curves[kind,season]=curve(kind,season-1)
            for horizon in range(2,6): fit(kind,season+horizon-1,horizon)
    for d in contracts:
        season=d['tracker_season']
        if season not in range(2023,2027) or d['ContractType']!='Free Agent' or not d['ContractTotal'] or not d['YearsTotal']: continue
        aav=d['ContractTotal']/d['YearsTotal']/1e6*1.03**(2026-season)
        if aav<2: continue
        pos=(d.get('position') or '').split('/')[0]; kind='pit' if pos in ('SP','RP','CL','P') else 'bat'; role='reliever' if pos in ('RP','CL') else 'starter' if kind=='pit' else 'position'
        pid=str(d['playerId']); P=[fit(kind,season+h-1,h) for h in range(1,6)]
        if pid not in P[0]: continue
        hist=data.seasons(kind).get(pid,{}); age=age_at(hist,season,season-1)
        if age is None: continue
        key='PA' if kind=='bat' else 'IP'; unit=600 if kind=='bat' else 180
        wl=sorted([fnum(hist[y][key]) for y in range(season-3,season) if y in hist],reverse=True)
        healthy=min(700 if kind=='bat' else 200,float(np.mean(wl[:2]))) if wl else 0.0
        qdv,qz=maps[kind,season]; pt=max(float(np.interp(P[0][pid]['pt'],qdv,qz)),healthy)
        c=curves[kind,season]; r1=P[0][pid]['rate']; raw=[]
        for h in range(5):
            aged=r1+sum(c.get(age+j,0.0) for j in range(h))
            raw.append(.7*P[h][pid]['rate']+.3*aged if pid in P[h] else aged)
        ks=np.arange(1,5); slope=float(np.sum(ks*(np.array(raw[1:])-raw[0]))/np.sum(ks*ks)); path=[]; f=1.; rate=raw[0]
        for k in range(int(d['YearsTotal'])):
            if k: f*=retention[role].get(str(min(48,age+k)),1.)
            rate=raw[0]+slope*k if k<5 else rate+c.get(age+k,0.0)
            path.append(round(rate*pt*f/unit,3))
        deals.append(dict(name=d['playerName'],season=season,role=role,pos=pos,age=age,yrs=d['YearsTotal'],aav=aav,w1=path[0],path=path,fg_proj=d.get('war_proj')))
    (args.output/'cal_deals_corrected.json').write_text(json.dumps(deals))
    print('CALIBRATION PATHS',len(deals),flush=True)

def rafaela():
    pid='24262'; D=data.seasons('bat'); current={}
    for h in range(1,6): current[h]=fit('bat',2026+h,h).get(pid)
    old=fit('bat',2027,1,'v1').get(pid)
    # A diagnostic counterfactual, not a model change: neutralize only his WAR-component features.
    original=dvp_site.BAT_FEAT['v3'].row_features
    def neutral(hist,T,L=None):
        f=original(hist,T,L)
        if hist is D[pid]:
            for k in f:
                if k.startswith(('Fielding_','BaseRunning_','Positional_')): f[k]=0.
        return f
    dvp_site.BAT_FEAT['v3'].row_features=neutral
    neutral_prediction=dvp_site.fit('bat',2027,1,'v3').get(pid)
    dvp_site.BAT_FEAT['v3'].row_features=original
    out=dict(current_horizons=current,offense_features_only=old,neutral_war_components=neutral_prediction,diagnostic='Counterfactual changes multiple correlated features together; not a causal attribution.')
    (args.output/'rafaela_diagnostic.json').write_text(json.dumps(out,indent=2))
    print('RAFAELA',json.dumps(out),flush=True)

if args.only in ('benchmark','all'): benchmark()
if args.only in ('calibration','all'): calibration()
if args.only in ('rafaela','all'): rafaela()
import sklearn, lightgbm
metadata=dict(code_sha256=codehash,python=platform.python_version(),numpy=np.__version__,sklearn=sklearn.__version__,lightgbm=lightgbm.__version__,timing='Every training outcome is dated no later than target minus horizon.',status='Corrected reused retrospective evaluation; no retuning.')
(args.output/'replay_metadata.json').write_text(json.dumps(metadata,indent=2)+'\n')
