"""End-of-season projection update for the Dugout Value player database (2026 season -> 2027+).
Usage: python3 season_update.py <in-db.json> <out-db.json> <report.json>
Inputs (local, not redistributed): FanGraphs leaderboards 2015-2026 (raw/fg_bat_*.json, raw/fg_pit_*.json)
and FanGraphs 2026 preseason ZiPS (raw/zips_cur_bat.json, raw/zips_cur_pit.json)."""
import json, sys, numpy as np
exec(open('marcel.py').read().split("rows=[]")[0])  # H, P, MEAN, marcel()
PARAMS=json.load(open('update2_params.json'))
AGE=PARAMS['AGE']; K={'bat':0.575,'pit':0.628}; DECAY=0.85
CFG={'bat':('pa',1200,200,100),'pit':('ip',300,30,20)}
ZC={'bat':{str(r['playerid']):r for r in json.load(open('raw/zips_cur_bat.json'))},'pit':{str(r['playerid']):r for r in json.load(open('raw/zips_cur_pit.json'))}}
src,dst,rep=sys.argv[1:4]
db=json.load(open(src)); report=[]
for p in db['players']:
    if p['kind']!='mlb' or p.get('futureProjectionUpdate') or p.get('twoWay') or p['name']=='Shohei Ohtani': continue
    fid=str(p.get('fangraphsId') or '')
    kind='bat' if p['role']=='position' else 'pit'; key,ball,bpt,minw=CFG[kind]
    h=(H if kind=='bat' else P).get(fid)
    if not h: continue
    seasons={s['year']:s for s in p.get('seasons',[])}; tp={x['year']:x for x in p['threeYearProjection']}
    if 2027 not in tp: continue
    z27=tp[2027].get('projectionBaselineWar',tp[2027]['war'])
    zwork=(seasons.get(2027,{}).get('arbMetrics') or {}).get(key)
    if not zwork: zwork=(ZC[kind].get(fid) or {}).get('PA' if kind=='bat' else 'IP')
    if not zwork or zwork<=0: continue
    age27=p['age']+1
    m,mr,pt=marcel(h,key,2026,1,ball,bpt); ms,mrs,_=marcel(h,key,2025,2,ball,bpt)
    zr=z27/zwork; a=AGE[kind]*(age27-29)
    if h.get(2026,{}).get(key,0)<minw: continue   # no 2026 MLB information: keep ZiPS
    calibrated=True; k=K[kind]
    rate=(mr+a)+k*(zr-(mrs+a))
    d27=rate*zwork-z27
    # role from 2026 usage (pitchers)
    role_old=p['role']; role=role_old
    if kind=='pit' and 2026 in h and h[2026]['g']>0:
        gs,g,ip=h[2026]['gs'],h[2026]['g'],h[2026]['ip']
        if gs>=10 and gs/g>=0.5: role='starter'
        elif gs/g<0.2 and ip>=20: role='reliever'
    if role!=role_old:
        p['role']=role; p.setdefault('agingModel',{})['role']=role; p['agingModel']['profile']=role
        p['depthPosition']='SP' if role=='starter' else 'RP'
    for coll in (p['threeYearProjection'],p.get('seasons',[])):
        for s in coll:
            y=s['year']
            if y<2027: continue
            base=s.get('projectionBaselineWar',s['war'])
            adj=round(d27*DECAY**(y-2027),1)
            s['projectionBaselineWar']=base; s['inSeasonAdjustment']=adj; s['war']=round(base+adj,1)
    p['seasonUpdate']={'season':2026,'method':'end-of-season update v1','calibrated':calibrated,'k':k,'adjustment2027':round(d27,2),**({'roleFrom':role_old,'roleTo':role} if role!=role_old else {})}
    report.append(dict(name=p['name'],id=p['id'],kind=kind,age27=age27,war26=round(h.get(2026,{}).get('war',0),2),zips27=z27,new27=round(z27+d27,2),k=k,role_old=role_old,role=role))
db['meta']['seasonUpdate']={'season':2026,'applied':'2026-10-26','method':'Calibrated end-of-season update: Marcel-style three-season WAR rate plus the share of ZiPS information beyond it (k=0.575 hitters, 0.628 pitchers, fit on 2026), applied at ZiPS playing time; carried into later seasons at 0.85 per year. Pitcher roles follow 2026 usage. Only players with at least 100 PA or 20 IP in 2026 are updated; players with Trade Value Series projections are unchanged.','players':len(report)}
open(dst,'w').write(json.dumps(db,separators=(',',':'),ensure_ascii=False)+'\n')
json.dump(report,open(rep,'w'),indent=0)
print('updated',len(report),'role changes',sum(r['role']!=r['role_old'] for r in report),'skipped (no 2026 MLB work or no history)',sum(1 for p in db['players'] if p['kind']=='mlb')-len(report))
