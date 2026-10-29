"""Hitter features v2: per-lag values plus multi-scale shrunk aggregates (learned stabilization)."""
import numpy as np, math
from data import seasons, league
from feat_bat import COLS
import milb
USE_MILB=True
_lgc={}
def lgcol(y):
    if y in _lgc: return _lgc[y]
    D=seasons('bat'); rows=[v[y] for v in D.values() if y in v and (v[y]['PA'] or 0)>0]; out={}
    for c in COLS:
        num=den=0.0
        for r in rows:
            try: x=float(r.get(c))
            except: continue
            if math.isnan(x): continue
            num+=x*r['PA']; den+=r['PA']
        out[c]=num/den if den else np.nan
    _lgc[y]=out; return out
KS=(60,250,1000)
LAGS=((1,5),(2,4),(3,3),(4,2),(5,1))
def row_features(h,T,L=None):
    f={}; tot=0; acc={c:[] for c in COLS}
    for lag,wt in LAGS:
        y=T-lag; r=h.get(y); pa=(r or {}).get('PA') or 0
        f[f'pa_{lag}']=pa; tot+=pa; lc=lgcol(y) if y>=2010 else None
        for c in COLS:
            v=np.nan
            if r and pa>0 and lc:
                try: v=float(r.get(c))-lc[c]
                except: v=np.nan
            f[f'{c}_{lag}']=v
            if not math.isnan(v): acc[c].append((wt*pa/4.0,v))
    for c in COLS:
        sw=sum(a for a,_ in acc[c]); sv=sum(a*v for a,v in acc[c])
        for k in KS: f[f'{c}_s{k}']=sv/(sw+k)
        f[f'{c}_n']=sw
    f['pa_tot']=tot
    lags=[T-l for l in (1,2,3,4,5) if T-l in h]
    f['age']=(h[lags[0]]['Age']+(T-lags[0])) if lags and h[lags[0]].get('Age') else np.nan
    pos=str(h[lags[0]].get('position') or '') if lags else ''
    for p in ('C','SS','2B','3B','CF','1B','DH'): f['pos_'+p]=1.0 if pos.split('/')[0]==p else 0.0
    if USE_MILB:
        mid=next((h[y].get('xMLBAMID') for y in sorted(h,reverse=True) if h[y].get('xMLBAMID')),None)
        f.update(milb.features(mid,T,'hitting'))
    return f
