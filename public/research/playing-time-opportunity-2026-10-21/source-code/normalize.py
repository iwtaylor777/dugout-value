"""Validate dated sources and construct fixed training/evaluation feature rows."""
from pathlib import Path
from urllib.parse import urlparse,parse_qs
import hashlib,json,math
from fetch import TEAMS
ROOT=Path(__file__).resolve().parent
REPO=ROOT.parents[1]
BASE=ROOT.parent/'projection_baselines'
OLD=ROOT.parent/'projection_benchmark'

def load(path,sources,receipt=True):
 data=path.read_bytes();digest=hashlib.sha256(data).hexdigest()
 record=dict(path=str(path.relative_to(REPO)),sha256=digest)
 if receipt:
  meta=json.loads(path.with_suffix(path.suffix+'.source.json').read_text())
  if meta['sha256']!=digest:raise ValueError('source hash mismatch')
  record.update(meta);record['path']=str(path.relative_to(REPO))
 sources.append(record)
 return json.loads(data)

def number(v):
 if v is None or not math.isfinite(float(v)) or float(v)<0 or int(v)!=float(v):raise ValueError('invalid count')
 return int(v)

def minor_counts(payload,year,sport):
 if len(payload.get('stats',[]))!=1:raise ValueError('missing level leaderboard')
 block=payload['stats'][0];splits=block['splits']
 if block['type']['displayName']!='byDateRange' or block['group']['displayName']!='hitting' or len(splits)!=block['totalSplits'] or len(splits)<300:
  raise ValueError('incomplete level leaderboard')
 out={}
 for row in splits:
  if int(row['season'])!=year:raise ValueError('wrong historical season')
  mid=str(row['player']['id'])
  if row['sport']['id']!=sport:
   # Individual AA game log/season line verifies Frisco's 3 PA. The global
   # response copies the player's other-level metadata onto this AA stat line.
   if (year,sport,mid,row['sport']['id'])!=(2024,12,'800354',14):raise ValueError('wrong level')
   if row['team']['id']!=540 or number(row['stat']['plateAppearances'])!=3:raise ValueError('audited row changed')
  if mid in out:raise ValueError('duplicate minor league identity; do not double-count team splits')
  out[mid]=number(row['stat']['plateAppearances'])
 return out

def fg_index(payload,expected_range=None):
 rows=payload['data']
 if len(rows)!=payload['totalCount'] or len(rows)<400:raise ValueError('incomplete MLB leaderboard')
 if expected_range and payload['dateRange']!=expected_range:raise ValueError('wrong MLB window')
 ids={};mids={}
 for row in rows:
  fid=str(row['playerid'])
  if fid in ids:raise ValueError('duplicate FanGraphs identity')
  ids[fid]=row
  if row.get('xMLBAMID'):
   mid=str(int(row['xMLBAMID']))
   if mid in mids:raise ValueError('duplicate MLBAM identity')
   mids[mid]=row
 return ids,mids

def fg_work(player,table):
 ids,mids=table
 a=ids.get(str(player.get('matched_fg_id')));b=mids.get(str(player['mlbam_id']))
 if a is not None and b is not None and a is not b:raise ValueError('identity conflict')
 row=a if a is not None else b
 if row is None:return 0
 if row.get('xMLBAMID') and str(int(row['xMLBAMID']))!=player['mlbam_id']:raise ValueError('crosswalk conflict')
 return number(row['PA'])

def schedule_check(payload,cutoff):
 games={}
 for date in payload['dates']:
  for game in date['games']:
   if game['gameType']!='R':raise ValueError('nonregular game')
   games.setdefault(game['gamePk'],[]).append(game)
 completed=0;cross=[]
 for pk,versions in games.items():
  original=min(g['officialDate'] for g in versions)
  completion=max([g['officialDate'] for g in versions]+[g['resumeDate'][:10] for g in versions if g.get('resumeDate')])
  if original<=cutoff<completion and any(g.get('resumeDate') for g in versions):cross.append(pk)
  if any(g['status']['codedGameState']=='F' for g in versions) and completion<=cutoff:completed+=1
 if cross:raise ValueError('suspended games cross feature cutoff: '+str(cross))
 return dict(unique_scheduled=len(games),completed_games=completed,cross_cutoff_suspensions=cross)

def active_roster(year,sources):
 active={};duplicates=[]
 for team in TEAMS:
  path=ROOT/'raw'/f'2024-roster-{team}.json' if year==2024 else BASE/'raw'/f'2025-dc-bat-roster-{team}.json'
  payload=load(path,sources)
  params=parse_qs(urlparse(sources[-1]['url']).query)
  if params.get('date')!=[f'{year}-05-31'] or payload['teamId']!=team or payload['rosterType']!='active':raise ValueError('wrong dated roster')
  rows=payload['roster']
  if not 20<=len(rows)<=30:raise ValueError('implausible roster')
  local={}
  for row in rows:
   mid=str(row['person']['id'])
   if mid in local:
    if local[mid]!=row:raise ValueError('conflicting roster duplicates')
    duplicates.append(dict(team=team,mlbam_id=mid));continue
   if mid in active or row['status']['code']!='A':raise ValueError('invalid active membership')
   local[mid]=row;active[mid]=team
 return active,duplicates

