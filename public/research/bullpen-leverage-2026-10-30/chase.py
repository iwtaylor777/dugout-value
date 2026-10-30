"""ERA-chasing test (protocol): does first-half run prevention luck move relievers' leverage in the second half?"""
import numpy as np, pandas as pd
rows = []
for y in range(2021, 2027):
    t = pd.read_parquet(f'rel_{y}.parquet'); r = t[t.reliever & t['proj'].notna() & (t['proj'] < 6.5)].copy()
    r['first'] = ~r.duplicated(['game_pk', 'pitcher'])
    r['half'] = np.where(r['game_date'] < pd.Timestamp(f'{y}-07-15'), 1, 2)
    lgF = r['lgFIP'].iloc[0]
    al = t[t['proj'].notna()]
    c = lgF - (13 * al['HR'].sum() + 3 * al['BBH'].sum() - 2 * al['K'].sum()) / (al['outs'].sum() / 3)
    for (p, team), g in r.groupby(['pitcher', 'fld_team']):
        h1, h2 = g[g.half == 1], g[g.half == 2]
        ip1, ip2 = h1['outs'].sum() / 3, h2['outs'].sum() / 3
        if ip1 < 15 or ip2 < 10: continue
        f = lambda h, ip: (13 * h['HR'].sum() + 3 * h['BBH'].sum() - 2 * h['K'].sum()) / ip + c
        rows.append(dict(season=y, pitcher=p, team=team, ip1=ip1, ip2=ip2, proj=g['proj'].iloc[0], lg=lgF,
                         ra1=h1['runs'].sum() / ip1 * 9, fip1=f(h1, ip1), ra2=h2['runs'].sum() / ip2 * 9, fip2=f(h2, ip2),
                         li1=h1.loc[h1['first'], 'LI'].mean(), li2=h2.loc[h2['first'], 'LI'].mean(), e1=int(h1['first'].sum()), e2=int(h2['first'].sum())))
R = pd.DataFrame(rows); R.to_csv('chase_rows.csv', index=False)
R['luck'] = R['ra1'] - R['fip1']; R['news'] = R['fip1'] - R['proj']; R['projr'] = R['proj'] - R['lg']
w = np.minimum(R['e1'], R['e2']).values.astype(float)
def wls(y, X, w, B=1000, seed=1):
    X = np.c_[np.ones(len(X)), X]; b = np.linalg.lstsq(X * np.sqrt(w)[:, None], y * np.sqrt(w), rcond=None)[0]
    rng = np.random.default_rng(seed); bs = []
    for _ in range(B):
        i = rng.integers(0, len(y), len(y)); bs.append(np.linalg.lstsq(X[i] * np.sqrt(w[i])[:, None], y[i] * np.sqrt(w[i]), rcond=None)[0])
    return b, np.percentile(bs, [2.5, 97.5], axis=0)
print('pitcher-team-halves', len(R), 'pitchers', R.pitcher.nunique())
names = ['const', 'RA9-FIP (1H luck)', 'FIP-proj (1H skill news)', 'proj vs league', '1H entry LI']
X = R[['luck', 'news', 'projr', 'li1']].values
for lab, yv in (('2H entry LI', R['li2'].values), ('2H FIP', R['fip2'].values), ('2H RA9', R['ra2'].values)):
    b, ci = wls(yv, X, w)
    print(lab); [print(f'   {n:26} {b[i]:+.3f} [{ci[0][i]:+.3f}, {ci[1][i]:+.3f}]') for i, n in enumerate(names)]
# descriptive: unlucky-but-good vs lucky-but-bad
R['grp'] = np.select([(R.luck > 1.5) & (R.news <= 0.25), (R.luck < -1.5) & (R.news >= -0.25)], ['unlucky', 'lucky'], 'other')
print(R.groupby('grp').apply(lambda d: pd.Series(dict(n=len(d), luck=d.luck.mean(), li1=np.average(d.li1, weights=np.minimum(d.e1, d.e2)), li2=np.average(d.li2, weights=np.minimum(d.e1, d.e2)),
      fip1=d.fip1.mean(), fip2=np.average(d.fip2, weights=d.ip2), ra2=np.average(d.ra2, weights=d.ip2), proj=d.proj.mean()))).round(2))
