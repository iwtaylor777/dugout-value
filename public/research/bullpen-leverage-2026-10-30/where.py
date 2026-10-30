import numpy as np, pandas as pd, sys
sys.path.insert(0, '/home/claude/pw/build/proj/src')
from data import seasons
D = seasons('pit'); name = {}
for pid, h in D.items():
    for y, r in h.items():
        if r.get('xMLBAMID'): name[int(r['xMLBAMID'])] = r.get('PlayerName') or r.get('Name')
out = []
for y in range(2021, 2027):
    t = pd.read_parquet(f'rel_{y}.parquet'); r = t[t.reliever & t['proj'].notna() & (t['proj'] < 6.5)].copy()
    n = r.groupby(['fld_team', 'pitcher']).size().rename('n').reset_index()
    pr = r.groupby(['fld_team', 'pitcher'])['proj'].first().reset_index().merge(n)
    pr = pr[pr.n >= 100].sort_values(['fld_team', 'proj'])
    pr['rank'] = pr.groupby('fld_team').cumcount() + 1
    r = r.merge(pr[['fld_team', 'pitcher', 'rank']], on=['fld_team', 'pitcher'], how='left'); r['rank'] = r['rank'].fillna(99)
    r['tier'] = np.select([r['rank'] <= 2, r['rank'] <= 5], ['top2', '3-5'], 'rest')
    r['inn9'] = np.where(r['inning'] >= 9, '9+', '1-8')
    hi = r[r.LI >= 2]
    out.append(dict(season=y, hi_share_before9=float((hi.inning < 9).mean()),
                    hi_top2=float((hi.tier == 'top2').mean()), top2_pa_share=float((r.tier == 'top2').mean()),
                    hi_before9_top2=float((hi[hi.inning < 9].tier == 'top2').mean()), hi_9_top2=float((hi[hi.inning >= 9].tier == 'top2').mean()),
                    top2_meanLI=float(r[r.tier == 'top2'].LI.mean()), top2_lowLI_share=float((r[r.tier == 'top2'].LI < 1).mean()),
                    rest_hi_share=float((hi.tier == 'rest').mean())))
    if y == 2026:
        r.to_parquet('rel_2026_tiers.parquet', index=False)
        for team in ('MIL', 'TB', 'SEA', 'ATH', 'SF'):
            g = r[r.fld_team == team]
            s = g.groupby('pitcher').agg(n=('LI', 'size'), li=('LI', 'mean'), ent=('LI', lambda x: np.nan), proj=('proj', 'first'), rank=('rank', 'first'), hi=('LI', lambda x: (x >= 2).mean()), in9=('inning', lambda x: (x >= 9).mean()))
            s = s[s.n >= 60].sort_values('proj'); s['name'] = s.index.map(name)
            print(team); print(s[['name', 'n', 'proj', 'li', 'hi', 'in9']].round(2).head(9).to_string())
O = pd.DataFrame(out); print(O.round(3).to_string())
