"""Portable input locations without changing the hash-locked v1 source files."""
import os
from pathlib import Path
import sys
import math

PACKAGE = Path(__file__).resolve().parents[1]

def innings_to_decimal(value):
    """Historical FG leaderboards encode outs after the decimal point: 174.2 = 174 + 2/3."""
    if value is None: return None
    value=float(value)
    if not math.isfinite(value): return value
    whole=math.floor(value); outs=round((value-whole)*10)
    if outs not in (0,1,2) or abs(value-(whole+outs/10))>1e-6:
        raise ValueError(f'Not historical baseball-notation innings: {value}')
    return whole+outs/3

def configure(normalize_ip=False):
    sys.path.insert(0, str(PACKAGE / 'model-v1'))
    import data, milb
    for module, attr, variable in ((data, 'RAW', 'DV_RAW_DIR'),
                                   (data, 'ARCH', 'DV_ARCHIVE_DIR'),
                                   (milb, 'DIR', 'DV_MILB_DIR')):
        if os.environ.get(variable):
            setattr(module, attr, str(Path(os.environ[variable]).resolve()) + os.sep)
    if normalize_ip and not getattr(data, '_dv_decimal_innings', False):
        for history in data.seasons('pit').values():
            for row in history.values():
                row['IP']=innings_to_decimal(row.get('IP'))
        data._dv_decimal_innings=True
        data._cache.pop('lg_pit',None)
        if 'dvp' in sys.modules:
            module=sys.modules['dvp']; fresh=module.lg_pit()
            module.LP.clear(); module.LP.update(fresh)

def training_years(start, target, horizon, cutoff=None):
    """Training labels must exist at the forecast origin, including at h > 1."""
    if horizon < 1:
        raise ValueError('horizon must be positive')
    origin = target - horizon
    cutoff = origin if cutoff is None else cutoff
    if cutoff > origin:
        raise ValueError('training cutoff is after the forecast origin')
    return range(start + horizon - 1, min(target, cutoff + 1))
