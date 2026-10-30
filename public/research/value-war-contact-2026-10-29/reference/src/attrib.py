"""Per-player credit components for a set of games.

components(pa, called, sprint) fits the event models on exactly these games (cross-fitted)
and returns per-player component sums from which every framework's credit is a linear combination.
"""
import numpy as np, pandas as pd, lightgbm as lgb, warnings
warnings.filterwarnings('ignore')

LGB_REG = dict(objective='regression', n_estimators=250, learning_rate=0.05, num_leaves=31,
               min_child_samples=40, subsample=0.8, subsample_freq=1, colsample_bytree=0.9, verbose=-1, n_jobs=1)
LGB_CLF = dict(objective='binary', n_estimators=200, learning_rate=0.08, num_leaves=63,
               min_child_samples=50, verbose=-1, n_jobs=1)


def crossfit(model_fn, X, y, folds=4, seed=0, proba=False):
    rng = np.random.default_rng(seed)
    fold = rng.integers(0, folds, len(y))
    out = np.zeros(len(y))
    for k in range(folds):
        tr, te = fold != k, fold == k
        m = model_fn().fit(X[tr], y[tr])
        out[te] = m.predict_proba(X[te])[:, 1] if proba else m.predict(X[te])
    return out


def responsible_fielder(b):
    """Position number (1-9) responsible for each ball in play; 0 for home runs / unknown."""
    loc = b['hit_location'].fillna(0).astype(int).values
    bt = b['bb_type'].fillna('').values
    phi = b['phi'].values
    pos = loc.copy()
    gb = (bt == 'ground_ball')
    # ground balls that reached the outfield: infielder by spray angle (phi < 0 = third-base side)
    through = gb & (loc >= 7)
    z = np.select([phi < -22, phi < 0, phi < 22], [5, 6, 4], 3)
    pos = np.where(through, z, pos)
    # air balls with no recorded fielder: outfielder by spray
    air = (~gb) & (pos == 0)
    oz = np.select([phi < -15, phi <= 15], [7, 8], 9)
    pos = np.where(air & ~np.isnan(phi), oz, pos)
    pos = np.where(b['cls'].values == 'HR', 0, pos)
    return pos


