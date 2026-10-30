"""Match class members outside the site's roster snapshot to their historical leaderboard identity."""
import argparse,json,re,unicodedata
from pathlib import Path
parser=argparse.ArgumentParser();parser.add_argument('--database',type=Path,required=True);parser.add_argument('--class-list',type=Path,required=True);parser.add_argument('--raw',type=Path,required=True);parser.add_argument('--output',type=Path,required=True);a=parser.parse_args();a.output.mkdir(parents=True,exist_ok=True)
def key(name):return re.sub('[^a-z]','',unicodedata.normalize('NFD',name).encode('ascii','ignore').decode().lower())
D=json.loads(a.database.read_text());known={key(p['name']) for p in D['players'] if p.get('kind')=='mlb'};wanted={}
for line in a.class_list.read_text().strip().splitlines():
    pos,name,*_=line.split('|')
    if key(name) not in known:wanted[key(name)]=(pos,name)
rows={}
for kind in ('bat','pit'):
    for year in range(2010,2027):
        for r in json.loads((a.raw/f'fg_{kind}_{year}.json').read_text())['data']:
            name=re.sub('<[^>]+>','',r['Name']);k=key(name)
            if k==key('Enrique Hernandez'):k=key('Kike Hernandez')
            if k in wanted:rows[kind,k]=(year,r)
extra=[];unmatched=[]
for k,(pos,name) in wanted.items():
    kind='pit' if pos in ('SP','RP','P') else 'bat'
    if (kind,k) not in rows:unmatched.append(name);continue
    year,r=rows[kind,k];age=int(r['Age'])+2026-year
    role=('starter' if (r.get('GS') or 0)/max(r.get('G') or 1,1)>=.5 else 'reliever') if kind=='pit' else 'position'
    extra.append(dict(id='mlb-'+str(r.get('xMLBAMID') or 'fg-'+str(r['playerid'])),kind='mlb',name=name,team='FA',fangraphsId=str(r['playerid']),position=pos,role=role,age=age,agingModel=dict(role=role,baseAge=age+1,anchorYear=2027),threeYearProjection=[],seasons=[]))
if unmatched:raise ValueError('Unmatched historical identities: '+', '.join(unmatched))
D['players']+=extra
(a.output/'extra_players.json').write_text(json.dumps(extra))
(a.output/'extended_database.json').write_text(json.dumps(D))
print('Matched',len(extra),'additional identities; role chosen from the listed position, then recent pitching usage.')
