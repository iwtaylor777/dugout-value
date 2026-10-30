import numpy as np, pandas as pd, sys
res = {}
TH = (1.8, 2.5, 3.0, 4.0)
for y in range(2021, 2027):
    t = pd.read_parquet(f'rel_{y}.parquet'); r = t[t.reliever & t['proj'].notna() & (t['proj'] < 6.5)].copy()
    st = r.groupby(['fld_team', 'game_pk', 'pitcher'], sort=False).agg(order=('at_bat_number', 'min'), inning=('inning', 'first'), entry=('LI', 'first'),
                                                                       sli=('LI', 'sum'), tal=('tal_in', 'first'), v=('val_in', 'first')).reset_index()
    for (team, gp), s in st.groupby(['fld_team', 'game_pk']):
        s = s.sort_values('order').reset_index(drop=True)
        for th in TH:
            used = set()
            for i in range(len(s)):
                a = s.loc[i]
                if i in used or not (6 <= a.inning <= 8) or a.entry < th: continue
                later = s.loc[i + 1:]; later = later[~later.index.isin(used)]
                if not len(later): continue
                j = later['tal'].idxmin(); b = s.loc[j]
                if a.tal - b.tal < 0.30: continue
                d = a.sli * (b.v - a.v) + b.sli * (a.v - b.v); used |= {i, j}
                k = (th, y); g0 = res.setdefault(k, [0.0, 0, 0, 0.0, 0.0]); g0[0] += d; g0[1] += 1; g0[2] += d < 0; g0[3] += a.sli; g0[4] += b.sli
for th in TH:
    tot = [res.get((th, y), [0, 0, 0, 0, 0]) for y in range(2021, 2027)]
    w = sum(x[0] for x in tot) / 10 / 6 / 30; n = sum(x[1] for x in tot); l = sum(x[2] for x in tot)
    print(f'threshold entry LI >= {th}: swaps per team-season {n/180:.1f}, wins per team-season {w:+.3f}, losing share {l/max(n,1):.2f}, mean LI-sum now {sum(x[3] for x in tot)/max(n,1):.2f} vs later {sum(x[4] for x in tot)/max(n,1):.2f}',
          '| by season', [round(x[0] / 300, 3) for x in tot])
