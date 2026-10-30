"""Verify the current forecast lock and package the dated estimates and source."""
from pathlib import Path
import argparse,gzip,hashlib,io,json,tarfile
ROOT=Path(__file__).resolve().parent
parser=argparse.ArgumentParser();parser.add_argument('--verify-only',action='store_true');args=parser.parse_args()
digest=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
lock=json.loads((ROOT/'LOCK-DV-20261029.json').read_text())
for name,sha in lock['files'].items():assert digest(ROOT/name)==sha,f'Forecast lock mismatch: {name}'
for p in (ROOT/'code').rglob('*'):
    if p.is_file() and p.name in lock['inputs']:assert digest(p)==lock['inputs'][p.name],f'Code input mismatch: {p.name}'
files=sorted(p for p in ROOT.rglob('*') if p.is_file() and '__pycache__' not in p.parts and p.name!='release-manifest.json' and p.suffix not in ('.pyc','.pyo'))
hashes={str(p.relative_to(ROOT)):digest(p) for p in files};manifest=ROOT/'release-manifest.json'
if args.verify_only:
    assert json.loads(manifest.read_text())['files']==hashes,'Release manifest mismatch'
    print('Current forecast lock, included source and manifest verified');raise SystemExit
manifest.write_text(json.dumps(dict(release='DV estimates recorded October 29, 2026',files=hashes),indent=2)+'\n')
buf=io.BytesIO()
with tarfile.open(fileobj=buf,mode='w') as tar:
    for p in sorted(files+[manifest]):
        info=tar.gettarinfo(str(p),arcname=f'{ROOT.name}/{p.relative_to(ROOT)}');info.uid=info.gid=0;info.uname=info.gname='';info.mtime=1793232000;tar.addfile(info,io.BytesIO(p.read_bytes()))
archive=ROOT.with_suffix('.tar.gz')
with archive.open('wb') as f:
    with gzip.GzipFile(filename='',mode='wb',fileobj=f,mtime=0) as z:z.write(buf.getvalue())
Path(str(archive)+'.sha256').write_text(f'{digest(archive)}  {archive.name}\n')
print('Packaged',len(files),'files; current forecast lock verified')
