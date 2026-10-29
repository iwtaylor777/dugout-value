import numpy as np, math
from data import seasons, league
import milb
USE_MILB=False
PLAGS=((1,3),(2,2),(3,1))
COLS=['FIP','xFIP','SIERA','ERA','K%','BB%','K-BB%','SwStr%','C+SwStr%','CSW%','HR/9','HR/FB','GB%','FB%','LD%','Barrel%','HardHit%','EV','FBv','pb_stuff','pb_command','pb_overall','pb_xRV100','Zone%','O-Swing%','Contact%','Z-Contact%','F-Strike%','LOB%','BABIP','kwERA','WHIP','Soft%','Hard%']
LEAGUE_REL={'FIP':'FIP','xFIP':'FIP','SIERA':'FIP','ERA':'ERA','kwERA':'FIP'}
def fnum(v):
    try: return float(v)
    except: return np.nan
def row_features(h,T,L):
    f={}; agg={c:[0.0,0.0] for c in COLS}; tot=0
    for lag,lw in PLAGS:
        y=T-lag; r=h.get(y); ip=fnum((r or {}).get('IP')) if r else 0.0
        ip=0.0 if (ip is None or math.isnan(ip)) else ip
        f[f'ip_{lag}']=ip; tot+=ip
        gs=fnum((r or {}).get('GS')) if r else np.nan; g=fnum((r or {}).get('G')) if r else np.nan
        f[f'gsshare_{lag}']=gs/g if r and g and not math.isnan(g) and g>0 else np.nan
        for c in COLS:
            v=fnum(r.get(c)) if r and ip>0 else np.nan
            if not math.isnan(v) and c in LEAGUE_REL: v-=L[y][LEAGUE_REL[c]]
            f[f'{c}_{lag}']=v
            if not math.isnan(v): wt=lw*ip; agg[c][0]+=wt*v; agg[c][1]+=wt
    for c in COLS: f[f'{c}_w']=agg[c][0]/agg[c][1] if agg[c][1] else np.nan
    f['ip_tot']=tot
    lags=[T-l for l in (1,2,3) if T-l in h]
    f['age']=(h[lags[0]]['Age']+(T-lags[0])) if lags and h[lags[0]].get('Age') else np.nan
    if USE_MILB:
        mid=next((h[y].get('xMLBAMID') for y in sorted(h,reverse=True) if h[y].get('xMLBAMID')),None)
        f.update(milb.features(mid,T,'pitching'))
    return f
def build(Ts,need_target=True,min_ip_target=20,metric='FIP'):
    D=seasons('pit'); L=league('pit'); X=[];y=[];w=[];ids=[];meta=[]
    for T in Ts:
        for pid,h in D.items():
            if sum(fnum(h.get(T-l,{}).get('IP')) or 0 for l in (1,2,3) if T-l in h)<=0: continue
            if need_target:
                r=h.get(T)
                if not r or (fnum(r['IP']) or 0)<min_ip_target or r.get(metric) is None: continue
                y.append(fnum(r[metric])-L[T][metric]); w.append(fnum(r['IP']))
            X.append(row_features(h,T,L)); ids.append(pid); meta.append(T)
    return X,np.array(y),np.array(w),ids,meta