def normalize():
 sources=[]
 previous=load(BASE/'results/inputs.json',sources,False)
 original=load(OLD/'results/inputs.json',sources,False)
 baseline_report=load(BASE/'results/results.json',sources,False)
 levels={}
 for year in [2023,2024,2025]:
  for sport in [11,12]:
   for period in (['prior'] if year==2023 else ['prior','current'] if year==2024 else ['current']):
    payload=load(ROOT/'raw'/f'{year}-{sport}-{period}.json',sources)
    params=parse_qs(urlparse(sources[-1]['url']).query)
    expected=dict(stats='byDateRange',group='hitting',sportIds=str(sport),season=str(year),startDate=f'{year}-01-01',
      endDate=f'{year}-12-31' if period=='prior' else f'{year}-05-31',gameType='R',playerPool='ALL',offset='0')
    if any(params.get(k)!=[v] for k,v in expected.items()):raise ValueError('wrong minor-league query window')
    levels[year,sport,period]=minor_counts(payload,year,sport)
 inputs={};audits={}
 for year,key in [(2024,'2024-apr-dc-bat'),(2025,'2025-dc-bat')]:
  if len(previous[key])!=(584 if year==2024 else 612):raise ValueError('fixed cohort count changed')
  if {r['player_id'] for r in previous[key]}!={r['player_id'] for r in original[key]}:raise ValueError('fixed cohort identities changed')
  if not baseline_report['audits'][key]['capture'].startswith('20240410' if year==2024 else '20250601'):raise ValueError('wrong selection archive')
  schedule={}
  for sport in [1,11,12]:
   payload=load(ROOT/'raw'/f'{year}-{sport}-schedule.json',sources)
   params=parse_qs(urlparse(sources[-1]['url']).query)
   expected=dict(sportId=str(sport),startDate=f'{year}-01-01',endDate=f'{year}-05-31',gameTypes='R')
   if any(params.get(k)!=[v] for k,v in expected.items()):raise ValueError('wrong schedule request')
   schedule[sport]=schedule_check(payload,f'{year}-05-31')
  elapsed=2*schedule[1]['completed_games']/30;remaining=162-elapsed
  active,duplicates=active_roster(year,sources)
  prior=fg_index(load(BASE/'raw'/f'history-{year-1}-bat.json',sources))
  source=fg_index(load(ROOT/'raw'/'2024-mlb-source.json',sources),'2024-03-20 and 2024-05-31') if year==2024 else None
  target=fg_index(load(ROOT/'raw'/'2024-mlb-target.json',sources),'2024-06-01 and 2024-09-30') if year==2024 else None
  oldrows={r['player_id']:r for r in original[key]};rows=[]
  for p in previous[key]:
   mid=p['mlbam_id']
   if not mid:raise ValueError('unknown identity cannot become zero')
   linked=dict(oldrows[p['player_id']],mlbam_id=mid)
   ytd=fg_work(linked,source) if year==2024 else p['source_work']
   past=fg_work(linked,prior)
   if past!=p['prior_season_work'][0]:raise ValueError('prior history changed')
   actual=fg_work(linked,target) if year==2024 else p['actual_work']
   features=dict(mlb_current_pace=ytd/elapsed,mlb_prior_pace=past/162,active=int(mid in active),
       aaa_current=levels[year,11,'current'].get(mid,0),aa_current=levels[year,12,'current'].get(mid,0),
       aaa_prior=levels[year-1,11,'prior'].get(mid,0),aa_prior=levels[year-1,12,'prior'].get(mid,0))
   rows.append(dict(mlbam_id=mid,player_id=p['player_id'],name=p['name'],features=features,actual_work=actual,
      remaining_games=remaining,prior_mlb=p['history_group']=='prior_mlb',current_mlb=ytd>0,
      source_mlb_pa=ytd,prior_mlb_pa=past,active_team=active.get(mid),
      **(dict(baselines=p['workload']) if year==2025 else {})))
  if len({r['mlbam_id'] for r in rows})!=len(rows):raise ValueError('duplicate cohort identities')
  if year==2025:
   if abs(remaining-baseline_report['audits'][key]['remaining_team_games'])>1e-9:raise ValueError('evaluation schedule changed')
   if sum(r['features']['active'] for r in rows)!=389:raise ValueError('evaluation roster changed')
  audits[str(year)]=dict(n=len(rows),feature_cutoff=f'{year}-05-31',target_start=f'{year}-06-01',target_end=f'{year}-09-'+('30' if year==2024 else '28'),
   selection_archive='2024-04-10' if year==2024 else '2025-06-01',elapsed_games=elapsed,remaining_games=remaining,schedules=schedule,
   identical_roster_duplicates=duplicates,unknown_identities=0,missing_source_requests=0,
   active=sum(r['features']['active'] for r in rows),no_prior_mlb=sum(not r['prior_mlb'] for r in rows),
   no_current_mlb=sum(not r['current_mlb'] for r in rows),zero_outcomes=sum(r['actual_work']==0 for r in rows),
   current_aa_or_aaa=sum(r['features']['aaa_current']+r['features']['aa_current']>0 for r in rows),
   any_aa_or_aaa_history=sum(sum(r['features'][f] for f in ['aaa_current','aa_current','aaa_prior','aa_prior'])>0 for r in rows))
  inputs['train' if year==2024 else 'evaluation']=rows
 dest=ROOT/'results';dest.mkdir(exist_ok=True)
 for name,data in [('inputs.json',inputs),('audits.json',audits),('sources.json',sources)]:
  (dest/name).write_text(json.dumps(data,indent=2,allow_nan=False)+'\n')
 print(json.dumps(audits,indent=2))
 return inputs,audits

if __name__=='__main__':normalize()
