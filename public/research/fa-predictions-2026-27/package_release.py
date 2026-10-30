"""Verify the current forecast lock and package the dated estimates and source."""
from pathlib import Path
import argparse,gzip,hashlib,io,json,tarfile
ROOT=Path(__file__).resolve().parent
parser=argparse.ArgumentParser();parser.add_argument('--verify-only',action='store_true');args=parser.parse_args()
digest=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
lock=json.loads((ROOT/'LOCK-DV-20261029.json').read_text())
# The original October 29 snapshot now lives in archive/2026-10-29-dv-original/; revision R1 is the root table.
for name,sha in lock['files'].items():assert digest(ROOT/'archive/2026-10-29-dv-original'/name)==sha,f'Original forecast lock mismatch: {name}'
r1=json.loads((ROOT/'LOCK-DV-20261029-R1.json').read_text())
assert r1['base_lock']['LOCK-DV-20261029.json']==digest(ROOT/'LOCK-DV-20261029.json'),'R1 base lock mismatch'
for name,sha in r1['files'].items():assert digest(ROOT/'archive/2026-10-29-dv-r1'/name)==sha,f'R1 forecast lock mismatch: {name}'
for name,sha in r1['inputs'].items():assert digest(ROOT/'code/scripts'/name)==sha,f'R1 code mismatch: {name}'
# Revision R2 (age correction) is the root table.
r2=json.loads((ROOT/'LOCK-DV-20261029-R2.json').read_text())
assert r2['base_lock']['LOCK-DV-20261029-R1.json']==digest(ROOT/'LOCK-DV-20261029-R1.json'),'R2 base lock mismatch'
for name,sha in r2['files'].items():assert digest(ROOT/name)==sha,f'R2 forecast lock mismatch: {name}'
assert digest(ROOT/'code/scripts/revise-dv-free-agents-r2.mjs')==r2['inputs']['revise-dv-free-agents-r2.mjs'],'R2 code mismatch'
for p in (ROOT/'code').rglob('*'):
    if p.is_file() and p.name in lock['inputs']:assert digest(p)==lock['inputs'][p.name],f'Code input mismatch: {p.name}'
files=sorted(p for p in ROOT.rglob('*') if p.is_file() and '__pycache__' not in p.parts and p.name!='release-manifest.json' and p.suffix not in ('.pyc','.pyo'))
hashes={str(p.relative_to(ROOT)):digest(p) for p in files};manifest=ROOT/'release-manifest.json'
if args.verify_only:
    assert json.loads(manifest.read_text())['files']==hashes,'Release manifest mismatch'
    print('Current forecast lock, included source and manifest verified');raise SystemExit
manifest.write_text(json.dumps(dict(release='DV estimates recorded October 29, 2026, revisions R1 and R2',files=hashes),indent=2)+'\n')
buf=io.BytesIO()
with tarfile.open(fileobj=buf,mode='w') as tar:
    for p in sorted(files+[manifest]):
        info=tar.gettarinfo(str(p),arcname=f'{ROOT.name}/{p.relative_to(ROOT)}');info.uid=info.gid=0;info.uname=info.gname='';info.mtime=1793232000;tar.addfile(info,io.BytesIO(p.read_bytes()))
archive=ROOT.with_suffix('.tar.gz')
with archive.open('wb') as f:
    with gzip.GzipFile(filename='',mode='wb',fileobj=f,mtime=0) as z:z.write(buf.getvalue())
Path(str(archive)+'.sha256').write_text(f'{digest(archive)}  {archive.name}\n')
print('Packaged',len(files),'files; current forecast lock verified')
