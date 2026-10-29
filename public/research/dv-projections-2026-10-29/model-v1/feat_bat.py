import numpy as np, math
from data import seasons, league
COLS=['wOBA','xwOBA','K%','BB%','ISO','BABIP','Barrel%','HardHit%','EV','EV90','maxEV','LA','O-Swing%','Z-Swing%','Z-Contact%','O-Contact%','SwStr%','Spd','GB%','FB%','LD%','Pull%','IFFB%','HR/FB','Hard%','Soft%','wRC+','AVG','xSLG','xAVG','SLG','OBP']
REL={'wOBA','xwOBA','ISO','BABIP','K%','BB%','AVG','SLG','OBP','xSLG','xAVG'}
def val(r,c,L,y):
    v=r.get(c)
    if v is None: return np.nan
    try: v=float(v)
    except: return np.nan
    if c in REL:
        base={'wOBA':'wOBA','xwOBA':'wOBA'}.get(c)
        if base: v-=L[y]['wOBA']
    return v
def row_features(h,T,L):
    f={}; tot=0
    agg={c:[0.0,0.0] for c in COLS}
    for lag in (1,2,3):
        y=T-lag; r=h.get(y)
        pa=(r or {}).get('PA') or 0
        f[f'pa_{lag}']=pa; tot+=pa
        for c in COLS:
            v=val(r,c,L,y) if r and pa>0 else np.nan
            f[f'{c}_{lag}']=v
            if not math.isnan(v):
                w={1:5,2:4,3:3}[lag]*pa; agg[c][0]+=w*v; agg[c][1]+=w
    for c in COLS: f[f'{c}_w']=agg[c][0]/agg[c][1] if agg[c][1] else np.nan
    f['pa_tot']=tot
    last=next((h[T-l] for l in (1,2,3) if T-l in h),None)
    f['age']=(last['Age']+ (T-[T-l for l in (1,2,3) if T-l in h][0])) if last and last.get('Age') else np.nan
    pos=(last or {}).get('position') or ''
    for p in ('C','SS','2B','3B','CF','1B','DH'): f['pos_'+p]=1.0 if str(pos).split('/')[0]==p else 0.0
    return f
def build(Ts, need_target=True, min_pa_target=100):
    D=seasons('bat'); L=league('bat'); X=[];y=[];w=[];ids=[];meta=[]
    for T in Ts:
        for pid,h in D.items():
            if sum((h.get(T-l,{}).get('PA') or 0) for l in (1,2,3))<1: continue
            if need_target:
                r=h.get(T)
                if not r or (r['PA'] or 0)<min_pa_target: continue
                y.append(r['wOBA']-L[T]['wOBA']); w.append(r['PA'])
            X.append(row_features(h,T,L)); ids.append(pid); meta.append(T)
    return X,np.array(y),np.array(w),ids,meta
