"""Within-season reliability of team efficiency: random halves of each season's games (seeded by season)."""
import numpy as np, pandas as pd
def eff(g):
    n=g.groupby('pitcher').size(); v=g.groupby('pitcher')['val_pre'].first()
    o=v.sort_values(ascending=False); vals=np.repeat(o.values,n.reindex(o.index).values); lis=np.sort(g.LI.values)[::-1]
    best=(vals*lis).sum(); worst=(vals[::-1]*lis).sum(); act=(g.val_pre*g.LI).sum()
    return (act-worst)/(best-worst)
res=[]
for y in range(2021,2027):
    t=pd.read_parquet(f'rel_{y}.parquet'); r=t[t.reliever & t['proj'].notna() & (t['proj']<6.5)]
    gp=r.game_pk.unique(); rng=np.random.default_rng(y); half=set(rng.choice(gp,len(gp)//2,replace=False))
    for team,g in r.groupby('fld_team'): res.append((y,team,eff(g[g.game_pk.isin(half)]),eff(g[~g.game_pk.isin(half)])))
R=pd.DataFrame(res,columns=['y','team','a','b']); c=[R[R.y==y][['a','b']].corr().iloc[0,1] for y in range(2021,2027)]
print('split-half corr by year',np.round(c,2),'mean',round(np.mean(c),2))
