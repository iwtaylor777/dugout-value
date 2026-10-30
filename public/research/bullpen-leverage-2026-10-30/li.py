"""Empirical leverage index by game state from Statcast win-expectancy changes; per-PA tables for every season."""
import pandas as pd, numpy as np, os
C = '/home/claude/war/cache'
COLS = ['game_date', 'game_pk', 'at_bat_number', 'pitch_number', 'inning', 'inning_topbot', 'pitcher', 'batter', 'home_team', 'away_team',
        'bat_score', 'fld_score', 'outs_when_up', 'on_1b', 'on_2b', 'on_3b', 'delta_home_win_exp', 'events', 'p_throws', 'stand', 'delta_run_exp', 'post_bat_score']
def pa_table(y):
    f = f'/home/claude/pw/bullpen/pa_{y}.parquet'
    if os.path.exists(f): return pd.read_parquet(f)
    p = pd.read_parquet(f'{C}/pitches_{y}.parquet', columns=COLS)
    k = ['game_pk', 'at_bat_number']
    g = p.groupby(k, sort=False)
    first = g.head(1).set_index(k)
    d = g['delta_home_win_exp'].sum(); rx = g['delta_run_exp'].sum(); ev = g['events'].last(); ps = g['post_bat_score'].max()
    t = first[['game_date', 'inning', 'inning_topbot', 'pitcher', 'batter', 'home_team', 'away_team', 'bat_score', 'fld_score', 'outs_when_up', 'on_1b', 'on_2b', 'on_3b', 'p_throws', 'stand']].copy()
    t['dwe'] = d; t['dre'] = rx; t['events'] = ev; t['runs'] = ps - t['bat_score']
    t = t.reset_index()
    t['fld_team'] = np.where(t['inning_topbot'] == 'Top', t['home_team'], t['away_team'])
    t['margin'] = (t['bat_score'] - t['fld_score']).clip(-4, 4)
    t['inn'] = t['inning'].clip(upper=10)
    t['base'] = t['on_1b'] + 2 * t['on_2b'] + 4 * t['on_3b']
    t['season'] = y
    t.to_parquet(f, index=False); return t
def li_table(years):
    T = pd.concat([pa_table(y)[['inn', 'inning_topbot', 'margin', 'outs_when_up', 'base', 'dwe']] for y in years])
    T['a'] = T['dwe'].abs(); mean = T['a'].mean()
    key = ['inn', 'inning_topbot', 'margin', 'outs_when_up', 'base']
    full = T.groupby(key)['a'].agg(['mean', 'size']).reset_index()
    T['innp'] = np.where(T['inn'] <= 6, 0, T['inn'])
    kp = ['innp', 'inning_topbot', 'margin', 'outs_when_up', 'base']
    pool = T.groupby(kp)['a'].agg(['mean', 'size']).reset_index().rename(columns={'mean': 'pmean', 'size': 'psize'})
    full['innp'] = np.where(full['inn'] <= 6, 0, full['inn'])
    full = full.merge(pool, on=kp, how='left')
    full['LI'] = np.where(full['size'] >= 200, full['mean'], full['pmean']) / mean
    return full[key + ['LI', 'size']], mean
if __name__ == '__main__':
    yrs = [y for y in range(2015, 2027) if y != 2020]
    for y in range(2015, 2027): pa_table(y); print(y, flush=True)
    L, m = li_table(yrs); L.to_parquet('/home/claude/pw/bullpen/li_table.parquet', index=False)
    print('mean |dWE|', round(m, 4), 'cells', len(L), 'cells <200', int((L['size'] < 200).sum()))
    # sanity: classic states
    q = lambda inn, tb, mg, o, b: float(L[(L.inn == inn) & (L.inning_topbot == tb) & (L.margin == mg) & (L.outs_when_up == o) & (L.base == b)]['LI'].iloc[0])
    print('1st inning top, tied, 0 out, empty', round(q(1, 'Top', 0, 0, 0), 2))
    print('9th bottom, down 1, 2 out, bases loaded', round(q(9, 'Bot', -1, 2, 7), 2))
    print('9th top (fielding team up 1 -> batting margin -1), 0 out, empty', round(q(9, 'Top', -1, 0, 0), 2))
    print('9th top, batting team down 4, 0 out, empty', round(q(9, 'Top', -4, 0, 0), 2))
