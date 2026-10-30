"""Check whether the batting gain depends on same-season sprint-speed inputs."""
import os
import pickle
import sys

import lightgbm as lgb
import numpy as np
import pandas as pd

from runtime import attrib, events, split, COMP


def compute(y,s,h):
    dest=COMP/f'{y}_{s}_{h}_prior_speed.pkl'
    if dest.exists():return
    pa,_=events.build(y)
    games=pa.game_pk.unique();hmap=dict(zip(games,split.half_of(games,s)))
    pa=pa.loc[pa.game_pk.map(hmap)==h].reset_index(drop=True)
    b=pa.loc[pa.bip].copy();sp=split.sprint_map(y-1)
    b['sprint']=b.batter.map(sp).fillna(np.nanmedian(list(sp.values()))-.5)
    parks={t:i for i,t in enumerate(sorted(pa.home_team.unique()))}
    bbc={'ground_ball':0,'line_drive':1,'fly_ball':2,'popup':3}
    X=np.c_[b.launch_speed,b.launch_angle,b.spray,b.sprint,(b.stand=='L').astype(float),
            b.home_team.map(parks),b.bb_type.map(bbc).astype(float)].astype(float)
    x=attrib.crossfit(lambda:lgb.LGBMRegressor(**attrib.LGB_REG,random_state=s),X,b.v.to_numpy(),seed=s)
    # Replace only BIP x/r. All non-BIP events, park adjustment and references
    # remain identical to the paired reconstruction for this sensitivity check.
    xx=pd.Series(x,index=b.batter).groupby(level=0).sum()
    actual=pd.Series(b.v.to_numpy(),index=b.batter).groupby(level=0).sum()
    with open(str(dest)+'.tmp','wb') as f:pickle.dump(dict(x=xx,r=actual-xx,prior_speed_year=y-1),f)
    os.replace(str(dest)+'.tmp',dest)
    print('PRIOR SPEED',y,s,h,flush=True)


if __name__=='__main__':
    for y in map(int,sys.argv[1:]):
        for s in range(3):
            for h in [0,1]:compute(y,s,h)
