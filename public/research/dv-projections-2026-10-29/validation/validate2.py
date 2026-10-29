"""Amendment 1 tests E (player run value) and W2 (wins, separate slopes), plus test P (pay)."""
import json, os, sys, numpy as np
sys.path.insert(0,os.path.expanduser('~/mnt/Baseball/analysis/projections/model-v1'))
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from data import seasons, league, bench
from validate import team_data, loso_rmse, SYS
SEED=20261027
def wcorr(x,y,w):
    w=w/w.sum(); mx=(w*x).sum(); my=(w*y).sum()
    return float((w*(x-mx)*(y-my)).sum()/np.sqrt((w*(x-mx)**2).sum()*(w*(y-my)**2).sum()))
def boot_diff(X,y,w,sign,systems,B=2000):
    rng=np.random.default_rng(SEED); n=len(y); d={s:[] for s in systems if s!='dv'}
    for _ in range(B):
        i=rng.integers(0,n,n)
        base=sign*wcorr(X['dv'][i],y[i],w[i])
        for s in d: d[s].append(base-sign*wcorr(X[s][i],y[i],w[i]))
    return {s:[round(float(np.percentile(v,2.5)),4),round(float(np.percentile(v,97.5)),4)] for s,v in d.items()}
def fnum(v):
    try: return float(v)
    except (TypeError,ValueError): return None
P={T:json.load(open(f'proj_{T}.json')) for T in (2023,2024,2025,2026)}
def systems_for(T,kind): return [s for s in SYS if P[T][s][kind] is not None]
res={}
# ---------- E: player run value ----------
def E_rows(kind,T):
    D=seasons(kind); S=systems_for(T,kind); rows=[]
    for pid,h in D.items():
        r=h.get(T)
        if not r: continue
        if kind=='bat':
            pa=fnum(r['PA']) or 0; re=fnum(r.get('RE24'))
            if pa<200 or re is None: continue
            if not all(pid in P[T][s]['bat'] for s in S): continue
            rows.append(dict(T=T,pid=pid,w=pa,y=re/pa,act=fnum(r['wOBA']),**{s:P[T][s]['bat'][pid]['wOBA'] for s in S}))
        else:
            ip=fnum(r['IP']) or 0; tbf=fnum(r.get('TBF')); re=fnum(r.get('RE24'))
            if ip<40 or not tbf or re is None: continue
            if not all(pid in P[T][s]['pit'] for s in S): continue
            rows.append(dict(T=T,pid=pid,w=ip,y=-re/tbf,act=fnum(r['FIP']),**{s:P[T][s]['pit'][pid]['FIP'] for s in S}))
    return rows,S
def E_test(rows,S,sign,B=2000):
    y=np.array([r['y'] for r in rows]); w=np.array([r['w'] for r in rows]); X={s:np.array([r[s] for r in rows]) for s in S}
    out=dict(n=len(rows),corr={s:round(sign*wcorr(X[s],y,w),4) for s in S},
             same_season_actual=round(sign*wcorr(np.array([r['act'] for r in rows]),y,w),4))
    out['corr_diff_ci (dv minus)']=boot_diff(X,y,w,sign,S,B); return out
for kind,sign,label in (('bat',1,'E hitters: proj wOBA vs RE24/PA'),('pit',-1,'E pitchers: proj FIP vs RE24 allowed/TBF')):
    per={T:E_rows(kind,T) for T in (2023,2024,2025,2026)}
    pooledS=[s for s in SYS if all(s in per[T][1] for T in (2024,2025,2026))]
    pooled=[r for T in (2024,2025,2026) for r in per[T][0]]
    res[label+' pooled 2024-26']=E_test(pooled,pooledS,sign)
    for T in (2023,2024,2025,2026):
        if per[T][0]: res[f'{label} {T}']=E_test(per[T][0],per[T][1],sign,B=1000)
# ---------- W2: wins on hitter WAR and pitcher WAR separately ----------
def team_split(T):
    Pt=P[T]; core=['dv','zips','steamer']; S=[s for s in SYS if Pt[s]['bat'] is not None and Pt[s]['pit'] is not None]
    out=[]
    for tid,d in team_data(T).items():
        r={s:[0.0,0.0] for s in S}
        for pid,pa in d['bat']:
            c=pid is not None and all(pid in Pt[s]['bat'] for s in core)
            for s in S:
                v=Pt[s]['bat'].get(pid) if c else None; r[s][0]+=(v['WAR'] if v else 0)*pa/600
        for pid,ip in d['pit']:
            c=pid is not None and all(pid in Pt[s]['pit'] for s in core)
            for s in S:
                v=Pt[s]['pit'].get(pid) if c else None; r[s][1]+=(v['WAR'] if v else 0)*ip/180
        out.append(dict(T=T,W=d['W']*162/d['G'],proj=r))
    return out
