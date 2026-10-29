import numpy as np, lightgbm as lgb
from sklearn.linear_model import RidgeCV
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.impute import SimpleImputer
from feat_pit import build
from data import league
from score import score
L=league('pit')
def anchor(T,m='FIP'): return np.mean([L[T-i][m] for i in (1,2,3)])
def mats(X,keys=None):
    keys=keys or sorted(X[0].keys()); return np.array([[x[k] for k in keys] for x in X],float),keys
P=dict(n_estimators=600,learning_rate=0.02,num_leaves=15,min_child_samples=40,subsample=0.8,subsample_freq=1,colsample_bytree=0.7,reg_lambda=5.0)
def fit_predict(T,blend=0.5,metric='FIP',params=P):
    X,y,w,_,m=build(range(2013,T),metric=metric); keep=[i for i,t in enumerate(m) if t!=2020]
    A,keys=mats([X[i] for i in keep]); y=y[keep]; w=w[keep]
    Xt,_,_,ids,_=build([T],need_target=False); B,_=mats(Xt,keys)
    g=lgb.LGBMRegressor(**params,verbose=-1).fit(A,y,sample_weight=w)
    r=make_pipeline(SimpleImputer(strategy='median',add_indicator=True),StandardScaler(),RidgeCV(alphas=np.logspace(-1,4,20))).fit(A,y,ridgecv__sample_weight=w)
    p=blend*g.predict(B)+(1-blend)*r.predict(B)
    return {pid:float(v)+anchor(T,metric) for pid,v in zip(ids,p)}
if __name__=='__main__':
    for b in (1.0,0.5,0.0):
        for T in (2023,2024):
            s=score('pit',T,fit_predict(T,b),'FIP',boot=300); print('blend',b,T,{k:round(v,4) for k,v in s['rmse'].items()},'n',s['n'])
