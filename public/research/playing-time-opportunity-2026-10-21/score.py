"""Score frozen playing-time predictions on aligned evaluation rows."""

import numpy as np


MODELS = ("constant", "mlb", "roster", "minors")
BASELINES = ("archived", "calendar", "games", "multiyear")
PA_PAIRS = (("mlb", "constant"), ("roster", "mlb"), ("minors", "roster"),
            ("minors", "archived"), ("minors", "multiyear"))
PROBABILITY_PAIRS = (("mlb", "constant"), ("roster", "mlb"), ("minors", "roster"))
SEED = 20261021


def _metrics(actual, forecast):
    error = forecast - actual
    return {"n": len(actual), "rmse": float(np.sqrt(np.mean(error ** 2))),
            "mae": float(np.mean(np.abs(error))), "bias": float(np.mean(error))}


def _probability(actual, forecast):
    clipped = np.clip(forecast, 1e-6, 1 - 1e-6)
    bins = []
    for i in range(10):
        selected = (forecast >= i / 10) & (forecast < (i + 1) / 10 if i < 9 else forecast <= 1)
        bins.append({"lower": i / 10, "upper": (i + 1) / 10,
                     "n": int(selected.sum()),
                     "mean_predicted": float(forecast[selected].mean()) if selected.any() else None,
                     "observed_fraction": float(actual[selected].mean()) if selected.any() else None})
    return {"n": len(actual), "brier": float(np.mean((forecast - actual) ** 2)),
            "log_loss": float(np.mean(-actual * np.log(clipped) - (1 - actual) * np.log1p(-clipped))),
            "mean_predicted": float(forecast.mean()), "observed_fraction": float(actual.mean()),
            "reliability_bins": bins}


def score(rows, predictions, iterations=5000):
    """Score one fixed evaluation cohort; rows and predictions must be aligned.

    Rows need actual_work, remaining_games, features.active, prior_mlb,
    current_mlb, and baselines with all four protocol names. Predictions are
    returned by model.predict. Positive gains favor the first named method.
    """
    if not rows or len(rows) != len(predictions) or not isinstance(iterations, int) or iterations < 1:
        raise ValueError("invalid evaluation cohort or resample count")
    ids = [r["mlbam_id"] for r in rows]
    if len(set(ids)) != len(ids):
        raise ValueError("duplicate evaluation identity")
    actual = np.asarray([r["actual_work"] for r in rows], dtype=float)
    games = np.asarray([r["remaining_games"] for r in rows], dtype=float)
    if not np.isfinite(actual).all() or not np.isfinite(games).all() or (actual < 0).any() or (games <= 0).any():
        raise ValueError("invalid targets or remaining games")
    observed = (actual > 0).astype(float)
    pa = {}
    probability = {}
    conditional = {}
    for name in MODELS:
        pa[name] = np.asarray([p[name]["expected_pa"] for p in predictions], dtype=float)
        probability[name] = np.asarray([p[name]["probability"] for p in predictions], dtype=float)
        conditional[name] = np.asarray([p[name]["conditional_pa_per_game"] for p in predictions], dtype=float)
        if (not np.isfinite(pa[name]).all() or (pa[name] < 0).any()
                or not np.isfinite(probability[name]).all() or ((probability[name] < 0) | (probability[name] > 1)).any()
                or not np.isfinite(conditional[name]).all() or (conditional[name] < 0).any()):
            raise ValueError(f"invalid {name} prediction")
        if not np.allclose(pa[name], probability[name] * conditional[name] * games, rtol=1e-10, atol=1e-8):
            raise ValueError(f"inconsistent {name} prediction")
    for name in BASELINES:
        pa[name] = np.asarray([r["baselines"][name] for r in rows], dtype=float)
        if not np.isfinite(pa[name]).all() or (pa[name] < 0).any():
            raise ValueError(f"invalid {name} baseline")
    positive = observed == 1
    metrics = {name: _metrics(actual, values) for name, values in pa.items()}
    prob_metrics = {name: _probability(observed, values) for name, values in probability.items()}
    conditional_metrics = {name: {"pa_per_game": _metrics(actual[positive] / games[positive], values[positive]),
                                  "pa": _metrics(actual[positive], values[positive] * games[positive])}
                           for name, values in conditional.items()} if positive.any() else {}
    rng = np.random.default_rng(SEED)
    draws = rng.integers(0, len(rows), size=(iterations, len(rows)))
    pa_comparisons = {}
    for first, second in PA_PAIRS:
        first_rmse = np.sqrt(np.mean((pa[first][draws] - actual[draws]) ** 2, axis=1))
        second_rmse = np.sqrt(np.mean((pa[second][draws] - actual[draws]) ** 2, axis=1))
        base = metrics[second]["rmse"]
        if base == 0 or (second_rmse == 0).any():
            raise ValueError("relative RMSE gain undefined for perfect baseline")
        gains = 100 * (second_rmse - first_rmse) / second_rmse
        pa_comparisons[f"{first}_vs_{second}"] = {
            "rmse_reduction_pct": float(100 * (base - metrics[first]["rmse"]) / base),
            "interval95_pct": np.quantile(gains, [.025, .975]).tolist(), "resamples": iterations}
    probability_comparisons = {}
    for first, second in PROBABILITY_PAIRS:
        first_error = (probability[first] - observed) ** 2
        second_error = (probability[second] - observed) ** 2
        differences = np.mean(second_error[draws] - first_error[draws], axis=1)
        probability_comparisons[f"{first}_vs_{second}"] = {
            "brier_improvement": float(prob_metrics[second]["brier"] - prob_metrics[first]["brier"]),
            "interval95": np.quantile(differences, [.025, .975]).tolist(), "resamples": iterations}
    groups = {}
    masks = {"active": np.asarray([r["features"]["active"] == 1 for r in rows]),
             "not_active": np.asarray([r["features"]["active"] == 0 for r in rows]),
             "prior_mlb": np.asarray([r["prior_mlb"] is True for r in rows]),
             "no_prior_mlb": np.asarray([r["prior_mlb"] is False for r in rows]),
             "current_mlb": np.asarray([r["current_mlb"] is True for r in rows]),
             "no_current_mlb": np.asarray([r["current_mlb"] is False for r in rows])}
    for field in ("prior_mlb", "current_mlb"):
        if any(type(r[field]) is not bool for r in rows):
            raise ValueError(f"invalid {field} group")
    if any(r["features"]["active"] not in (0, 1) for r in rows):
        raise ValueError("invalid active group")
    for name, selected in masks.items():
        groups[name] = {"n": int(selected.sum()), "zero_outcomes": int(np.sum(actual[selected] == 0)),
                        "mean_actual_pa": float(actual[selected].mean()) if selected.any() else None,
                        "bias": {method: float(np.mean(values[selected] - actual[selected])) if selected.any() else None
                                 for method, values in pa.items()},
                        "workload": {method: _metrics(actual[selected], values[selected])
                                     for method, values in pa.items()} if selected.any() else {},
                        "probability": {method: {k:v for k,v in _probability(observed[selected], values[selected]).items()
                                        if k != "reliability_bins"}
                                        for method, values in probability.items()} if selected.any() else {}}
    return {"n": len(rows), "zero_outcomes": int(np.sum(actual == 0)),
            "workload": {"metrics": metrics, "comparisons": pa_comparisons},
            "probability": {"metrics": prob_metrics, "comparisons": probability_comparisons},
            "conditional_positive_only": conditional_metrics, "groups": groups,
            "bootstrap_seed": SEED}
