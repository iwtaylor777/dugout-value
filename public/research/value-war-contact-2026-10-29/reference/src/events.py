"""Season event tables built from Statcast pitch data.

load_season(y) -> pitches DataFrame (regular season, sorted)
build(y)       -> dict with 'pa' (one row per plate appearance) and 'called' (called pitches),
                  plus helpers. Run values are computed within the season from the data itself.
"""
import glob, os, numpy as np, pandas as pd

SC = os.environ.get('SC_DIR', '/home/claude/war/sc')
CACHE = '/home/claude/war/cache'
os.makedirs(CACHE, exist_ok=True)

EVENT_CLASS = {
    'single': '1B', 'double': '2B', 'triple': '3B', 'home_run': 'HR',
    'walk': 'BB', 'intent_walk': 'IBB', 'hit_by_pitch': 'HBP',
    'strikeout': 'K', 'strikeout_double_play': 'K',
    'field_out': 'OUT', 'force_out': 'OUT', 'grounded_into_double_play': 'OUT', 'double_play': 'OUT',
    'triple_play': 'OUT', 'fielders_choice_out': 'OUT', 'fielders_choice': 'OUT', 'sac_fly': 'OUT',
    'sac_bunt': 'OUT', 'sac_fly_double_play': 'OUT', 'sac_bunt_double_play': 'OUT',
    'field_error': 'ROE', 'catcher_interf': 'CI',
}
NONBIP = {'BB', 'IBB', 'HBP', 'K', 'CI'}


def load_season(y):
    f = f'{CACHE}/pitches_{y}.parquet'
    if os.path.exists(f):
        return pd.read_parquet(f)
    if not glob.glob(f'{SC}/{y}/{y}-10-06.parquet*'):
        raise RuntimeError(f'{y} download not complete')
    fs = sorted(glob.glob(f'{SC}/{y}/*.parquet'))
    df = pd.concat([pd.read_parquet(x) for x in fs], ignore_index=True)
    df = df.drop_duplicates(['game_pk', 'at_bat_number', 'pitch_number'])
    df = df.sort_values(['game_pk', 'at_bat_number', 'pitch_number']).reset_index(drop=True)
    for c in ('on_1b', 'on_2b', 'on_3b'):
        df[c] = df[c].notna().astype(np.int8)
    df.to_parquet(f, index=False)
    return df


def _state(df):
    return df['outs_when_up'].astype(int) * 8 + df['on_1b'] * 1 + df['on_2b'] * 2 + df['on_3b'] * 4


