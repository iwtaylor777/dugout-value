"""Published FanGraphs season values keyed by MLBAM id (for season-level tests)."""
import json, numpy as np, pandas as pd
RAW = '/mnt/user-data/uploads/Baseball/tmp/war'
_c = {}


def fg(kind, y):
    k = (kind, y)
    if k not in _c:
        d = pd.DataFrame(json.load(open(f'{RAW}/fg_{kind}_{y}.json'))['data'])
        d = d[d['xMLBAMID'].notna()].copy(); d['id'] = d['xMLBAMID'].astype(np.int64)
        _c[k] = d.set_index('id')
    return _c[k]


def rates(y, pitch_col='WAR'):
    """Runs-per-opportunity rates from published WAR: hitters per PA (all of WAR incl. fielding), pitchers per TBF."""
    b = fg('bat', y); p = fg('pit', y)
    rpw_b = (b['RAR'].sum() / b['WAR'].sum())
    rpw_p = (p['RAR'].sum() / p['WAR'].sum())
    rb = (b['WAR'] * rpw_b / b['PA'].replace(0, np.nan)).fillna(0)
    rp = (p[pitch_col] * rpw_p / p['TBF'].replace(0, np.nan)).fillna(0)
    return rb.groupby(level=0).sum(), rp.groupby(level=0).sum(), pd.Series(dtype=float)
