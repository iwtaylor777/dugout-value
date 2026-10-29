import numpy as np, lightgbm as lgb
from sklearn.linear_model import RidgeCV
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.impute import SimpleImputer
from feat_pit import row_features, fnum
from data import seasons, league
from score import score
L=league('pit'); D=seasons('pit')
P=dict(n_estimators=600,learning_rate=0.02,num_leaves=15,min_child_samples=40,subsample=0.8,subsample_freq=1,colsample_bytree=0.7,reg_lambda=5.0)
def comps(r):
    ip=fnum(r['IP']); return dict(K=fnum(r['SO'])/ip, BB=(fnum(r['BB'])+fnum(r.get('HBP') or 0))/ip, HR=fnum(r['HR'])/ip)
def lg_comps(y):
    rows=[v[y] for v in D.values() if y in v and fnum(v[y]['IP'])>0]; ip=sum(fnum(r['IP']) for r in rows)
    return dict(K=sum(fnum(r['SO']) for r in rows)/ip, BB=sum(fnum(r['BB'])+fnum(r.get('HBP') or 0) for r in rows)/ip, HR=sum(fnum(r['HR']) for r in rows)/ip)
LC={y:lg_comps(y) for y in L}
def dataset(Ts,need=True):
    X=[];Y=[];W=[];ids=[]
    for T in Ts:
        for pid,h in D.items():
            if sum(fnum(h.get(T-l,{}).get('IP')) or 0 for l in (1,2,3) if T-l in h)<=0: continue
            if need:
                r=h.get(T)
                if not r or (fnum(r['IP']) or 0)<20 or T==2020: continue
                c=comps(r); Y.append([c[k]-LC[T][k] for k in ('K','BB','HR')]+[fnum(r['FIP'])-L[T]['FIP']]); W.append(fnum(r['IP']))
            X.append(row_features(h,T,L)); ids.append(pid)
    keys=sorted(X[0].keys()); return np.array([[x[k] for k in keys] for x in X],float),np.array(Y),np.array(W),ids
def model(): return lgb.LGBMRegressor(**P,verbose=-1)
def ridge(): return make_pipeline(SimpleImputer(strategy='median',add_indicator=True),StandardScaler(),RidgeCV(alphas=np.logspace(-1,4,20)))
def fit_predict(T):
    A,Y,W,_=dataset(range(2013,T)); B,_,_,ids=dataset([T],need=False)
    out={}
    preds=[]
    for j in range(4):
        g=model().fit(A,Y[:,j],sample_weight=W); r=ridge().fit(A,Y[:,j],ridgecv__sample_weight=W)
        preds.append(0.5*g.predict(B)+0.5*r.predict(B))
    K,BB,HR,F=preds
    anc=np.mean([L[T-i]['FIP'] for i in (1,2,3)])
    comp=13*HR+3*BB-2*K   # relative FIP from components
    return ({pid:float(c)+anc for pid,c in zip(ids,comp)},{pid:float(f)+anc for pid,f in zip(ids,F)},{pid:float(0.5*c+0.5*f)+anc for pid,c,f in zip(ids,comp,F)})
if __name__=='__main__':
    import warnings; warnings.filterwarnings('ignore')
    from diag import bias_generic
    for T in (2023,2024):
        c,f,m=fit_predict(T)
        for n,p in (('components',c),('direct',f),('mix',m)):
            print('--',n); bias_generic('pit',T,p,'FIP')
