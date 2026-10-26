import json, numpy as np
rows=json.load(open('rows.json'))
def fit(X,y,w=None):
    X=np.c_[X,np.ones(len(X))]
    if w is None: w=np.ones(len(y))
    sw=np.sqrt(w); b=np.linalg.lstsq(X*sw[:,None],y*sw,rcond=None)[0]; return b
def boot(fn,n=1000,seed=7):
    rng=np.random.default_rng(seed); out=[]
    idx=np.arange(len(rows))
    for _ in range(n): out.append(fn(rng.integers(0,len(rows),len(rows))))
    return np.percentile(np.array(out),[2.5,97.5],axis=0)
off=np.array([r['past']['bat']+r['past']['bsr'] for r in rows]); fld=np.array([r['past']['fld'] for r in rows]); pos=np.array([r['past']['pos'] for r in rows])
age=np.array([r['age'] or 29 for r in rows]); ppa=np.array([r['ppa'] for r in rows]); fpa=np.array([r['fpa'] for r in rows])
fwar=np.array([r['fut']['war'] for r in rows]); frate=np.where(fpa>0,fwar/np.maximum(fpa,1)*600,0)
X=np.c_[off,fld,pos,age-29]
# 1) future WAR per 600 (players who kept >=300 PA), PA-weighted
m=fpa>=300
b=fit(X[m],frate[m],fpa[m]); print('future WAR/600 per past run/600: off %.3f fld %.3f pos %.3f | fld/off %.2f pos/off %.2f'%(b[0],b[1],b[2],b[1]/b[0],b[2]/b[0]))
def f1(i):
    i=i[m[i]]; bb=fit(X[i],frate[i],fpa[i]); return [bb[1]/bb[0],bb[2]/bb[0]]
c=boot(f1); print('   95% CI fld/off',np.round(c[:,0],2).tolist(),' pos/off',np.round(c[:,1],2).tolist())
# 2) future playing time (PA over 3 years) on the same components (all rows, zeros if gone)
b2=fit(np.c_[X,ppa],fpa); print('future 3-yr PA per past run/600: off %.1f fld %.1f pos %.1f'%(b2[0],b2[1],b2[2]))
# 3) total future WAR (3 seasons, zeros if gone) per past run/600, controlling past PA
b3=fit(np.c_[X,ppa],fwar); print('future 3-yr total WAR per past run/600: off %.3f fld %.3f pos %.3f | fld/off %.2f pos/off %.2f'%(b3[0],b3[1],b3[2],b3[1]/b3[0],b3[2]/b3[0]))
def f3(i):
    bb=fit(np.c_[X,ppa][i],fwar[i]); return [bb[1]/bb[0],bb[2]/bb[0]]
c=boot(f3); print('   95% CI fld/off',np.round(c[:,0],2).tolist(),' pos/off',np.round(c[:,1],2).tolist())
json.dump({'rate':list(map(float,b)),'total':list(map(float,b3)),'order':'off,fld,pos,age-29,(ppa),const'},open('predictive.json','w'),indent=1)
