"""FA market pricing: non-catcher hitters get half credit for projected fielding runs (Amendment 3).
Usage: python3 fa_fielding.py <site-db.json> <out-db.json> <fielding-report.json>"""
import json, sys
src,dst,rep=sys.argv[1:4]
db=json.load(open(src)); H={}
for y in (2024,2025,2026):
    for r in json.load(open(f'raw/fg_bat_{y}.json'))['data']: H.setdefault(str(r['playerid']),{})[y]=r
ZC={str(r['playerid']):r for r in json.load(open('raw/zips_cur_bat.json'))}
THETA=0.5; out=[]
for p in db['players']:
    if p['kind']!='mlb' or p['role']!='position' or str(p.get('position','')).startswith('C'): continue
    h=H.get(str(p.get('fangraphsId') or '')); 
    if not h: continue
    num=den=0
    for y,w in ((2026,5),(2025,4),(2024,3)):
        r=h.get(y)
        if r and r.get('PA'): num+=w*(r.get('Fielding') or 0); den+=w*r['PA']
    if not den: continue
    seasons={s['year']:s for s in p.get('seasons',[])}
    pa=(seasons.get(2027,{}).get('arbMetrics') or {}).get('pa') or (ZC.get(str(p['fangraphsId'])) or {}).get('PA') or 550
    fw=(num/den)*pa/10
    for coll in (p['threeYearProjection'],p.get('seasons',[])):
        for s in coll:
            if s['year'] in (2027,2028): s['war']=round(s['war']-(1-THETA)*fw,1)
    out.append((p['name'],round(fw,2)))
json.dump(db,open(dst,'w'),separators=(',',':'),ensure_ascii=False); json.dump(out,open(rep,'w'))
print('fielding-adjusted hitters',len(out))
