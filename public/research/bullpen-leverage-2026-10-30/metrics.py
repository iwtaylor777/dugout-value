"""Team-season bullpen allocation metrics, 2021-2026."""
import numpy as np, pandas as pd, json
def wcorr(x, y, w):
    mx, my = np.average(x, weights=w), np.average(y, weights=w)
    return np.average((x - mx) * (y - my), weights=w) / np.sqrt(np.average((x - mx) ** 2, weights=w) * np.average((y - my) ** 2, weights=w))
rows = []; games_out = []
for y in range(2021, 2027):
    t = pd.read_parquet(f'rel_{y}.parquet'); r = t[t.reliever & t['proj'].notna() & (t['proj'] < 6.5)].copy()
    for team, g in r.groupby('fld_team'):
        # (a) season reshuffle upper bound with preseason talent: highest-LI PAs to best relievers, PA counts fixed
        n = g.groupby('pitcher').size(); v = g.groupby('pitcher')['val_pre'].first().reindex(n.index)
        vals = np.repeat(np.sort(v.values)[::-1], n.reindex(v.sort_values(ascending=False).index).values)
        lis = np.sort(g['LI'].values)[::-1]
        best = float((vals * lis).sum()); actual = float((g['val_pre'] * g['LI']).sum()); worst = float((vals[::-1] * lis).sum())
        # leverage-talent correlation across relievers (PA-weighted): mean LI vs projected FIP (negative = good)
        pl = g.groupby('pitcher').agg(li=('LI', 'mean'), proj=('proj', 'first'), n=('LI', 'size'))
        pl = pl[pl.n >= 40]
        corr = wcorr(pl['proj'].values, pl['li'].values, pl['n'].values) if len(pl) >= 4 else np.nan
        # (b) within-game ordering: same relievers in each game, stints reassigned by in-season talent
        order_loss = 0.0; order_gain_games = 0; ng = 0
        for gp, gg in g.groupby('game_pk'):
            st = gg.groupby('pitcher').agg(sli=('LI', 'sum'), v=('val_in', 'first'))
            if len(st) < 2: continue
            ng += 1
            act = float((st['sli'] * st['v']).sum()); opt = float((np.sort(st['sli'].values)[::-1] * np.sort(st['v'].values)[::-1]).sum())
            order_loss += opt - act; order_gain_games += (opt - act) > 0.05 / 1  # >0.05 leverage-weighted runs
        rows.append(dict(season=y, team=team, relief_pa=len(g), corr=corr, actual_runs=actual, best_runs=best, worst_runs=worst,
                         reshuffle_wins=(best - actual) / 10, eff=(actual - worst) / (best - worst) if best > worst else np.nan,
                         order_wins=order_loss / 10, games=ng, games_misordered=int(order_gain_games)))
    print(y, flush=True)
M = pd.DataFrame(rows); M.to_csv('team_metrics.csv', index=False)
print(M.groupby('season')[['corr', 'eff', 'reshuffle_wins', 'order_wins']].mean().round(3))
print(M[M.season == 2026].sort_values('eff')[['team', 'corr', 'eff', 'reshuffle_wins', 'order_wins', 'actual_runs']].round(2).to_string())
