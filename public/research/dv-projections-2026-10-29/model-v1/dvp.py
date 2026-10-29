"""Dugout Value projections (development version). Hitters: direct wOBA + component targets. Pitchers: K, BB+HBP, HR per IP composed into FIP, blended with direct FIP; ERA, K%, BB%, WAR/180."""
import numpy as np, lightgbm as lgb, warnings
from sklearn.linear_model import RidgeCV
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.impute import SimpleImputer
from data import seasons, league
import feat_bat, feat_pit, feat_bat2
from feat_pit import fnum
warnings.filterwarnings('ignore')
FEAT_BAT=2
P=dict(n_estimators=600,learning_rate=0.02,num_leaves=15,min_child_samples=40,subsample=0.8,subsample_freq=1,colsample_bytree=0.7,reg_lambda=5.0)
def blend_fit(A,y,w,B,blend=0.5,seed=0):
    g=lgb.LGBMRegressor(**P,random_state=seed,verbose=-1).fit(A,y,sample_weight=w)
    r=make_pipeline(SimpleImputer(strategy='median',add_indicator=True),StandardScaler(),RidgeCV(alphas=np.logspace(-1,4,20))).fit(A,y,ridgecv__sample_weight=w)
    return blend*g.predict(B)+(1-blend)*r.predict(B)
# ---- league means for every target
def lg_bat():
    D=seasons('bat'); out={}
    for y in league('bat'):
        rows=[v[y] for v in D.values() if y in v and (v[y]['PA'] or 0)>0]; pa=sum(r['PA'] for r in rows); ab=sum(r['AB'] or 0 for r in rows)
        out[y]=dict(wOBA=league('bat')[y]['wOBA'],K=sum(r['SO'] or 0 for r in rows)/pa,BB=sum(r['BB'] or 0 for r in rows)/pa,
                    ISO=sum((r['ISO'] or 0)*(r['AB'] or 0) for r in rows)/ab,WAR600=sum(r['WAR'] or 0 for r in rows)/pa*600)
    return out
def lg_pit():
    D=seasons('pit'); out={}
    for y in league('pit'):
        rows=[v[y] for v in D.values() if y in v and fnum(v[y]['IP'])>0]; ip=sum(fnum(r['IP']) for r in rows); tbf=sum(fnum(r['TBF']) for r in rows)
        out[y]=dict(FIP=league('pit')[y]['FIP'],ERA=league('pit')[y]['ERA'],K=sum(fnum(r['SO']) for r in rows)/tbf,BB=sum(fnum(r['BB']) for r in rows)/tbf,
                    WAR180=sum(fnum(r['WAR']) for r in rows)/ip*180,
                    Kip=sum(fnum(r['SO']) for r in rows)/ip,BBip=sum(fnum(r['BB'])+fnum(r.get('HBP') or 0) for r in rows)/ip,HRip=sum(fnum(r['HR']) for r in rows)/ip)
    return out
LB=lg_bat(); LP=lg_pit()
def tgt_bat(r):
    pa=r['PA']; return dict(wOBA=r['wOBA'],K=(r['SO'] or 0)/pa,BB=(r['BB'] or 0)/pa,ISO=r['ISO'],WAR600=(r['WAR'] or 0)/pa*600)
def tgt_pit(r):
    ip=fnum(r['IP']); tbf=fnum(r['TBF'])
    return dict(FIP=fnum(r['FIP']),ERA=fnum(r['ERA']),K=fnum(r['SO'])/tbf,BB=fnum(r['BB'])/tbf,WAR180=fnum(r['WAR'])/ip*180,
                Kip=fnum(r['SO'])/ip,BBip=(fnum(r['BB'])+fnum(r.get('HBP') or 0))/ip,HRip=fnum(r['HR'])/ip)
def anchor(Lg,T,k): return float(np.mean([Lg[T-i][k] for i in (1,2,3)]))
def project(kind,T,train_from=None):
    D=seasons(kind)
    if kind=='bat': F=(feat_bat2.row_features if FEAT_BAT==2 else feat_bat.row_features); Lr=league('bat'); Lg=LB; tg=tgt_bat; wkey='PA'; minw=100; start=train_from or 2016; keys_t=['wOBA','K','BB','ISO','WAR600']
    else: F=feat_pit.row_features; Lr=league('pit'); Lg=LP; tg=tgt_pit; wkey='IP'; minw=20; start=train_from or 2013; keys_t=['FIP','ERA','K','BB','WAR180','Kip','BBip','HRip']
    X=[];Y=[];W=[]
    for t in range(start,T):
        if t==2020: continue
        for pid,h in D.items():
            r=h.get(t)
            if not r or (fnum(r[wkey]) or 0)<minw: continue
            if sum(fnum(h.get(t-l,{}).get(wkey)) or 0 for l in (1,2,3) if t-l in h)<=0: continue
            v=tg(r)
            if any(v[k] is None or (isinstance(v[k],float) and np.isnan(v[k])) for k in keys_t): continue
            X.append(F(h,t,Lr)); Y.append([v[k]-Lg[t][k] for k in keys_t]); W.append(fnum(r[wkey]))
    keys=sorted(X[0].keys()); A=np.array([[x[k] for k in keys] for x in X],float); Y=np.array(Y); W=np.array(W)
    Xt=[];ids=[]
    for pid,h in D.items():
        if sum(fnum(h.get(T-l,{}).get(wkey)) or 0 for l in (1,2,3) if T-l in h)<=0: continue
        Xt.append(F(h,T,Lr)); ids.append(pid)
    B=np.array([[x[k] for k in keys] for x in Xt],float)
    out={k:{} for k in keys_t}
    for j,k in enumerate(keys_t):
        p=blend_fit(A,Y[:,j],W,B)
        for pid,v in zip(ids,p): out[k][pid]=float(v)+anchor(Lg,T,k)
    if kind=='pit':
        lgF=anchor(Lg,T,'FIP'); 
        rel=lambda pid: 13*(out['HRip'][pid]-anchor(Lg,T,'HRip'))+3*(out['BBip'][pid]-anchor(Lg,T,'BBip'))-2*(out['Kip'][pid]-anchor(Lg,T,'Kip'))
        out['FIP']={pid:0.5*(lgF+rel(pid))+0.5*out['FIP'][pid] for pid in ids}
    return out
