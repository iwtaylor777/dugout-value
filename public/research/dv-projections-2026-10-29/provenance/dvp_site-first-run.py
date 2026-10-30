"""Site outputs: WAR rate and playing time at horizons 1-2, so projections can feed the trade model.
Horizon h means: data through season T-h, predicting season T."""
import runtime
runtime.configure()
import numpy as np, warnings; warnings.filterwarnings('ignore')
from dvp import blend_fit, LB, LP, anchor
from data import seasons, league
import feat_bat2, feat_bat3, feat_pit
BAT_FEAT = {'v1': feat_bat2, 'v3': feat_bat3}
from feat_pit import fnum
def _feat(kind, fv='v1'):
    return (BAT_FEAT[fv].row_features, league('bat'), 'PA', 2016) if kind=='bat' else (feat_pit.row_features, league('pit'), 'IP', 2013)
def has_history(h,last,wkey):
    t=0.0
    for l in (0,1,2):
        v=fnum(h.get(last-l,{}).get(wkey)) if last-l in h else 0.0
        t+=0.0 if np.isnan(v) else v
    return t>0
def fit(kind,T,h=1,fv='v1',cutoff=None):
    """Returns {pid: dict(rate=WAR per 600 PA or 180 IP, pt=PA or IP, war=total)} for season T using data through T-h."""
    F,Lr,wkey,start=_feat(kind,fv); D=seasons(kind); unit=600 if kind=='bat' else 180
    Lg=LB if kind=='bat' else LP; rk='WAR600' if kind=='bat' else 'WAR180'
    XR=[];YR=[];WR=[];XP=[];YP=[]
    for t in runtime.training_years(start,T,h,cutoff):
        if t==2020: continue
        tf=t-h+1  # pretend-target season whose lags end at t-h
        for pid,hh in D.items():
            if not has_history(hh,t-h,wkey): continue
            x=F(hh,tf,Lr); r=hh.get(t); n=fnum((r or {}).get(wkey)) if r else 0.0
            n=0.0 if (n is None or np.isnan(n)) else n
            XP.append(x); YP.append(n)
            if r and n>=(100 if kind=='bat' else 20) and not np.isnan(fnum(r.get('WAR'))):
                XR.append(x); YR.append(fnum(r['WAR'])/n*unit-Lg[t][rk]); WR.append(n)
    if not XR: return {}  # No observable training outcomes at this horizon yet.
    keys=sorted(XR[0].keys()); M=lambda X: np.array([[x[k] for k in keys] for x in X],float)
    Xt=[];ids=[]
    for pid,hh in D.items():
        if has_history(hh,T-h,wkey): Xt.append(F(hh,T-h+1,Lr)); ids.append(pid)
    B=M(Xt)
    rate=blend_fit(M(XR),np.array(YR),np.array(WR),B)+anchor(Lg,T-h+1,rk)
    pt=np.clip(blend_fit(M(XP),np.array(YP),np.ones(len(YP)),B),0,None)
    return {pid:dict(rate=float(r),pt=float(p),war=float(r*p/unit)) for pid,r,p in zip(ids,rate,pt)}
