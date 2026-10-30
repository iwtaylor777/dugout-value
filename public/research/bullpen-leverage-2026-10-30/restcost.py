"""Decision-time cost of low-leverage work for top relievers: high-leverage spots (entry LI >= 1.8) that went to a reliever
ranked 6th or lower on the day after one of the team's top two relievers pitched at entry LI < 1.0 (the usual rest rule
makes him unavailable). Value of the missed spot = stint LI-sum x (top reliever's value - used reliever's value), net of
yesterday's low-leverage stint, which someone else would have pitched (LI-sum x the same gap)."""
import numpy as np, pandas as pd
rows = []
for y in range(2021, 2027):
    t = pd.read_parquet(f'rel_{y}.parquet'); r = t[t.reliever & t['proj'].notna() & (t['proj'] < 6.5)].copy()
    st = r.groupby(['fld_team', 'game_pk', 'pitcher'], sort=False).agg(date=('game_date', 'first'), entry=('LI', 'first'), sli=('LI', 'sum'),
                                                                       v=('val_in', 'first'), proj=('proj', 'first')).reset_index()
    n = st.groupby(['fld_team', 'pitcher']).size().rename('apps').reset_index()
    rk = st.groupby(['fld_team', 'pitcher'])['proj'].first().reset_index().merge(n); rk = rk[rk.apps >= 25].sort_values(['fld_team', 'proj'])
    rk['rank'] = rk.groupby('fld_team').cumcount() + 1
    st = st.merge(rk[['fld_team', 'pitcher', 'rank']], on=['fld_team', 'pitcher'], how='left'); st['rank'] = st['rank'].fillna(99)
    for team, g in st.groupby('fld_team'):
        top = g[g['rank'] <= 2]; low = top[top.entry < 1.0]
        lowdays = {(p, d) for p, d in zip(low.pitcher, low.date)}
        topv = top.groupby('pitcher')['v'].first()
        cost = 0.0; k = 0; nlow = len(low)
        hi = g[(g.entry >= 1.8) & (g['rank'] >= 6)]
        for _, a in hi.iterrows():
            prev = a.date - pd.Timedelta(days=1)
            cands = [p for p in topv.index if (p, prev) in lowdays and not ((g.pitcher == p) & (g.game_pk == a.game_pk)).any()]
            if not cands: continue
            p = max(cands, key=lambda q: topv[q]); yday = low[(low.pitcher == p) & (low.date == prev)].iloc[0]
            gap = topv[p] - a.v
            cost += a.sli * gap - yday.sli * gap; k += 1
        rows.append(dict(season=y, team=team, low_apps_top2=nlow, conflicts=k, wins=cost / 10))
F = pd.DataFrame(rows); F.to_csv('restcost.csv', index=False)
print(F.groupby('season')[['low_apps_top2', 'conflicts', 'wins']].mean().round(3))
print('2021-26 mean wins per team', round(F.wins.mean(), 3), '| total per season', round(F.groupby('season').wins.sum().mean(), 2))
P = F.pivot(index='team', columns='season', values='low_apps_top2'); print('yoy corr of top-2 low-leverage appearances', np.round([P[[a, a + 1]].corr().iloc[0, 1] for a in range(2021, 2026)], 2))
print(F[F.season == 2026].sort_values('low_apps_top2', ascending=False)[['team', 'low_apps_top2', 'conflicts', 'wins']].head(6).round(2).to_string())
print(F[F.season == 2026].sort_values('low_apps_top2')[['team', 'low_apps_top2', 'conflicts', 'wins']].head(4).round(2).to_string())
