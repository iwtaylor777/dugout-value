"""Original v1 reconstruction plus a fixed, distributed-outs fielding candidate."""
import json
import os
import pickle
import sys
import time

import lightgbm as lgb
import numpy as np
import pandas as pd

from runtime import COMP, INPUT, attrib, events, split


def distributed_fielding(pa, sprint, seed=0):
    b = pa.loc[pa.bip & (pa.cls != 'HR')].copy()
    loc = b.hit_location.fillna(0).astype(int).to_numpy()
    label = np.where((b.cls == 'OUT') & (b.outs_on_play > 0) & (loc >= 1) & (loc <= 9), loc, 0)
    parks = {t:i for i,t in enumerate(sorted(pa.home_team.unique()))}
    align = {'Standard':0, 'Strategic':1, 'Infield shift':2, 'Infield shade':3,
             '4th outfielder':4, 'Extreme outfield shift':5}
    X = np.c_[b.launch_speed, b.launch_angle, b.phi,
              b.batter.map(sprint).fillna(27), (b.stand == 'L').astype(float),
              b.home_team.map(parks), b.if_fielding_alignment.map(align),
              b.of_fielding_alignment.map(align)].astype(float)
    # Keep every pitch from a game in one fold for this candidate.
    games = b.game_pk.unique()
    fold_map = dict(zip(games, np.random.default_rng(seed + 500).integers(0, 4, len(games))))
    fold = b.game_pk.map(fold_map).to_numpy()
    prob = np.zeros((len(b),10))
    for k in range(4):
        tr,te = fold != k,fold == k
        m = lgb.LGBMClassifier(objective='multiclass', n_estimators=100,
             learning_rate=.05, num_leaves=15, min_child_samples=100,
             n_jobs=1, verbosity=-1, random_state=seed + 500)
        m.fit(X[tr], label[tr])
        prob[np.ix_(te,m.classes_.astype(int))] = m.predict_proba(X[te])
    hit = b.cls.isin(['1B','2B','3B','ROE'])
    rpo = float(b.loc[hit,'v'].mean() - b.loc[b.cls == 'OUT','v'].mean())
    pieces = []
    for pos in range(1,10):
        ids = b.pitcher if pos == 1 else b[f'fielder_{pos}']
        ids = ids.fillna(-1).astype(np.int64).to_numpy()
        credit = ((label == pos).astype(float) - prob[:,pos]) * rpo
        raw = pd.Series(credit,index=ids).groupby(level=0).sum()
        allids = pa.pitcher if pos == 1 else pa[f'fielder_{pos}']
        op = pd.Series(pa.outs_on_play.to_numpy(), index=allids.fillna(-1).astype(np.int64)).groupby(level=0).sum()
        valid = op.index >= 0
        op = op[valid]
        raw = raw.reindex(op.index).fillna(0)
        centered = raw - op * (raw.sum() / op.sum())
        pieces.append(pd.DataFrame({'outs':op,'r':centered,'r_raw':raw}))
    f = pd.concat(pieces).groupby(level=0).sum()
    diag = dict(n_chances=len(b), run_value_per_out=rpo,
        unknown_out_location=int(((b.cls == 'OUT') & (label == 0)).sum()),
        predicted_outs=float(prob[:,1:].sum()), actual_outs=int((label > 0).sum()),
        summed_centered_runs=float(f.r.sum()),
        position_multiclass_logloss=float(-np.log(np.clip(prob[np.arange(len(b)),label],1e-12,1)).mean()))
    return f,diag


def compute(year, split_index=None, half=None):
    name = f'{year}_full' if split_index is None else f'{year}_{split_index}_{half}'
    dest = COMP / (name + '.pkl')
    if dest.exists():
        print('CACHED',name,flush=True)
        return
    start = time.monotonic()
    pa,called = events.build(year)
    if split_index is not None:
        games = pa.game_pk.unique()
        hmap = dict(zip(games,split.half_of(games,split_index)))
        pa = pa.loc[pa.game_pk.map(hmap) == half].reset_index(drop=True)
        called = called.loc[called.game_pk.map(hmap) == half].reset_index(drop=True)
    sp = split.sprint_map(year)
    c = attrib.components(pa,called,sp,seed=split_index or 0)
    soft,diagnostic = distributed_fielding(c['pa'],sp,seed=split_index or 0)
    c['fld']['soft'] = soft.r.reindex(c['fld'].index).fillna(0)
    out = dict(bat=c['bat'],pit=c['pit'],fld=c['fld'],pt=split.playing_time(pa),diagnostic=diagnostic)
    with open(str(dest)+'.tmp','wb') as fh:
        pickle.dump(out,fh)
    os.replace(str(dest)+'.tmp',dest)
    print('COMPONENTS',name,round(time.monotonic()-start,1),diagnostic,flush=True)


if __name__ == '__main__':
    mode = sys.argv[1]
    for year in map(int,sys.argv[2:]):
        if mode == 'full':
            compute(year)
        else:
            for s in range(3):
                for h in (0,1):
                    compute(year,s,h)
