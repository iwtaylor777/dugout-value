"""Build per-season projections for each system: wOBA, FIP, WAR per 600 PA (hitters), WAR per 180 IP (pitchers). Cached to JSON."""
import sys, os, json, warnings; warnings.filterwarnings('ignore')
sys.path.insert(0,os.path.expanduser('~/mnt/Baseball/analysis/projections/model-v1'))
from dvp import project
from data import seasons, league, bench
from feat_pit import fnum
def ip(v):
    v=fnum(v); 
    if v is None: return 0.0
    whole=int(v); frac=round(v-whole,1)
    return whole+{0.0:0,0.1:1/3,0.2:2/3}.get(frac,frac)
def dv(T):
    b=project('bat',T); p=project('pit',T)
    return dict(bat={pid:dict(wOBA=b['wOBA'][pid],WAR=b['WAR600'][pid]) for pid in b['wOBA']},
                pit={pid:dict(FIP=p['FIP'][pid],WAR=p['WAR180'][pid]) for pid in p['FIP']})
def ext(T,s):
    out={}
    for kind in ('bat','pit'):
        B=bench(T,s,kind) or {}; d={}
        for pid,r in B.items():
            try:
                if kind=='bat':
                    if not r.get('PA'): continue
                    d[pid]=dict(wOBA=float(r['wOBA']),WAR=float(r['WAR'])/float(r['PA'])*600)
                else:
                    if not r.get('IP'): continue
                    d[pid]=dict(FIP=float(r['FIP']),WAR=float(r['WAR'])/float(r['IP'])*180)
            except (TypeError,ValueError,KeyError): pass
        out[kind]=d if B else None
    return out
def baselines(T):
    Db=seasons('bat'); Dp=seasons('pit'); Lb=league('bat'); Lp=league('pit')
    last={'bat':{},'pit':{}}; mar={'bat':{},'pit':{}}
    for pid,h in Db.items():
        r=h.get(T-1)
        if r and (r['PA'] or 0)>=50: last['bat'][pid]=dict(wOBA=r['wOBA'],WAR=(r['WAR'] or 0)/r['PA']*600)
        nw=nwar=den=0
        for w,y in ((5,T-1),(4,T-2),(3,T-3)):
            q=h.get(y)
            if q and q['PA']: nw+=w*q['PA']*(q['wOBA']-Lb[y]['wOBA']); nwar+=w*(q['WAR'] or 0)*600; den+=w*q['PA']
        if den: mar['bat'][pid]=dict(wOBA=Lb[T-1]['wOBA']+nw/(den+4800),WAR=(nwar+4800*1.0)/(den+4800))
    for pid,h in Dp.items():
        r=h.get(T-1); rip=fnum(r['IP']) if r else 0
        if r and rip>=15: last['pit'][pid]=dict(FIP=fnum(r['FIP']),WAR=fnum(r['WAR'])/rip*180)
        nf=nwar=den=0
        for w,y in ((3,T-1),(2,T-2),(1,T-3)):
            q=h.get(y); qi=fnum(q['IP']) if q else 0
            if q and qi: nf+=w*qi*(fnum(q['FIP'])-Lp[y]['FIP']); nwar+=w*fnum(q['WAR'])*180; den+=w*qi
        if den: mar['pit'][pid]=dict(FIP=Lp[T-1]['FIP']+nf/(den+402),WAR=(nwar+402*1.0)/(den+402))
    return last,mar
if __name__=='__main__':
    T=int(sys.argv[1]); out={}
    out['dv']=dv(T); z=ext(T,'zips'); s=ext(T,'steamer'); out['zips']=z; out['steamer']=s
    out['last'],out['marcel']=baselines(T)
    json.dump(out,open(f'proj_{T}.json','w')); print(T,{k:{kk:(len(vv) if vv else None) for kk,vv in v.items()} for k,v in out.items()})
