"""Score fixed predictions without fitting or downloading data."""
import numpy as np


def metrics(actual, predicted, weights=None):
    a, p = np.asarray(actual, float), np.asarray(predicted, float)
    w = np.ones(len(a)) if weights is None else np.asarray(weights, float)
    if not len(a) or a.shape != p.shape or a.shape != w.shape or not np.isfinite([a,p,w]).all() or (w < 0).any() or w.sum() <= 0:
        raise ValueError("invalid scoring arrays")
    error = p-a
    return dict(n=len(a), weight=float(w.sum()), rmse=float(np.sqrt(np.average(error**2, weights=w))),
                mae=float(np.average(abs(error), weights=w)), bias=float(np.average(error, weights=w)))


def comparison(actual, candidate, baseline, weights=None, iterations=5000):
    a, c, b = [np.asarray(x, float) for x in [actual,candidate,baseline]]
    w = np.ones(len(a)) if weights is None else np.asarray(weights, float)
    def gain(idx):
        br = metrics(a[idx], b[idx], w[idx])["rmse"]
        cr = metrics(a[idx], c[idx], w[idx])["rmse"]
        if br == 0:
            raise ValueError("relative improvement undefined for a perfect baseline")
        return 100*(br-cr)/br
    rng = np.random.default_rng(20261020)
    draws = [gain(rng.integers(0,len(a),len(a))) for _ in range(iterations)]
    return dict(rmse_reduction_pct=gain(np.arange(len(a))),
                interval95_pct=[float(v) for v in np.quantile(draws,[.025,.975])], resamples=iterations)


def score(rows, iterations=5000):
    def work_scores(group):
        return {name:metrics([r["actual_work"] for r in group], [r["workload"][name] for r in group])
                for name in ["archived","calendar","games","multiyear"]}
    actual = [r["actual_work"] for r in rows]
    work = dict(metrics=work_scores(rows), comparisons={}, groups={})
    for candidate, baseline in [("archived","multiyear"),("multiyear","calendar"),("multiyear","games"),("archived","games")]:
        work["comparisons"][candidate+"_vs_"+baseline] = comparison(actual,
            [r["workload"][candidate] for r in rows],[r["workload"][baseline] for r in rows], iterations=iterations)
    for field, values in [("roster_status", ["active","not_on_active_roster","unknown","not_requested"]),
                          ("history_group", ["prior_mlb","no_prior_mlb"]),
                          ("current_group", ["current_mlb","no_current_mlb"])]:
        for value in values:
            group = [r for r in rows if r[field]==value]
            if group:
                work["groups"][value] = dict(n=len(group), zero_outcomes=sum(r["actual_work"]==0 for r in group),
                    metrics=work_scores(group), mean_actual=sum(r["actual_work"] for r in group)/len(group))
    rates={}
    for endpoint in rows[0]["rates"]:
        group = [r for r in rows if r["actual_work"]>0 and all(r["rates"][endpoint].get(k) is not None
                    for k in ["actual","archived","current_prior","multiyear"])]
        a=[r["rates"][endpoint]["actual"] for r in group];w=[r["actual_work"] for r in group]
        predictions={k:[r["rates"][endpoint][k] for r in group] for k in ["archived","current_prior","multiyear"]}
        rates[endpoint]=dict(metrics={k:metrics(a,v,w) for k,v in predictions.items()},
            comparisons={c+"_vs_"+b:comparison(a,predictions[c],predictions[b],w,iterations)
                         for c,b in [("archived","multiyear"),("multiyear","archived"),("multiyear","current_prior")]},
            positive_work_excluded=sum(r["actual_work"]>0 for r in rows)-len(group))
    return dict(workload=work,rates=rates)
