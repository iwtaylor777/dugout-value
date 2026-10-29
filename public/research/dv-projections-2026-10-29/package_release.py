"""Verify the unchanged original model lock and package the corrected research files."""
import argparse, gzip, hashlib, io, json, tarfile
from pathlib import Path
ROOT=Path(__file__).resolve().parent
parser=argparse.ArgumentParser();parser.add_argument('--verify-only',action='store_true');args=parser.parse_args()
lock=json.loads((ROOT/'LOCK-MODEL-v1.json').read_text())
for name,sha in lock['code'].items():
    assert hashlib.sha256((ROOT/name).read_bytes()).hexdigest()==sha, f'Original locked source changed: {name}'
def files():
    return sorted(p for p in ROOT.rglob('*') if p.is_file() and '__pycache__' not in p.parts and p.name!='release-manifest.json' and p.suffix not in ('.pyc','.pyo'))
hashes={str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in files()}
manifest=ROOT/'release-manifest.json'
if args.verify_only:
    assert json.loads(manifest.read_text())['files']==hashes, 'Package manifest mismatch'
    print('Original v1 lock and corrected release manifest verified');raise SystemExit
manifest.write_text(json.dumps(dict(release='2026-10-29 forecast-origin correction',files=hashes),indent=2)+'\n')
archive=ROOT.with_suffix('.tar.gz');buffer=io.BytesIO()
with tarfile.open(fileobj=buffer,mode='w') as tar:
    for path in sorted(files()+[manifest]):
        info=tar.gettarinfo(str(path),arcname=f'{ROOT.name}/{path.relative_to(ROOT)}')
        info.uid=info.gid=0;info.uname=info.gname='';info.mtime=1793232000
        tar.addfile(info,io.BytesIO(path.read_bytes()))
with archive.open('wb') as f:
    with gzip.GzipFile(filename='',mode='wb',fileobj=f,mtime=0) as z:z.write(buffer.getvalue())
sha=hashlib.sha256(archive.read_bytes()).hexdigest()
Path(str(archive)+'.sha256').write_text(f'{sha}  {archive.name}\n')
print(f'Packaged {len(hashes)} files; original model lock verified; archive SHA-256 {sha}')
