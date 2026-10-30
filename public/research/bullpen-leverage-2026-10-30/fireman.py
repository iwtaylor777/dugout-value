"""Decision-time fireman rule. In each game, when a reliever enters at entry LI >= 1.8 in the 7th or 8th inning, and a
better reliever (by in-season talent, >= 0.30 FIP better) pitched LATER in the same game, swap the two stints. Swapping
within the game keeps availability (the better reliever pitched that day anyway). Value is counted on both stints, so a
swap loses when the later stint turned out to be the bigger one. Talent: in-season (preseason projection updated by FIP to date)."""
import numpy as np, pandas as pd
rows = []
for y in range(2021, 2027):
    t = pd.read_parquet(f'rel_{y}.parquet'); r = t[t.reliever & t['proj'].notna() & (t['proj'] < 6.5)].copy()
    st = r.groupby(['fld_team', 'game_pk', 'pitcher'], sort=False).agg(order=('at_bat_number', 'min'), inning=('inning', 'first'), entry=('LI', 'first'),
                                                                       sli=('LI', 'sum'), n=('LI', 'size'), tal=('tal_in', 'first'), v=('val_in', 'first')).reset_index()
    for team, g in st.groupby('fld_team'):
        gain = 0.0; swaps = 0; losses = 0
        for gp, s in g.groupby('game_pk'):
            s = s.sort_values('order').reset_index(drop=True); used = set()
            for i in range(len(s)):
                a = s.loc[i]
                if i in used or not (7 <= a.inning <= 8) or a.entry < 1.8: continue
                later = s.loc[i + 1:]; later = later[~later.index.isin(used)]
                if not len(later): continue
                j = later['tal'].idxmin(); b = s.loc[j]
                if a.tal - b.tal < 0.30: continue
                d = a.sli * (b.v - a.v) + b.sli * (a.v - b.v)
                gain += d; swaps += 1; losses += d < 0; used |= {i, j}
        rows.append(dict(season=y, team=team, wins=gain / 10, swaps=swaps, losing_swaps=losses))
F = pd.DataFrame(rows); F.to_csv('fireman.csv', index=False)
print(F.groupby('season')[['wins', 'swaps', 'losing_swaps']].mean().round(3))
print('share of team-seasons with a positive gain', round((F.wins > 0).mean(), 3), '| mean', round(F.wins.mean(), 3), 'median', round(F.wins.median(), 3), 'min', round(F.wins.min(), 2), 'max', round(F.wins.max(), 2))
print('per-swap gain (runs)', round(F.wins.sum() * 10 / F.swaps.sum(), 3), 'losing share', round(F.losing_swaps.sum() / F.swaps.sum(), 3))
print(F[F.season == 2026].sort_values('wins', ascending=False)[['team', 'wins', 'swaps']].round(2).head(5).to_string(), F[F.season == 2026][F.team.isin(['MIL', 'TB', 'SEA'])].round(2).to_string())
