"""Tests W, R, A, P from PROTOCOL-VALIDATION.md."""
import json, os, sys, numpy as np
sys.path.insert(0,os.path.expanduser('~/mnt/Baseball/analysis/projections/model-v1'))
from data import seasons, league
from feat_pit import fnum
TEAMS=os.path.expanduser('~/build/proj/teams/')
SYS=['dv','zips','steamer','marcel','last']
def ipf(s):
    s=str(s); a,_,b=s.partition('.'); return int(a)+({'':0,'0':0,'1':1/3,'2':2/3}[b])
def mlbam_map():
    m={}
    for kind in ('bat','pit'):
        for pid,h in seasons(kind).items():
            for y,r in h.items():
                if r.get('xMLBAMID'): m[(kind,int(r['xMLBAMID']))]=pid
    return m
MAP=mlbam_map()
def team_data(T):
    st=json.load(open(f'{TEAMS}standings_{T}.json')); out={}
    for rec in st['records']:
        for t in rec['teamRecords']:
            tid=t['team']['id']; d=dict(name=t['team']['name'],W=t['wins'],G=t['wins']+t['losses'],RS=t['runsScored'],RA=t['runsAllowed'],bat=[],pit=[])
            for s in json.load(open(f'{TEAMS}{T}-{tid}-hitting.json')):
                pa=s['stat'].get('plateAppearances') or 0
                if pa: d['bat'].append((MAP.get(('bat',s['player']['id'])),pa))
            for s in json.load(open(f'{TEAMS}{T}-{tid}-pitching.json')):
                ip=ipf(s['stat'].get('inningsPitched') or 0)
                if ip: d['pit'].append((MAP.get(('pit',s['player']['id'])),ip))
            d['PA']=sum(p for _,p in d['bat']); d['IP']=sum(i for _,i in d['pit'])
            out[tid]=d
    return out
def team_proj(T,P,systems):
    """Per team-season: projected WAR, projected wOBA (PA-weighted), projected FIP (IP-weighted) for each system under the common-fallback rule."""
    Lb=league('bat')[T-1]['wOBA']; Lp=league('pit')[T-1]['FIP']
    core=[s for s in ('dv','zips','steamer') if s in systems]
    have={k:{s:(P[s][k] or {}) for s in systems} for k in ('bat','pit')}
    res={}
    for tid,d in team_data(T).items():
        r={s:dict(WAR=0.0,woba=0.0,fip=0.0) for s in systems}
        for pid,pa in d['bat']:
            common=pid is not None and all(pid in have['bat'][s] for s in core)
            for s in systems:
                v=have['bat'][s].get(pid) if common else None
                w=v['WAR'] if v else 0.0; wo=v['wOBA'] if v else Lb-0.030
                r[s]['WAR']+=w*pa/600; r[s]['woba']+=wo*pa
        for pid,ip in d['pit']:
            common=pid is not None and all(pid in have['pit'][s] for s in core)
            for s in systems:
                v=have['pit'][s].get(pid) if common else None
                w=v['WAR'] if v else 0.0; f=v['FIP'] if v else Lp+0.75
                r[s]['WAR']+=w*ip/180; r[s]['fip']+=f*ip
        for s in systems: r[s]['woba']/=d['PA']; r[s]['fip']/=d['IP']
        res[tid]=dict(team=d['name'],T=T,W=d['W'],G=d['G'],RpPA=d['RS']/d['PA'],RA9=d['RA']*9/d['IP'],proj=r)
    return res
def corr(x,y): return float(np.corrcoef(x,y)[0,1])
def loso_rmse(x,y,season):
    x=np.array(x);y=np.array(y);season=np.array(season); e=[]
    if len(np.unique(season))<2: return None
    for t in np.unique(season):
        tr=season!=t; b=np.polyfit(x[tr],y[tr],1); e+=list(np.polyval(b,x[~tr])-y[~tr])
    return float(np.sqrt(np.mean(np.square(e))))
def test(rows,systems,field,target,sign=1,boot=2000,seed=20261027):
    x={s:np.array([r['proj'][s][field] for r in rows]) for s in systems}; y=np.array([r[target] for r in rows]); se=[r['T'] for r in rows]
    out={'n':len(rows),'corr':{s:sign*corr(x[s],y) for s in systems},'loso_rmse':{s:loso_rmse(x[s],y,se) for s in systems}}
    out['loso_rmse']={k:(round(v,3) if v is not None else None) for k,v in out['loso_rmse'].items()}
    rng=np.random.default_rng(seed); d={s:[] for s in systems if s!='dv'}
    for _ in range(boot):
        i=rng.integers(0,len(rows),len(rows))
        for s in d: d[s].append(sign*(corr(x['dv'][i],y[i])-corr(x[s][i],y[i])))
    out['corr_diff_ci (dv minus)']={s:[round(float(np.percentile(v,2.5)),4),round(float(np.percentile(v,97.5)),4)] for s,v in d.items()}
    return out
if __name__=='__main__':
    allrows={}
    for T in (2023,2024,2025,2026):
        P=json.load(open(f'proj_{T}.json'))
        systems=[s for s in SYS if P[s]['bat'] is not None and P[s]['pit'] is not None]
        allrows[T]=(team_proj(T,P,systems),systems)
    res={}
    pooled=[r for T in (2024,2025,2026) for r in allrows[T][0].values()]; S3=SYS
    for name,field,target,sign in (('W wins',  'WAR','W',1),('R runs scored','woba','RpPA',1),('A runs allowed','fip','RA9',1)):
        res[name+' pooled 2024-26']=test(pooled,S3,field,target,sign)
        for T in (2023,2024,2025,2026):
            rows=list(allrows[T][0].values()); res[f'{name} {T}']=test(rows,allrows[T][1],field,target,sign,boot=500)
    # raw wins RMSE with 47.7 replacement wins (scaled by games)
    for T in (2024,2025,2026):
        rows=list(allrows[T][0].values())
        res[f'W raw-RMSE {T}']={s:float(np.sqrt(np.mean([(47.7*r['G']/162+r['proj'][s]['WAR']-r['W'])**2 for r in rows]))) for s in SYS}
    json.dump(res,open('validation_v1.json','w'),indent=1)
    for k,v in res.items():
        if 'corr' in v: print(k,'n',v['n'],'corr',{s:round(c,3) for s,c in v['corr'].items()},'| dv-minus CI',v['corr_diff_ci (dv minus)'],'| loso',v['loso_rmse'] if any(v['loso_rmse'].values()) else '')
        else: print(k,{s:round(c,2) for s,c in v.items()})
