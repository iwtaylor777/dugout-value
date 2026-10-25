"""Paired point-forecast scoring. No fitting or data downloads."""
import numpy as np


def metrics(actual, forecast, weights=None):
    actual, forecast = np.asarray(actual, float), np.asarray(forecast, float)
    weights = np.ones(len(actual)) if weights is None else np.asarray(weights, float)
    if not len(actual) or not np.isfinite([actual, forecast, weights]).all() or (weights < 0).any() or weights.sum() <= 0:
        raise ValueError("invalid scoring arrays")
    error = forecast - actual
    return dict(n=len(actual), weight=float(weights.sum()),
                rmse=float(np.sqrt(np.average(error ** 2, weights=weights))),
                mae=float(np.average(abs(error), weights=weights)),
                bias=float(np.average(error, weights=weights)))


def paired_interval(actual, archived, baseline, weights=None, iterations=5000):
    """One row per player per checkpoint; resample the same IDs for both models."""
    arrays = [np.asarray(x, float) for x in [actual, archived, baseline]]
    weights = np.ones(len(actual)) if weights is None else np.asarray(weights, float)
    rng = np.random.default_rng(20261019)
    values = []
    for _ in range(iterations):
        idx = rng.integers(0, len(actual), len(actual))
        a, z, b = [x[idx] for x in arrays]
        zr = metrics(a, z, weights[idx])["rmse"]
        br = metrics(a, b, weights[idx])["rmse"]
        if br == 0:
            raise ValueError("relative gain undefined for perfect baseline")
        values.append(100 * (br - zr) / br)
    br = metrics(arrays[0], arrays[2], weights)["rmse"]
    zr = metrics(arrays[0], arrays[1], weights)["rmse"]
    return dict(rmse_reduction_pct=100 * (br - zr) / br,
                interval95_pct=[float(v) for v in np.quantile(values, [.025, .975])],
                resamples=iterations)


def evaluate(rows, iterations=5000):
    """Normalized rows contain workload and rate forecasts; missing rates are None."""
    actual = [r["actual_work"] for r in rows]
    archived = [r["forecast_work"] for r in rows]
    pace = [r["pace_work"] for r in rows]
    workload = dict(archived=metrics(actual, archived), pace=metrics(actual, pace),
                    comparison=paired_interval(actual, archived, pace, iterations=iterations),
                    actual_total=sum(actual), forecast_total=sum(archived), pace_total=sum(pace),
                    zero_actual=sum(x == 0 for x in actual), zero_forecast=sum(x == 0 for x in archived))
    workload["groups"] = []
    for label, low, high in [("0", -1, 0), ("1–50", 0, 50), ("51–150", 50, 150),
                             ("151–300", 150, 300), (">300", 300, float("inf"))]:
        group = [r for r in rows if low < r["forecast_work"] <= high]
        if group:
            workload["groups"].append(dict(label=label, n=len(group),
                forecast_mean=sum(r["forecast_work"] for r in group) / len(group),
                actual_mean=sum(r["actual_work"] for r in group) / len(group),
                zero_actual=sum(r["actual_work"] == 0 for r in group),
                metrics=metrics([r["actual_work"] for r in group], [r["forecast_work"] for r in group])))
    endpoints = {}
    for endpoint in rows[0]["rates"]:
        selected = [r for r in rows if r["actual_work"] > 0 and all(
            r["rates"][endpoint][k] is not None for k in ["actual", "archived", "prior"])]
        if not selected:
            continue
        def score(group, weighted=True):
            weights = [r["actual_work"] for r in group] if weighted else None
            values = {k: [r["rates"][endpoint][k] for r in group] for k in ["actual", "archived", "prior"]}
            return {k: metrics(values["actual"], values[k], weights) for k in ["archived", "prior"]}
        values = {k: [r["rates"][endpoint][k] for r in selected] for k in ["actual", "archived", "prior"]}
        weights = [r["actual_work"] for r in selected]
        common = [r for r in selected if r["rates"][endpoint]["ytd"] is not None]
        common_scores = score(common)
        common_scores["ytd"] = metrics([r["rates"][endpoint]["actual"] for r in common],
                                         [r["rates"][endpoint]["ytd"] for r in common],
                                         [r["actual_work"] for r in common])
        threshold = 100 if rows[0]["kind"] == "bat" else 75
        sensitivity = [r for r in selected if r["actual_work"] >= threshold]
        endpoints[endpoint] = dict(weighted=score(selected), unweighted=score(selected, False),
            comparison=paired_interval(values["actual"], values["archived"], values["prior"], weights, iterations),
            common_ytd=common_scores, threshold=threshold, threshold_scores=score(sensitivity),
            positive_work_excluded=sum(r["actual_work"] > 0 for r in rows) - len(selected))
    return dict(workload=workload, rates=endpoints)
