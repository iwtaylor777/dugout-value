"""Hypothesis check: is bullpen efficiency driven by (a) whether the closer happens to be the best arm (roster) or
(b) how well a team matches talent to leverage before the ninth (in-game decisions)? Which part persists year to year?"""
import numpy as np, pandas as pd
def wcorr(x, y, w):
    mx, my = np.average(x, weights=w), np.average(y, weights=w)
    return np.average((x-mx)*(y-my), weights=w)/np.sqrt(np.average((x-mx)**2, weights=w)*np.average((y-my)**2, weights=w))
M = pd.read_csv('team_metrics.csv'); rows = []
for y in range(2021, 2027):
    t = pd.read_parquet(f'rel_{y}.parquet'); r = t[t.reliever & t['proj'].notna() & (t['proj'] < 6.5)].copy()
    ent = r[~r.duplicated(['game_pk', 'pitcher'])].copy()          # one row per relief appearance: entry state
    ent['lead'] = -ent['margin']                                     # fielding team's lead
    for team, g in ent.groupby('fld_team'):
        e9 = g[(g.inning == 9) & (g.lead.between(1, 3))]           # save situations
        closer = e9['pitcher'].value_counts().idxmax() if len(e9) else None
        cnt = g['pitcher'].value_counts(); proj = g.groupby('pitcher')['proj'].first()
        reg = proj[cnt[cnt >= 25].index].sort_values()              # relievers with 25+ appearances
        crank = int(list(reg.index).index(closer)) + 1 if closer in reg.index else np.nan
        cgap = float(proj.get(closer, np.nan) - reg.iloc[0]) if len(reg) else np.nan   # closer's projected FIP minus best regular's
        pre = g[g.inning < 9]
        pre_t = -wcorr(pre['proj'].values, pre['LI'].values, np.ones(len(pre)))       # + = better arms enter bigger pre-9th spots
        best = reg.index[0] if len(reg) else None; bg = g[g.pitcher == best]
        rows.append(dict(season=y, team=team, closer_rank=crank, closer_gap=cgap, pre9_targeting=pre_t,
                         best_pre9_share=float((bg.inning < 9).mean()) if len(bg) else np.nan, n_regulars=len(reg)))
F = pd.DataFrame(rows).merge(M[['season', 'team', 'eff']], on=['season', 'team'])
F.to_csv('flex.csv', index=False)
print(F[['closer_rank', 'closer_gap', 'pre9_targeting', 'best_pre9_share', 'eff']].corr().round(2)['eff'])
X = np.c_[np.ones(len(F)), F['closer_gap'].fillna(F['closer_gap'].mean()), F['pre9_targeting']]
b = np.linalg.lstsq(X, F['eff'].values, rcond=None)[0]; pred = X @ b
print('eff ~ closer_gap + pre9_targeting: coefs', b.round(3), 'R2', round(1 - np.var(F.eff - pred) / np.var(F.eff), 2))
for c in ('closer_gap', 'pre9_targeting', 'best_pre9_share', 'eff'):
    P = F.pivot(index='team', columns='season', values=c)
    rr = [P[[a, a+1]].dropna().corr().iloc[0, 1] for a in range(2021, 2026)]
    print(f'{c:16} year-to-year corr', np.round(rr, 2), 'mean', round(np.nanmean(rr), 2))
print('closer was the best regular in', round((F.closer_rank == 1).mean(), 2), 'of team-seasons; mean rank', round(F.closer_rank.mean(), 2))
print(F.groupby(F.closer_rank.clip(upper=4))['eff'].agg(['mean', 'size']).round(3))
# repeat performers: top-10 finishes in 6 seasons vs chance
F['top10'] = F.groupby('season')['eff'].rank(ascending=False) <= 10
cnt = F.groupby('team')['top10'].sum().sort_values(ascending=False); print(cnt.head(8).to_dict())
rng = np.random.default_rng(0); sims = [max(np.bincount(np.concatenate([rng.permutation(30)[:10] for _ in range(6)]), minlength=30)) for _ in range(5000)]
print('chance: P(some team gets >=5 top-10s)', np.mean(np.array(sims) >= 5).round(3), '>=4', np.mean(np.array(sims) >= 4).round(3))
pt = F.pivot(index='team', columns='season', values='pre9_targeting').mean(1).sort_values(ascending=False); print('pre9 targeting 2021-26 mean, top/bottom', pt.round(3).head(5).to_dict(), pt.round(3).tail(5).to_dict())