def build(y):
    f = f'{CACHE}/pa_{y}.parquet'
    g = f'{CACHE}/called_{y}.parquet'
    if os.path.exists(f) and os.path.exists(g):
        return pd.read_parquet(f), pd.read_parquet(g)
    p = load_season(y)
    p['half'] = p['inning'].astype(int) * 2 + (p['inning_topbot'] == 'Bot').astype(int)
    p['st'] = _state(p)
    # first and last pitch of each PA
    key = ['game_pk', 'at_bat_number']
    first = p.groupby(key, sort=False).head(1)[key + ['st', 'bat_score']].rename(columns={'st': 'st0', 'bat_score': 'score0'})
    last = p[p['events'].notna()].groupby(key, sort=False).tail(1).copy()
    last = last.merge(first, on=key, how='left')
    last['cls'] = last['events'].map(EVENT_CLASS)
    last = last.sort_values(['game_pk', 'at_bat_number']).reset_index(drop=True)
    # next PA in the same half-inning: its first-pitch state and score
    nxt = last[['game_pk', 'half', 'st0', 'score0']].shift(-1)
    same = (nxt['game_pk'] == last['game_pk']) & (nxt['half'] == last['half'])
    # end-of-half-inning batting score (max post score in the half-inning)
    hend = p.groupby(['game_pk', 'half'])['post_bat_score'].max().rename('half_end')
    last = last.join(hend, on=['game_pk', 'half'])
    last['st_end'] = np.where(same, nxt['st0'], 24)   # 24 = three outs
    last['score_end'] = np.where(same, nxt['score0'], last['half_end'])
    # run expectancy by state, from the last-pitch state of each PA (state the event happened in)
    last['st'] = _state(last)
    complete = ~((last['inning'] >= 9) & (last['inning_topbot'] == 'Bot'))
    re = (last.loc[complete, 'half_end'] - last.loc[complete, 'bat_score']).groupby(last.loc[complete, 'st']).mean()
    RE = np.zeros(25); RE[re.index.values] = re.values
    last['runs'] = last['score_end'] - last['bat_score']
    last['re24'] = RE[last['st_end'].astype(int)] - RE[last['st'].astype(int)] + last['runs']
    last = last[last['cls'].notna()].copy()
    # linear weights: mean RE24 by event class; centered so the league PA averages zero
    lw = last.groupby('cls')['re24'].mean()
    last['lw'] = last['cls'].map(lw)
    mu = last['lw'].mean()
    last['v'] = last['lw'] - mu                      # context-neutral run value, batter perspective
    last['re24c'] = last['re24'] - last['re24'].mean()  # context-dependent run value
    last['bip'] = ~last['cls'].isin(NONBIP)
    # spray angle in degrees, positive toward the batter's pull side
    phi = np.degrees(np.arctan2(last['hc_x'] - 125.42, 198.27 - last['hc_y']))
    last['spray'] = np.where(last['stand'] == 'L', phi, -phi)
    last['phi'] = phi
    last['home'] = np.where(last['inning_topbot'] == 'Top', last['home_team'], last['away_team'])
    last['bat_team'] = np.where(last['inning_topbot'] == 'Top', last['away_team'], last['home_team'])
    last['fld_team'] = np.where(last['inning_topbot'] == 'Top', last['home_team'], last['away_team'])
    last['outs_on_play'] = np.where(last['st_end'] == 24, 3 - last['outs_when_up'],
                                    (last['st_end'] // 8) - last['outs_when_up']).clip(0, 3)
    last.attrs['lw'] = lw.to_dict()
    keep = ['game_pk', 'game_date', 'at_bat_number', 'half', 'inning', 'inning_topbot', 'batter', 'pitcher',
            'stand', 'p_throws', 'home_team', 'away_team', 'bat_team', 'fld_team', 'cls', 'events', 'bb_type',
            'hit_location', 'launch_speed', 'launch_angle', 'hit_distance_sc', 'hc_x', 'hc_y', 'spray', 'phi',
            'if_fielding_alignment', 'of_fielding_alignment', 'outs_when_up', 'st', 'st_end', 'runs',
            're24', 're24c', 'lw', 'v', 'bip', 'outs_on_play', 'bat_score', 'fld_score',
            'fielder_2', 'fielder_3', 'fielder_4', 'fielder_5', 'fielder_6', 'fielder_7', 'fielder_8', 'fielder_9',
            'estimated_woba_using_speedangle']
    pa = last[keep].reset_index(drop=True)
    pa.to_parquet(f, index=False)
    # count values V(b,s): mean PA value of PAs that passed through each count
    pc = p[['game_pk', 'at_bat_number', 'balls', 'strikes']].drop_duplicates()
    pc = pc.merge(pa[['game_pk', 'at_bat_number', 'v']], on=['game_pk', 'at_bat_number'])
    pc = pc[(pc['balls'] <= 3) & (pc['strikes'] <= 2)]
    V = pc.groupby(['balls', 'strikes'])['v'].mean().to_dict()
    vK, vBB = pa.loc[pa['cls'] == 'K', 'v'].mean(), pa.loc[pa['cls'] == 'BB', 'v'].mean()
    def after(b, s, strike):
        if strike: return vK if s == 2 else V[(b, s + 1)]
        return vBB if b == 3 else V[(b + 1, s)]
    called = p[p['description'].isin(['called_strike', 'ball', 'blocked_ball'])].copy()
    called = called[(called['balls'] <= 3) & (called['strikes'] <= 2)]
    called['is_strike'] = (called['description'] == 'called_strike').astype(np.int8)
    cv = {(b, s): after(b, s, False) - after(b, s, True) for b in range(4) for s in range(3)}
    called['strike_value'] = [cv[(b, s)] for b, s in zip(called['balls'], called['strikes'])]  # runs saved by a strike vs a ball
    called['zn'] = (called['plate_z'] - called['sz_bot']) / (called['sz_top'] - called['sz_bot'])
    called['catcher'] = called['fielder_2']
    called['fld_team'] = np.where(called['inning_topbot'] == 'Top', called['home_team'], called['away_team'])
    called = called[['game_pk', 'at_bat_number', 'pitch_number', 'batter', 'pitcher', 'catcher', 'fld_team', 'stand', 'p_throws',
                     'balls', 'strikes', 'plate_x', 'plate_z', 'zn', 'sz_top', 'sz_bot', 'is_strike', 'strike_value', 'home_team']]
    called = called.dropna(subset=['plate_x', 'zn']).reset_index(drop=True)
    called.to_parquet(g, index=False)
    return pa, called


if __name__ == '__main__':
    import sys
    for y in map(int, sys.argv[1:]):
        pa, called = build(y)
        print(y, len(pa), 'PA', len(called), 'called', 'BIP', int(pa['bip'].sum()),
              'lw', pa.groupby('cls')['lw'].first().round(3).to_dict())
