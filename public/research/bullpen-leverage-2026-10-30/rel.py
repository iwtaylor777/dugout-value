"""Reliever PA tables 2021-2026 with LI and talent (DV preseason FIP, plus an in-season update)."""
import sys, pickle, numpy as np, pandas as pd
sys.path.insert(0, '/home/claude/pw/build/proj/src')
import dvp
from data import seasons
from feat_pit import fnum
from li import pa_table
L = pd.read_parquet('/home/claude/pw/bullpen/li_table.parquet')
D = seasons('pit')
fg2mlb = {}
for pid, h in D.items():
    for y, r in h.items():
        if r.get('xMLBAMID'): fg2mlb[pid] = int(r['xMLBAMID'])
def dv_fip(T):
    g = lambda t: pickle.load(open(f'/tmp/ef_p_base_pit_{t}_{T}.pkl', 'rb'))
    d, K, B, H = g('FIP'), g('Kip'), g('BBip'), g('HRip'); Lg = dvp.LP; an = lambda k: float(np.mean([Lg[T - i][k] for i in (1, 2, 3)]))
    return {fg2mlb[p]: .5 * (an('FIP') + 13 * (H[p] - an('HRip')) + 3 * (B[p] - an('BBip')) - 2 * (K[p] - an('Kip'))) + .5 * d[p] for p in d if p in fg2mlb}
OUTS = {'strikeout': 1, 'field_out': 1, 'force_out': 1, 'grounded_into_double_play': 2, 'double_play': 2, 'triple_play': 3, 'fielders_choice_out': 1,
        'sac_fly': 1, 'sac_bunt': 1, 'sac_fly_double_play': 2, 'sac_bunt_double_play': 2, 'strikeout_double_play': 2, 'fielders_choice': 0}
def build(y):
    t = pa_table(y).merge(L[['inn', 'inning_topbot', 'margin', 'outs_when_up', 'base', 'LI']], on=['inn', 'inning_topbot', 'margin', 'outs_when_up', 'base'], how='left')
    t = t.sort_values(['game_pk', 'at_bat_number']).reset_index(drop=True)
    first = t.groupby(['game_pk', 'fld_team'])['pitcher'].transform('first')
    t['reliever'] = t['pitcher'] != first
    ev = t['events'].fillna('')
    t['K'] = ev.str.startswith('strikeout').astype(int); t['BBH'] = ev.isin(['walk', 'hit_by_pitch', 'intent_walk']).astype(int)
    t['HR'] = (ev == 'home_run').astype(int); t['outs'] = ev.map(OUTS).fillna(0)
    proj = dv_fip(y); t['proj'] = t['pitcher'].map(proj)
    lgF = dvp.LP[y]['FIP']; t['lgFIP'] = lgF
    # league FIP constant for the in-season FIP-to-date
    c = lgF - (13 * t['HR'].sum() + 3 * t['BBH'].sum() - 2 * t['K'].sum()) / (t['outs'].sum() / 3)
    # in-season talent: season-to-date FIP (all appearances, any team) before this game, blended with projection (60 IP prior)
    t['game_date'] = pd.to_datetime(t['game_date'])
    daily = t.groupby(['pitcher', 'game_date'])[['K', 'BBH', 'HR', 'outs']].sum().groupby(level=0).cumsum().groupby(level=0).shift(1).fillna(0).reset_index()
    daily.columns = ['pitcher', 'game_date', 'cK', 'cBBH', 'cHR', 'couts']
    t = t.merge(daily, on=['pitcher', 'game_date'], how='left')
    ip = t['couts'] / 3; fip_td = np.where(ip > 0, (13 * t['cHR'] + 3 * t['cBBH'] - 2 * t['cK']) / ip.replace(0, np.nan) + c, np.nan)
    wgt = ip / (ip + 60); t['tal_in'] = np.where(ip > 0, wgt * fip_td + (1 - wgt) * t['proj'], t['proj'])
    t['val_pre'] = (lgF - t['proj']) / 9 / 4.25; t['val_in'] = (lgF - t['tal_in']) / 9 / 4.25
    return t
if __name__ == '__main__':
    for y in range(2021, 2027):
        t = build(y); t.to_parquet(f'/home/claude/pw/bullpen/rel_{y}.parquet', index=False)
        r = t[t.reliever]; print(y, 'relief PAs', len(r), 'with projection', round(r['proj'].notna().mean(), 3), 'mean LI relief', round(r['LI'].mean(), 3), 'starters', round(t[~t.reliever]['LI'].mean(), 3), flush=True)
