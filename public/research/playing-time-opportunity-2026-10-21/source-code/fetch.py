"""Fetch bounded historical inputs with cached source receipts."""
from pathlib import Path
from datetime import datetime,timezone
from concurrent.futures import ThreadPoolExecutor
import hashlib,json,time,urllib.request,urllib.parse
ROOT=Path(__file__).resolve().parent
TEAMS=[108,109,110,111,112,113,114,115,116,117,118,119,120,121,133,134,135,136,137,138,139,140,141,142,143,144,145,146,147,158]

def fetch(item):
 name,url=item;p=ROOT/'raw'/name;p.parent.mkdir(exist_ok=True)
 meta=p.with_suffix(p.suffix+'.source.json')
 if p.exists() and meta.exists():
  r=json.loads(meta.read_text())
  if r['url']!=url or r['sha256']!=hashlib.sha256(p.read_bytes()).hexdigest():raise ValueError('cache mismatch '+name)
  return
 for attempt in range(3):
  try:
   with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'DugoutValueResearch/1.0'}),timeout=60) as r:data=r.read();resolved=r.url
   break
  except Exception:
   if attempt==2:raise
   time.sleep(1)
 json.loads(data)
 p.write_bytes(data);meta.write_text(json.dumps(dict(path=name,url=url,resolved_url=resolved,sha256=hashlib.sha256(data).hexdigest(),retrieved_at=datetime.now(timezone.utc).isoformat(),bytes=len(data)),indent=2)+'\n')
 print(name,len(data),flush=True)

def url(endpoint,**params):return 'https://statsapi.mlb.com/api/v1/'+endpoint+'?'+urllib.parse.urlencode(params)

def requests():
 for year in [2023,2024,2025]:
  for sport in [11,12]:
   periods=['prior'] if year==2023 else ['prior','current'] if year==2024 else ['current']
   for period in periods:
    end=f'{year}-12-31' if period=='prior' else f'{year}-05-31'
    yield f'{year}-{sport}-{period}.json',url('stats',stats='byDateRange',group='hitting',sportIds=sport,season=year,startDate=f'{year}-01-01',endDate=end,gameType='R',playerPool='ALL',limit=2000,offset=0)
 for year in [2024,2025]:
  for sport in [1,11,12]:
   yield f'{year}-{sport}-schedule.json',url('schedule',sportId=sport,startDate=f'{year}-01-01',endDate=f'{year}-05-31',gameTypes='R')
 for team in TEAMS:
  yield f'2024-roster-{team}.json',url(f'teams/{team}/roster',rosterType='active',date='2024-05-31')
 for period,start,end in [('source','2024-03-20','2024-05-31'),('target','2024-06-01','2024-09-30')]:
  params=dict(pos='all',stats='bat',lg='all',qual='0',type='8',season=2024,season1=2024,ind='0',team='0',rost='0',age='0',filter='',players='0',month='1000',startdate=start,enddate=end,pageitems=2000,pagenum=1)
  yield f'2024-mlb-{period}.json','https://www.fangraphs.com/api/leaders/major-league/data?'+urllib.parse.urlencode(params)

if __name__=='__main__':
 with ThreadPoolExecutor(max_workers=4) as pool:list(pool.map(fetch,requests()))
