"""Load original research modules with paths redirected to this audit's cache.

No locked file is edited. Path substitutions, source hashes and dependencies are
recorded with the results. Model/statistical logic remains in the original code.
"""
import hashlib
import os
from pathlib import Path
import sys
import types

HERE = Path(__file__).resolve().parent
ROOT = next((p for p in HERE.parents if (p/'public/research/value-war-2026-10-29').exists()), HERE)
DATA_ROOT = Path(os.environ.get('DV_WAR_SOURCE_ROOT', str(ROOT)))
INPUT = Path(os.environ.get('DV_WAR_AUDIT_INPUT', '/private/tmp/dv-war-audit-inputs'))
CACHE = INPUT / 'cache'
COMP = INPUT / 'comp'
for p in (INPUT, CACHE, COMP, INPUT / 'lb'):
    p.mkdir(parents=True, exist_ok=True)
SOURCE = HERE.parent / 'src_v1'
PUBLIC_REFERENCE = ROOT / 'public/research/value-war-2026-10-29'
if not SOURCE.exists():
    SOURCE = HERE / 'reference/src' if (HERE/'reference/src').exists() else PUBLIC_REFERENCE / 'src'
HASHES = {}


def reference(name):
    local=HERE.parent/name
    return local if local.exists() else HERE/'reference'/name if (HERE/'reference'/name).exists() else PUBLIC_REFERENCE/name


def original(name):
    path = SOURCE / (name + '.py')
    source = path.read_text()
    HASHES[str(path.relative_to(ROOT))] = hashlib.sha256(path.read_bytes()).hexdigest()
    source = source.replace("'/home/claude/war/cache'", repr(str(CACHE)))
    source = source.replace("'/home/claude/war/comp'", repr(str(COMP)))
    source = source.replace("'/home/claude/war/lb'", repr(str(INPUT / 'lb')))
    source = source.replace("'/mnt/user-data/uploads/Baseball/tmp/war'", repr(os.environ.get('DV_WAR_FG_DIR', str(DATA_ROOT / 'tmp/war'))))
    mod = types.ModuleType(name)
    mod.__file__ = str(path)
    sys.modules[name] = mod
    exec(compile(source, str(path), 'exec'), mod.__dict__)
    return mod


events = original('events')
attrib = original('attrib')
split = original('split')
season = original('season')
fg = original('fg')
dvwar = original('dvwar')
evalsplit = original('evalsplit')
