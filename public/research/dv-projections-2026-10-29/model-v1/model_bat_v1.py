import numpy as np, lightgbm as lgb, json, sys
from feat_bat import build
from data import league
from score import score
L=league('bat')
def to_mat(X,keys=None):
    keys=keys or sorted(X[0].keys()); return np.array([[x[k] for k in keys] for x in X],float),keys
def fit_predict(T,params):
    Xtr,ytr,wtr,_,mtr=build(range(2016,T)); Xtr=[x for x in Xtr]
    # exclude 2020 as a target season (60 games); keep it as an input
    keep=[i for i,m in enumerate(mtr) if m!=2020]; Xtr=[Xtr[i] for i in keep]; ytr=ytr[keep]; wtr=wtr[keep]
    A,keys=to_mat(Xtr)
    Xte,_,_,ids,_=build([T],need_target=False); B,_=to_mat(Xte,keys)
    m=lgb.LGBMRegressor(**params,verbose=-1); m.fit(A,ytr,sample_weight=wtr)
    p=m.predict(B)
    return {pid:float(v)+L[T-1]['wOBA'] for pid,v in zip(ids,p)},m,keys
P=dict(n_estimators=600,learning_rate=0.02,num_leaves=15,min_child_samples=40,subsample=0.8,subsample_freq=1,colsample_bytree=0.7,reg_lambda=5.0)
if __name__=='__main__':
    for T in (2023,2024):
        preds,m,keys=fit_predict(T,P)
        print(T,json.dumps(score('bat',T,preds,'wOBA'),indent=None))
