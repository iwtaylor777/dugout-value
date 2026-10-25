from pathlib import Path
import hashlib,json,shutil,tarfile
ROOT=Path(__file__).resolve().parent
DEST=ROOT.parents[1]/'public/research/playing-time-opportunity-2026-10-21'
DEST.mkdir(parents=True,exist_ok=True)
for name in ['README.md','PROTOCOL.md','requirements.txt','model.py','score.py','replay.py','test_model_score.py','feasibility.md','validated-aggregates.json','metadata-anomalies.json']:
 shutil.copy2(ROOT/name,DEST/name)
for path in (ROOT/'results').glob('*.json'):shutil.copy2(path,DEST/path.name)
(DEST/'source-code').mkdir(exist_ok=True)
for name in ['fetch.py','normalize.py','run.py','package_release.py','test_normalize.py','validate_timing.py']:
 shutil.copy2(ROOT/name,DEST/'source-code'/name)
for path in (ROOT/'timing-evidence').rglob('*'):
 if path.is_file():
  target=DEST/'timing-evidence'/path.relative_to(ROOT/'timing-evidence');target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(path,target)
(DEST/'source-checks').mkdir(exist_ok=True)
for pattern in ['mayer-*','anthony-*','*mejia*','*teel*','*teams*','*anomaly*']:
 for path in (ROOT/'raw').glob(pattern):
  if path.is_file():shutil.copy2(path,DEST/'source-checks'/path.name)
files={str(p.relative_to(DEST)):hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(DEST.rglob('*')) if p.is_file() and p.name!='manifest.json' and '__pycache__' not in p.parts}
(DEST/'manifest.json').write_text(json.dumps(dict(published='2026-10-21',files=files),indent=2)+'\n')
archive=DEST.with_suffix('.tar.gz')
with tarfile.open(archive,'w:gz') as out:
 for name in [*files,'manifest.json']:out.add(DEST/name,arcname=f'{DEST.name}/{name}')
archive.with_suffix('.gz.sha256').write_text(hashlib.sha256(archive.read_bytes()).hexdigest()+'  '+archive.name+'\n')
print(archive,len(files),'files')
