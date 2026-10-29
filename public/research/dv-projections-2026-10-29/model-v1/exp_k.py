import numpy as np, warnings; warnings.filterwarnings('ignore')
import dvp
from dvp import LB, anchor, feat_bat2
from data import seasons, league
from score import score
from sklearn.linear_model import RidgeCV
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.impute import SimpleImputer
import lightgbm as lgb
D=seasons('bat'); L=league('bat')
def data(T):
    X=[];Y=[];W=[]
    for t in range(2016,T):
        if t==2020: continue
        for pid,h in D.items():
            r=h.get(t)
            if not r or (r['PA'] or 0)<100 or sum((h.get(t-l,{}).get('PA') or 0) for l in (1,2,3))<=0: continue
            X.append(feat_bat2.row_features(h,t)); Y.append((r['SO'] or 0)/r['PA']-LB[t]['K']); W.append(r['PA'])
    Xt=[];ids=[]
    for pid,h in D.items():
        if sum((h.get(T-l,{}).get('PA') or 0) for l in (1,2,3))<=0: continue
        Xt.append(feat_bat2.row_features(h,T)); ids.append(pid)
    return X,np.array(Y),np.array(W),Xt,ids
for T in (2023,2024):
    X,Y,W,Xt,ids=data(T)
    for name,flt in (('all',lambda k:True),('k-related',lambda k:any(s in k for s in ('K%','SwStr%','Contact%','O-Swing%','Z-Swing%','pa_','age','_n','mi_aaa_K','mi_aa_K','mi_lo_K','mi_aaa_pa','mi_aa_pa','mi_lo_pa','mi_aaa_age','mi_aa_age')))):
        keys=[k for k in sorted(X[0]) if flt(k)]
        A=np.array([[x[k] for k in keys] for x in X]); B=np.array([[x[k] for k in keys] for x in Xt])
        r=make_pipeline(SimpleImputer(strategy='constant',fill_value=0,add_indicator=True),StandardScaler(),RidgeCV(alphas=np.logspace(-1,4,20))).fit(A,Y,ridgecv__sample_weight=W).predict(B)
        g=lgb.LGBMRegressor(**dvp.P,verbose=-1).fit(A,Y,sample_weight=W).predict(B)
        for bn,p in (('ridge',r),('lgbm',g),('blend',0.5*r+0.5*g)):
            s=score('bat',T,{pid:float(v)+anchor(LB,T,'K') for pid,v in zip(ids,p)},'K',boot=50)
            print(T,name,bn,round(s['rmse']['dv'],4),'zips',round(s['rmse']['zips'],4))
