"""Who throws the first relief inning of the ninth, by situation, and the first relief appearance in extra innings (2021-26)."""
import numpy as np, pandas as pd
rows=[]
for y in range(2021,2027):
    t=pd.read_parquet(f'rel_{y}.parquet'); r=t[t.reliever & t['proj'].notna() & (t['proj']<6.5)].copy()
    st=r.groupby(['fld_team','game_pk','pitcher'],sort=False).agg(order=('at_bat_number','min'),inning=('inning','first'),tb=('inning_topbot','first'),entry=('LI','first'),margin=('margin','first'),proj=('proj','first')).reset_index()
    n=st.groupby(['fld_team','pitcher']).size().rename('apps').reset_index()
    rk=st.groupby(['fld_team','pitcher'])['proj'].first().reset_index().merge(n); rk=rk[rk.apps>=25].sort_values(['fld_team','proj']); rk['rank']=rk.groupby('fld_team').cumcount()+1
    st=st.merge(rk[['fld_team','pitcher','rank']],on=['fld_team','pitcher'],how='left'); st['rank']=st['rank'].fillna(99); rows.append(st)
S=pd.concat(rows); S['lead']=-S['margin']; S['home_fld']=S.tb=='Top'
f9=S[S.inning==9].sort_values('order').groupby(['fld_team','game_pk']).head(1)
for lab,c in (('save situation, lead 1-3',f9.lead.between(1,3)),('tied, home team pitching',(f9.lead==0)&f9.home_fld),('tied, road team pitching',(f9.lead==0)&~f9.home_fld),('lead 4+',f9.lead>=4),('trailing',f9.lead<0)):
    g=f9[c]; print(f'{lab:28} n={len(g):5d} top-2 share {(g["rank"]<=2).mean():.2f} mean entry LI {g.entry.mean():.2f}')
ex=S[S.inning>=10].sort_values('order').groupby(['fld_team','game_pk']).head(1)
print('first reliever in extras: top-2 share', round((ex['rank']<=2).mean(),2), 'mean entry LI', round(ex.entry.mean(),2), 'n', len(ex))
