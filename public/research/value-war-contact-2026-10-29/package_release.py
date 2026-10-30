"""Build or verify this public, source-only research evidence release."""
from pathlib import Path
from datetime import datetime,timezone
import hashlib,json,sys,tarfile
ROOT=Path(__file__).resolve().parent
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def files():return sorted(p for p in ROOT.rglob('*') if p.is_file() and '__pycache__' not in p.parts and p.name!='release_manifest.json')
if len(sys.argv)>1 and sys.argv[1]=='verify':
 m=json.loads((ROOT/'release_manifest.json').read_text())
 for f,h in m['files'].items():assert sha(ROOT/f)==h,f
 assert set(m['files'])=={str(f.relative_to(ROOT)) for f in files()}
 print('Package verified:',len(m['files']),'files')
else:
 (ROOT/'release_manifest.json').write_text(json.dumps(dict(released_utc=datetime.now(timezone.utc).isoformat(),method='Contact batting adjustment; full fielding and pitching',status='Exploratory retrospective evidence; original research locks unchanged',files={str(f.relative_to(ROOT)):sha(f) for f in files()}),indent=2)+'\n')
 archive=ROOT.with_suffix('.tar.gz')
 with tarfile.open(archive,'w:gz') as tf:
  for f in files()+[ROOT/'release_manifest.json']:tf.add(f,arcname=ROOT.name+'/'+str(f.relative_to(ROOT)))
 archive.with_name(archive.name+'.sha256').write_text(sha(archive)+'  '+archive.name+'\n')
 print('Research release built:',sha(archive))
