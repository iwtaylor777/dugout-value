import json, numpy as np
rows=[]
for y in (2015,2016,2017,2018,2019,2021,2022,2023,2024,2025):
    B={r['TeamName']:r for r in json.load(open(f'team/bat_{y}.json'))['data']}
    P={r['TeamName']:r for r in json.load(open(f'team/pit_{y}.json'))['data']}
    for t,b in B.items():
        p=P[t]; rows.append(dict(y=y,t=t,RA=p['R'],fipR=p['FIP']*p['IP']/9,fld=b['Fielding'],RS=b['R'],bat=b['Batting'],bsr=b.get('BaseRunning') or 0,pa=b['PA']))
def ols(X,y):
    X=np.c_[X,np.ones(len(y))]; b,res,*_=np.linalg.lstsq(X,y,rcond=None); e=y-X@b; s2=e@e/(len(y)-X.shape[1]); se=np.sqrt(np.diag(s2*np.linalg.inv(X.T@X))); return b,se
yrs=sorted({r['y'] for r in rows}); FE=lambda r:[1.0*(r['y']==y) for y in yrs[1:]]
X=np.array([[r['fipR'],r['fld']]+FE(r) for r in rows]); y=np.array([r['RA'] for r in rows]); b,se=ols(X,y)
print(f'runs allowed: per FIP-run {b[0]:.3f} (se {se[0]:.3f}), per team fielding run {b[1]:.3f} (se {se[1]:.3f})  n={len(rows)} team-seasons')
X=np.array([[r['bat'],r['bsr']]+FE(r) for r in rows]); y=np.array([r['RS'] for r in rows]); b,se=ols(X,y)
print(f'runs scored: per batting run {b[0]:.3f} (se {se[0]:.3f}), per baserunning run {b[1]:.3f} (se {se[1]:.3f})')
# without year FE for scale sanity
# ratio of conversion rates with a bootstrap over team-seasons
rng=np.random.default_rng(3); rs=[]
for _ in range(2000):
    S=[rows[i] for i in rng.integers(0,len(rows),len(rows))]; yrs2=sorted({r['y'] for r in S})
    FE2=lambda r:[1.0*(r['y']==y) for y in yrs2[1:]]
    ba,_=ols(np.array([[r['fipR'],r['fld']]+FE2(r) for r in S]),np.array([r['RA'] for r in S]))
    bb,_=ols(np.array([[r['bat'],r['bsr']]+FE2(r) for r in S]),np.array([r['RS'] for r in S]))
    rs.append(-ba[1]/bb[0])
print('fielding run vs batting run conversion ratio: 95%',np.round(np.percentile(rs,[2.5,50,97.5]),2))
