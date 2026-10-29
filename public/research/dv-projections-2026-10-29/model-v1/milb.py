"""Minor-league features from MLB statsapi season stats (AAA=11, AA=12, A+/A=13,14)."""
import json, os, numpy as np, collections
DIR=os.path.expanduser('~/build/proj/milb/')
LV={11:'aaa',12:'aa',13:'lo',14:'lo'}
_c={}
def load(group):
    if group in _c: return _c[group]
    agg=collections.defaultdict(lambda: collections.defaultdict(float)); ages={}
    for fn in os.listdir(DIR):
        if not fn.endswith(f'-{group}.json'): continue
        y,s,_=fn.split('-'); y=int(y); lv=LV[int(s)]
        for r in json.load(open(DIR+fn)):
            st=r['stat']; pid=r['player']['id']; k=(pid,y,lv); a=agg[k]
            if group=='hitting':
                for f,src in (('pa','plateAppearances'),('ab','atBats'),('h','hits'),('d','doubles'),('t','triples'),('hr','homeRuns'),('bb','baseOnBalls'),('hbp','hitByPitch'),('so','strikeOuts'),('sb','stolenBases'),('sf','sacFlies')): a[f]+=float(st.get(src) or 0)
            else:
                for f,src in (('bf','battersFaced'),('outs','outs'),('so','strikeOuts'),('bb','baseOnBalls'),('hbp','hitBatsmen'),('hr','homeRuns'),('h','hits'),('er','earnedRuns'),('go','groundOuts'),('ao','airOuts'),('gs','gamesStarted'),('g','gamesPitched')): a[f]+=float(st.get(src) or 0)
            ages[k]=st.get('age')
    # league means per (year, level)
    lg=collections.defaultdict(lambda: collections.defaultdict(float))
    for (pid,y,lv),a in agg.items():
        for f,v in a.items(): lg[(y,lv)][f]+=v
    _c[group]=(agg,ages,lg); return _c[group]
def rates_hit(a):
    pa=a['pa']; ab=max(a['ab'],1); sing=a['h']-a['d']-a['t']-a['hr']
    woba=(0.69*a['bb']+0.72*a['hbp']+0.89*sing+1.27*a['d']+1.62*a['t']+2.1*a['hr'])/max(pa,1)
    bip=max(ab-a['so']-a['hr']+a['sf'],1)
    return dict(K=a['so']/pa,BB=a['bb']/pa,ISO=(a['d']+2*a['t']+3*a['hr'])/ab,HR=a['hr']/pa,wOBA=woba,BABIP=(a['h']-a['hr'])/bip,SB=a['sb']/pa)
def rates_pit(a):
    bf=a['bf']; ip=a['outs']/3
    return dict(K=a['so']/bf,BB=(a['bb']+a['hbp'])/bf,HR=a['hr']/bf,ERA=a['er']*9/max(ip,1),GO=a['go']/max(a['go']+a['ao'],1),H=a['h']/bf,GS=a['gs']/max(a['g'],1))
def features(mlbam,T,group):
    """Per lag (1..2) and level group: workload and level-relative rates."""
    agg,ages,lg=load(group); f={}
    wk='pa' if group=='hitting' else 'bf'; rf=rates_hit if group=='hitting' else rates_pit
    try: mlbam=int(mlbam)
    except: mlbam=None
    for lag in (1,2,3):
        y=T-lag
        for lv in ('aaa','aa','lo'):
            a=agg.get((mlbam,y,lv)) if mlbam else None
            n=a[wk] if a else 0.0
            f[f'mi_{lv}_{wk}_{lag}']=n
            L=lg.get((y,lv))
            if a and n>=20 and L:
                ra=rf(a); rl=rf(L)
                for k in ra: f[f'mi_{lv}_{k}_{lag}']=ra[k]-rl[k]
                f[f'mi_{lv}_age_{lag}']=float(ages.get((mlbam,y,lv)) or np.nan)
            else:
                for k in rf(collections.defaultdict(lambda:1.0)): f[f'mi_{lv}_{k}_{lag}']=np.nan
                f[f'mi_{lv}_age_{lag}']=np.nan
    return f
