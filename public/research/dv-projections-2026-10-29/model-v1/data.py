"""Season data and benchmark loading for the Dugout Value projection backtest."""
import json, os, numpy as np
RAW=os.path.expanduser('~/build/fa/proj/raw/')
ARCH=os.path.expanduser('~/build/proj/archive/')
YEARS=list(range(2010,2027))
_cache={}
def seasons(kind):
    """kind 'bat' or 'pit' -> {pid: {year: row}}"""
    if kind in _cache: return _cache[kind]
    D={}
    for y in YEARS:
        for r in json.load(open(f'{RAW}fg_{kind}_{y}.json'))['data']:
            D.setdefault(str(r['playerid']),{})[y]=r
    _cache[kind]=D; return D
def league(kind):
    k='lg_'+kind
    if k in _cache: return _cache[k]
    D=seasons(kind); L={}
    for y in YEARS:
        rows=[v[y] for v in D.values() if y in v]
        if kind=='bat':
            pa=sum(r['PA'] or 0 for r in rows)
            L[y]=dict(wOBA=sum((r['wOBA'] or 0)*(r['PA'] or 0) for r in rows)/pa,
                      K=sum(r['SO'] or 0 for r in rows)/pa, BB=sum(r['BB'] or 0 for r in rows)/pa,
                      ISO=sum((r['ISO'] or 0)*(r['AB'] or 0) for r in rows)/max(1,sum(r['AB'] or 0 for r in rows)))
        else:
            ip=sum(r['IP'] or 0 for r in rows); tbf=sum(r['TBF'] or 0 for r in rows)
            L[y]=dict(FIP=sum((r['FIP'] or 0)*(r['IP'] or 0) for r in rows)/ip, ERA=sum((r['ER'] or 0) for r in rows)*9/ip,
                      K=sum(r['SO'] or 0 for r in rows)/tbf, BB=sum(r['BB'] or 0 for r in rows)/tbf)
    _cache[k]=L; return L
def bench(year,system,kind):
    f=f'{ARCH}{year}-{system}-{kind}.json'
    if not os.path.exists(f): return None
    return {str(r.get('playerid') or r.get('playerids')):r for r in json.load(open(f))}
