"""Frozen 2027 K% and BB% projections for the pre-registered test (PROTOCOL.md).

- DV v1: dvp.project('bat', 2027), the locked v1 rate models.
- Beta-binomial: k and delta refit on target seasons 2011-26 (2020 excluded), the procedure fixed in PROTOCOL.md.
- Candidate v2: the 50/50 blend.
Writes ../params_2027.json and ../predictions_2027.json (FanGraphs id, name, 2026 team, rates)."""
import json
import re
import numpy as np
import _paths
import dvp
from data import seasons
from feat_pit import fnum
import eb_rates as E

T = 2027
RATES = ('K', 'BB')


def main():
    D = seasons('bat')
    v1 = dvp.project('bat', T)
    params, preds = {}, {}
    for st in RATES:
        by_player, lg = E.counts(D, st)
        k, delta, n = E.fit_k_delta(by_player, lg, range(2011, T))
        anchor = float(np.mean([lg[T - i] for i in (1, 2, 3)]))
        params[st] = dict(k=k, delta=delta, fit_rows=n, fit_targets=[2011, T - 1], anchor=anchor)
        for pid, dv in v1[st].items():
            bb = anchor + E.estimate(by_player, lg, pid, T, k, delta)
            row = D[pid].get(T - 1) or D[pid][max(D[pid])]
            p = preds.setdefault(pid, dict(name=row.get('PlayerName'), team_2026=re.sub(r'<[^>]+>', '', str((D[pid].get(T - 1) or {}).get('Team') or '')) or None,
                                            pa_2024_26=sum(fnum(D[pid].get(T - l, {}).get('PA')) or 0 for l in (1, 2, 3))))
            p[st] = dict(dv_v1=round(dv, 5), beta_binomial=round(bb, 5), v2_blend=round(float(E.blend(dv, bb)), 5))
    json.dump(dict(target_season=T, params=params), open(_paths.HERE / 'params_2027.json', 'w'), indent=1)
    json.dump(dict(target_season=T, players=dict(sorted(preds.items()))), open(_paths.HERE / 'predictions_2027.json', 'w'), indent=1)
    print({st: {k: round(v, 3) for k, v in params[st].items() if isinstance(v, float)} for st in RATES}, len(preds), 'players')
    print('Bauers', preds.get('15194'))


if __name__ == '__main__':
    main()
