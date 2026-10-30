"""Rebuild the contact-only hitter leaderboard from the validated private components.
Set DV_WAR_SOURCE_ROOT / DV_WAR_AUDIT_INPUT as documented by the research package.
"""
import argparse, hashlib, json, pickle, re, sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
PACKAGE=ROOT/'public/research/value-war-contact-2026-10-29'
if not PACKAGE.exists():PACKAGE=Path(__file__).resolve().parent
sys.path.insert(0,str(PACKAGE))
from runtime import COMP, SOURCE, fg
p=argparse.ArgumentParser();p.add_argument('--output',type=Path,default=ROOT/'app/data/dv-war-hitters.json');args=p.parse_args()
sha=lambda f:hashlib.sha256(Path(f).read_bytes()).hexdigest()
out={};checks={}
for year in [2024,2025,2026]:
 b=fg.fg('bat',year)
 path=COMP/f'{year}_full.pkl'
 with path.open('rb') as f:c=pickle.load(f)
 rpw=b.RAR.sum()/b.WAR.sum();delta=-.5*c['bat'].r
 delta=delta-c['bat'].PA*(delta.sum()/c['bat'].PA.sum())
 assert abs(delta.sum())<1e-9
 full_delta=delta.reindex(b.index).fillna(0)
 assert abs(full_delta.sum())<1e-9,'Source player coverage does not preserve full-league totals'
 rows=[]
 for mid,r in b.iterrows():
  if (r.PA or 0)<300:continue
  adjustment=float(full_delta.loc[mid]/rpw)
  rows.append(dict(id=int(mid),name=r.get('PlayerName') or re.sub('<[^>]+>','',r.Name),team=str(r.get('TeamName') or ''),pos=str(r.get('position') or ''),pa=int(r.PA),fwar=round(float(r.WAR),4),dvwar=round(float(r.WAR)+adjustment,4),bip=round(adjustment,4)))
 out[str(year)]=sorted(rows,key=lambda r:(-r['dvwar'],r['id']))
 checks[str(year)]=dict(rows=len(rows),runs_per_win=float(rpw),full_league_adjustment_runs=float(full_delta.sum()),component_sha256=sha(path),fangraphs_sha256=sha(Path(fg.RAW)/f'fg_bat_{year}.json'))
meta=dict(model='DV WAR contact adjustment with full fielding',built='2026-10-29',dataThrough=2026,minimumPA=300,fieldingCredit=1,pitching='unchanged fWAR; hitter leaderboard only',note='fWAR plus half of expected minus actual contact value, centered per PA within each season. Published fielding, framing, baserunning, positional and replacement runs retain full credit.',validation='Retrospective team-transfer improvement; individual retrospective WAR superiority not established.')
args.output.parent.mkdir(parents=True,exist_ok=True)
args.output.write_text(json.dumps(dict(meta=meta,seasons=out),separators=(',',':'))+'\n')
(PACKAGE/'leaderboard_build.json').write_text(json.dumps(dict(builder_sha256=sha(__file__),attribution_source_sha256=sha(SOURCE/'attrib.py'),output_sha256=sha(args.output),checks=checks),indent=2)+'\n')
print(json.dumps({y:len(v) for y,v in out.items()}))
