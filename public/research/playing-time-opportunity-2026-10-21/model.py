"""Fixed, reproducible two-part playing-time models. No data access here."""

import numpy as np
from scipy.optimize import minimize


FEATURES = ("mlb_current_pace", "mlb_prior_pace", "active", "aaa_current",
            "aa_current", "aaa_prior", "aa_prior")
METHODS = {"mlb": 2, "roster": 3, "minors": 7}
PENALTY = 0.01


def _matrix(rows):
    if not rows:
        raise ValueError("empty rows")
    values = []
    for row in rows:
        f = row["features"]
        x = [float(f[k]) for k in FEATURES]
        if not np.isfinite(x).all() or any(v < 0 for v in (x[0], x[1], *x[3:])) or x[2] not in (0, 1):
            raise ValueError("invalid features")
        x[3:] = np.log1p(x[3:]).tolist()
        values.append(x)
    return np.asarray(values, dtype=float)


def _outcomes(rows):
    y = np.asarray([r["actual_work"] for r in rows], dtype=float)
    games = np.asarray([r["remaining_games"] for r in rows], dtype=float)
    if not np.isfinite(y).all() or not np.isfinite(games).all() or (y < 0).any() or (games <= 0).any():
        raise ValueError("invalid target or remaining games")
    if not (y > 0).any() or not (y == 0).any():
        raise ValueError("logistic fit requires both outcome classes")
    return y, games


def _logistic(x, y):
    design = np.column_stack((np.ones(len(x)), x))
    start = np.zeros(design.shape[1])
    start[0] = np.log(y.mean() / (1 - y.mean()))

    def objective(beta):
        z = design @ beta
        p = 1 / (1 + np.exp(-np.clip(z, -700, 700)))
        loss = np.logaddexp(0, z).mean() - np.mean(y * z) + PENALTY / 2 * np.dot(beta[1:], beta[1:])
        gradient = design.T @ (p - y) / len(y)
        gradient[1:] += PENALTY * beta[1:]
        return loss, gradient

    result = minimize(objective, start, jac=True, method="L-BFGS-B",
                      options={"ftol": 1e-12, "gtol": 1e-9, "maxiter": 2000})
    if not result.success or np.max(np.abs(result.jac)) > 1e-6:
        raise RuntimeError(f"logistic fit did not converge: {result.message}")
    return result.x.tolist()


def _ridge(x, target):
    center = x.mean(axis=0)
    mean = target.mean()
    centered = x - center
    slopes = np.linalg.solve(centered.T @ centered / len(x) + PENALTY * np.eye(x.shape[1]),
                             centered.T @ (target - mean) / len(x))
    return np.r_[mean - center @ slopes, slopes].tolist()


def train_model(rows):
    """Fit the prespecified 2024 models and return JSON-serializable coefficients."""
    raw = _matrix(rows)
    actual, games = _outcomes(rows)
    mean = raw.mean(axis=0)
    scale = raw.std(axis=0)
    scale[scale == 0] = 1
    x = (raw - mean) / scale
    positive = actual > 0
    target = actual[positive] / games[positive]
    models = {}
    for name, width in METHODS.items():
        models[name] = {"probability_coefficients": _logistic(x[:, :width], positive.astype(float)),
                        "conditional_coefficients": _ridge(x[positive, :width], target)}
    return {"version": 1, "penalty": PENALTY, "feature_order": list(FEATURES),
            "feature_means": mean.tolist(), "feature_scales": scale.tolist(),
            "constant": {"probability": float(positive.mean()),
                         "conditional_pa_per_game": float(target.mean())},
            "models": models}


def predict(model, rows):
    """Return aligned constant/mlb/roster/minors predictions for each row."""
    if model["feature_order"] != list(FEATURES) or model["penalty"] != PENALTY:
        raise ValueError("incompatible model")
    raw = _matrix(rows)
    games = np.asarray([r["remaining_games"] for r in rows], dtype=float)
    if not np.isfinite(games).all() or (games <= 0).any():
        raise ValueError("invalid remaining games")
    x = (raw - np.asarray(model["feature_means"])) / np.asarray(model["feature_scales"])
    result = []
    for index, game_count in enumerate(games):
        row = {}
        p = float(model["constant"]["probability"])
        conditional = float(model["constant"]["conditional_pa_per_game"])
        row["constant"] = {"probability": p, "conditional_pa_per_game": conditional,
                           "expected_pa": p * conditional * float(game_count)}
        for name, width in METHODS.items():
            fitted = model["models"][name]
            design = np.r_[1, x[index, :width]]
            z = float(design @ fitted["probability_coefficients"])
            p = float(1 / (1 + np.exp(-np.clip(z, -700, 700))))
            conditional = max(0.0, float(design @ fitted["conditional_coefficients"]))
            row[name] = {"probability": p, "conditional_pa_per_game": conditional,
                         "expected_pa": p * conditional * float(game_count)}
        result.append(row)
    return result
