"""Portable input locations without changing the hash-locked v1 source files."""
import os
from pathlib import Path
import sys

PACKAGE = Path(__file__).resolve().parents[1]

def configure():
    sys.path.insert(0, str(PACKAGE / 'model-v1'))
    import data, milb
    for module, attr, variable in ((data, 'RAW', 'DV_RAW_DIR'),
                                   (data, 'ARCH', 'DV_ARCHIVE_DIR'),
                                   (milb, 'DIR', 'DV_MILB_DIR')):
        if os.environ.get(variable):
            setattr(module, attr, str(Path(os.environ[variable]).resolve()) + os.sep)

def training_years(start, target, horizon, cutoff=None):
    """Training labels must exist at the forecast origin, including at h > 1."""
    if horizon < 1:
        raise ValueError('horizon must be positive')
    origin = target - horizon
    cutoff = origin if cutoff is None else cutoff
    if cutoff > origin:
        raise ValueError('training cutoff is after the forecast origin')
    return range(start + horizon - 1, min(target, cutoff + 1))