def components(pa, called, sprint, seed=0):
    pa = pa.copy()
    # ---- park effect per PA: half the home-minus-road difference in mean run value, same games
    home_mean = pa.groupby('home_team')['v'].mean()
    road = pd.concat([pa.loc[pa['home_team'] != pa['bat_team'], ['bat_team', 'v']].rename(columns={'bat_team': 't'}),
                      pa.loc[pa['home_team'] != pa['fld_team'], ['fld_team', 'v']].rename(columns={'fld_team': 't'})])
    road_mean = road.groupby('t')['v'].mean()
    pe = (0.5 * (home_mean - road_mean.reindex(home_mean.index))).fillna(0)
    pa['pe'] = pa['home_team'].map(pe).fillna(0).values
    # ---- expected run value of each ball in play (cross-fitted)
    b = pa[pa['bip']].copy()
    b['sprint'] = b['batter'].map(sprint).fillna(np.nanmedian(list(sprint.values())) - 0.5 if sprint else 27.0)
    parks = {t: i for i, t in enumerate(sorted(pa['home_team'].unique()))}
    bbc = {'ground_ball': 0, 'line_drive': 1, 'fly_ball': 2, 'popup': 3}
    X = np.c_[b['launch_speed'], b['launch_angle'], b['spray'], b['sprint'], (b['stand'] == 'L').astype(float),
              b['home_team'].map(parks), b['bb_type'].map(bbc).astype(float)]
    b['x'] = crossfit(lambda: lgb.LGBMRegressor(**LGB_REG, random_state=seed), X, b['v'].values, seed=seed)
    b['r'] = b['v'] - b['x']
    mbip = b['v'].mean()
    m_nonhr = b.loc[b['cls'] != 'HR', 'v'].mean()
    pa['x'] = np.nan; pa.loc[b.index, 'x'] = b['x']; pa['r'] = 0.0; pa.loc[b.index, 'r'] = b['r']
    # ---- responsible fielder
    pos = responsible_fielder(b)
    fcols = {k: f'fielder_{k}' for k in range(2, 10)}
    fid = np.full(len(b), -1, dtype=np.int64)
    for k, c in fcols.items():
        m = pos == k
        fid[m] = b[c].values[m].astype(np.int64)
    fid[pos == 1] = b['pitcher'].values[pos == 1]
    b['fid'] = fid
    # ---- framing (cross-fitted strike probability)
    c = called.copy()
    Xc = np.c_[c['plate_x'], c['zn'], (c['stand'] == 'L').astype(float), (c['p_throws'] == 'L').astype(float),
               c['balls'], c['strikes'], c['sz_top'] - c['sz_bot']]
    c['p'] = crossfit(lambda: lgb.LGBMClassifier(**LGB_CLF, random_state=seed), Xc, c['is_strike'].values, seed=seed, proba=True)
    c['frm'] = (c['is_strike'] - c['p']) * c['strike_value']   # runs saved by the defense
    # ---- batter components (batting-team perspective)
    pa['nonbip_v'] = np.where(pa['bip'], 0.0, pa['v'])
    pa['xc'] = np.where(pa['bip'], pa['x'], 0.0)
    pa['seq'] = pa['re24c'] - pa['v']
    G = pa.groupby('batter')
    bat = pd.DataFrame({'PA': G.size(), 'nonbip': G['nonbip_v'].sum(), 'x': G['xc'].sum(), 'r': G['r'].sum(),
                        'seq': G['seq'].sum(), 'park': G['pe'].sum()})
    # ---- pitcher components (runs saved)
    pa['is_hr'] = pa['cls'] == 'HR'
    pa['bip_nonhr'] = pa['bip'] & ~pa['is_hr']
    pa['hr_v'] = np.where(pa['is_hr'], pa['v'], 0.0)
    pa['xdev'] = np.where(pa['bip'], pa['x'] - mbip, 0.0)
    pa['xdev_hr'] = np.where(pa['is_hr'], pa['x'] - mbip, 0.0)
    pa['r_hr'] = np.where(pa['is_hr'], pa['r'], 0.0)
    frm_p = c.groupby('pitcher')['frm'].sum()
    G = pa.groupby('pitcher')
    pit = pd.DataFrame({'BF': G.size(), 'nonbip': -G['nonbip_v'].sum(), 'hr': -G['hr_v'].sum(),
                        'n_bipnonhr': G['bip_nonhr'].sum(), 'n_bip': G['bip'].sum(),
                        'xdev': -G['xdev'].sum(), 'r': -G['r'].sum(),
                        'xdev_hr': -G['xdev_hr'].sum(), 'r_hr': -G['r_hr'].sum(), 'seq': -G['seq'].sum(), 'park': G['pe'].sum()})
    pit['bip_avg_fip'] = -pit['n_bipnonhr'] * m_nonhr
    pit['bip_avg'] = -pit['n_bip'] * mbip
    pit['frm'] = frm_p.reindex(pit.index).fillna(0)
    # team fielding per ball in play (full credit), charged to pitchers by their BIP with each team
    b['fr'] = -b['r']
    tf = b[b['fid'] >= 0].groupby('fld_team')['fr'].sum() / b.groupby('fld_team').size()
    pb = pa[pa['bip']].groupby(['pitcher', 'fld_team']).size().rename('n').reset_index()
    pb['tf'] = pb['fld_team'].map(tf).fillna(0) * pb['n']
    pit['teamfld'] = pb.groupby('pitcher')['tf'].sum().reindex(pit.index).fillna(0)
    # ---- fielder components: outs on the field as playing time, credit centered within position
    outs = []
    for k in range(2, 10):
        outs.append(pa[[f'fielder_{k}', 'outs_on_play']].rename(columns={f'fielder_{k}': 'id'}).assign(pos=k))
    outs.append(pa[['pitcher', 'outs_on_play']].rename(columns={'pitcher': 'id'}).assign(pos=1))
    outs = pd.concat(outs)
    outs['id'] = outs['id'].astype(np.int64)
    op = outs.groupby(['id', 'pos'])['outs_on_play'].sum()
    bb = b[b['fid'] >= 0].assign(pos=pos[b['fid'].values >= 0])
    rp = bb.groupby(['fid', 'pos'])['fr'].sum()
    rp.index = rp.index.set_names(['id', 'pos'])
    posrate = bb.groupby('pos')['fr'].sum() / op.groupby('pos').sum()
    exp = op * op.index.get_level_values('pos').map(posrate).fillna(0).values
    cen = rp.reindex(op.index).fillna(0) - exp
    fld = pd.DataFrame({'outs': op.groupby('id').sum()})
    fld['r'] = cen.groupby('id').sum().reindex(fld.index).fillna(0)
    fld['r_raw'] = rp.groupby('id').sum().reindex(fld.index).fillna(0)
    fld['frm'] = c.groupby('catcher')['frm'].sum().reindex(fld.index).fillna(0)
    fld.index = fld.index.astype(np.int64)
    return dict(bat=bat, pit=pit, fld=fld, pa=pa)


# ---------------- frameworks as linear combinations ----------------
DV0 = dict(lam_b=1.0, sig_b=0.0, kap=1.0, lam_p=0.0, kap_hr=1.0, lam_hr=1.0, sig_p=0.0, gam_p=0.0, lam_f=1.0, gam_c=1.0)


def credit(comp, fw, prm=None):
    """Return (bat runs, pit runs saved, fld runs saved) Series for framework fw."""
    B, P, F = comp['bat'], comp['pit'], comp['fld']
    if fw in ('fip', 'ra9'):
        bat = B['nonbip'] + B['x'] + B['r'] - B['park']
        fld = F['r'] + F['frm']
        if fw == 'fip':
            pit = P['nonbip'] + P['hr'] + P['bip_avg_fip'] + P['park']
        else:
            pit = P['nonbip'] + P['bip_avg'] + P['xdev'] + P['r'] + P['seq'] - P['teamfld'] + P['park']
    else:
        q = dict(DV0, **(prm or {}))
        bat = B['nonbip'] + B['x'] + q['lam_b'] * B['r'] + q['sig_b'] * B['seq'] - B['park']
        mbip = -P['bip_avg'].sum() / P['n_bip'].sum()
        mnon = -P['bip_avg_fip'].sum() / P['n_bipnonhr'].sum()
        n_hr = P['n_bip'] - P['n_bipnonhr']
        sx_non = (P['xdev'] - P['xdev_hr']) - P['n_bipnonhr'] * (mbip - mnon)
        pit = (P['nonbip'] + P['bip_avg_fip'] + q['kap'] * sx_non + q['lam_p'] * (P['r'] - P['r_hr'])
               - n_hr * mbip + q['kap_hr'] * P['xdev_hr'] + q['lam_hr'] * P['r_hr'] + q['sig_p'] * P['seq']
               - q['gam_p'] * P['frm'] + P['park'])
        fld = q['lam_f'] * F['r'] + q['gam_c'] * F['frm']
    return bat, pit, fld
