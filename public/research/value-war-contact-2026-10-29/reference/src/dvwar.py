"""Season-level WAR variants built on published fWAR, swapping only the attribution of runs.

DV WAR (hitters)  = fWAR + [(DV batting - FIP-style batting) + (lam_f-1)*(Fielding - CFraming) + (gam_c-1)*CFraming] / RPW
DV WAR (pitchers) = fWAR + (DV pitching - FIP-style pitching) * leverage / RPW
'ra9x' (rebuilt RA9 pitchers) = fWAR + (RA9-style - FIP-style) * leverage / RPW   (check against published RA9-WAR)
"""
import numpy as np, pandas as pd
import fg
from attrib import credit, DV0
from season import load_full


def season_war(y, prm=None, kind='dv'):
    q = dict(DV0, **(prm or {}))
    comp = load_full(y)
    fb, fp = fg.fg('bat', y), fg.fg('pit', y)
    rpw_b = fb['RAR'].sum() / fb['WAR'].sum(); rpw_p = fp['RAR'].sum() / fp['WAR'].sum()
    bat_f, pit_f, _ = credit(comp, 'fip')
    if kind == 'dv':
        bat_d, pit_d, _ = credit(comp, 'dv', q)
    elif kind == 'ra9x':
        bat_d, pit_d, _ = credit(comp, 'ra9')
    else:
        raise ValueError(kind)
    hb = fb[['PA', 'WAR', 'Fielding', 'CFraming']].groupby(level=0).sum()
    # center the attribution difference so league totals stay on fWAR's scale (unassigned shares go to nobody)
    dfull = bat_d - bat_f
    dfull = dfull - comp['bat']['PA'] * (dfull.sum() / comp['bat']['PA'].sum())
    dbat = dfull.reindex(hb.index).fillna(0)
    adj = dbat.copy()
    if kind == 'dv':
        nf = hb['Fielding'].fillna(0) - hb['CFraming'].fillna(0)
        adj = adj + (q['lam_f'] - 1) * (nf - nf.mean() * 0) + (q['gam_c'] - 1) * hb['CFraming'].fillna(0)
    hb['WAR_new'] = hb['WAR'] + adj / rpw_b
    hp = fp[['TBF', 'IP', 'WAR', 'RA9-Wins', 'G', 'GS', 'gmLI']].copy()
    hp['lev'] = np.where(hp['GS'] < hp['G'] / 2, (1 + hp['gmLI'].fillna(1)) / 2, 1.0)
    hp = hp.groupby(level=0).agg(dict(TBF='sum', IP='sum', WAR='sum', **{'RA9-Wins': 'sum'}, lev='mean'))
    pfull = pit_d - pit_f
    pfull = pfull - comp['pit']['BF'] * (pfull.sum() / comp['pit']['BF'].sum())
    dpit = pfull.reindex(hp.index).fillna(0)
    hp['WAR_new'] = hp['WAR'] + dpit * hp['lev'] / rpw_p
    return hb, hp, rpw_b, rpw_p


def rate_fn_factory(kind, prm=None, published=None):
    """Return rate_fn(y) giving runs-per-opportunity rates for season.transfer_rows / churn_rows."""
    def f(y):
        if published is not None:
            return fg.rates(y, published)
        hb, hp, rb, rp = season_war(y, prm, kind)
        return ((hb['WAR_new'] * rb / hb['PA'].replace(0, np.nan)).fillna(0),
                (hp['WAR_new'] * rp / hp['TBF'].replace(0, np.nan)).fillna(0), pd.Series(dtype=float))
    return f