rows=[r for T in (2024,2025,2026) for r in team_split(T)]
def loso2(Xm,y,season):
    e=[]
    for t in np.unique(season):
        tr=season!=t; A=np.c_[np.ones(tr.sum()),Xm[tr]]; b=np.linalg.lstsq(A,y[tr],rcond=None)[0]
        e+=list(np.c_[np.ones((~tr).sum()),Xm[~tr]]@b-y[~tr])
    return float(np.sqrt(np.mean(np.square(e))))
y=np.array([r['W'] for r in rows]); se=np.array([r['T'] for r in rows]); w2={}
for s in SYS:
    Xm=np.array([r['proj'][s] for r in rows]); one=Xm.sum(1)[:,None]
    A=np.c_[np.ones(len(y)),Xm]; b=np.linalg.lstsq(A,y,rcond=None)[0]
    w2[s]=dict(loso_rmse_split=round(loso2(Xm,y,se),3),loso_rmse_total=round(loso2(one,y,se),3),slopes_hit_pit=[round(float(b[1]),3),round(float(b[2]),3)])
rng=np.random.default_rng(SEED); n=len(y); dd={s:[] for s in SYS if s!='dv'}
def insample_rmse(Xm,yy):
    A=np.c_[np.ones(len(yy)),Xm]; b=np.linalg.lstsq(A,yy,rcond=None)[0]; return float(np.sqrt(np.mean((A@b-yy)**2)))
Xs={s:np.array([r['proj'][s] for r in rows]) for s in SYS}
for _ in range(2000):
    i=rng.integers(0,n,n); base=insample_rmse(Xs['dv'][i],y[i])
    for s in dd: dd[s].append(base-insample_rmse(Xs[s][i],y[i]))
w2['rmse_diff_ci (dv minus; negative = dv better)']={s:[round(float(np.percentile(v,2.5)),3),round(float(np.percentile(v,97.5)),3)] for s,v in dd.items()}
res['W2 wins per 162, separate hitter/pitcher slopes, pooled 2024-26 (n=%d)'%n]=w2
# ---------- P: pay ----------
FA=json.load(open(os.path.expanduser('~/mnt/Baseball/analysis/fa_market_calibration/raw/fg_fa_tracker_2020_2027.json')))
def P_rows(T,kind):
    S=systems_for(T,kind); st=bench(T,'steamer',kind) or {}; rows=[]
    for d in FA:
        if d['tracker_season']!=T or d['ContractType']!='Free Agent' or not d['ContractTotal'] or not d['YearsTotal']: continue
        aav=d['ContractTotal']/d['YearsTotal']
        if aav<2e6: continue
        pos=(d.get('position') or '').split('/')[0]; ispit=pos in ('SP','RP','CL','P')
        if ispit!=(kind=='pit'): continue
        pid=str(d['playerId']); s=st.get(pid)
        if not s: continue
        pt=fnum(s.get('PA' if kind=='bat' else 'IP'))
        if not pt: continue
        if not all(pid in P[T][x][kind] for x in S): continue
        scale=pt/(600 if kind=='bat' else 180)
        rows.append(dict(T=T,name=d['playerName'],y=np.log(aav),**{x:P[T][x][kind][pid]['WAR']*scale for x in S}))
    return rows,S
def P_test(rows,S,B=2000):
    y=np.array([r['y'] for r in rows]); T=np.array([r['T'] for r in rows])
    for t in np.unique(T): y[T==t]-=y[T==t].mean()   # season-demeaned log AAV
    w=np.ones(len(y)); X={s:np.array([r[s] for r in rows]) for s in S}
    c={s:wcorr(X[s],y,w) for s in S}
    return dict(n=len(rows),corr={s:round(v,4) for s,v in c.items()},R2={s:round(v*v,4) for s,v in c.items()},**{'corr_diff_ci (dv minus)':boot_diff(X,y,w,1,S,B)})
for kind,label in (('bat','P hitters'),('pit','P pitchers')):
    per={T:P_rows(T,kind) for T in (2023,2024,2025,2026)}
    pooledS=[s for s in SYS if all(s in per[T][1] for T in (2024,2025,2026))]
    pooled=[r for T in (2024,2025,2026) for r in per[T][0]]
    res[label+' pooled 2024-26']=P_test(pooled,pooledS)
    if kind=='bat':
        p4=[r for T in (2023,2024,2025,2026) for r in per[T][0]]; res[label+' pooled 2023-26']=P_test(p4,pooledS)
both=[r for kind in ('bat','pit') for T in (2024,2025,2026) for r in P_rows(T,kind)[0]]
res['P all free agents pooled 2024-26']=P_test(both,SYS)
json.dump(res,open('validation_v1_amend1.json','w'),indent=1)
for k,v in res.items(): print(k,'\n   ',json.dumps(v))
