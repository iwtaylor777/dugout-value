"""Conditional contact models. Each replay changes the venue on the same contacts."""

from dataclasses import dataclass

import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingClassifier, HistGradientBoostingRegressor

from inputs import FENCE_ANGLES, RUN_WEIGHTS

FEATURES = ["launch_speed", "launch_angle", "spray", "righty", "pitcher_righty"]
WALL_FEATURES = FEATURES + ["carry", "fence_height", "fence_margin"]
MAIN = ["regime", "righty"]
PROFILE = MAIN + ["zone", "height", "hard"]
PRIORS = (25, 75, 250, 800)


def with_park(rows, park):
    return rows.assign(
        regime=park["regime"],
        fence_distance=np.interp(rows.spray, FENCE_ANGLES, park["distances"]),
        fence_height=np.interp(rows.spray, FENCE_ANGLES, park["heights"]),
    )


def predict_carry(carry, rows):
    return carry.predict(rows[FEATURES[:3]])


def wall_features(rows, carry):
    return rows.assign(carry=carry, fence_margin=carry - rows.fence_distance)[WALL_FEATURES]


def fit_carry(rows):
    air = rows.loc[rows.launch_angle.between(8, 70) & rows.hit_distance_sc.between(40, 550)]
    return HistGradientBoostingRegressor(max_iter=65, max_leaf_nodes=16, min_samples_leaf=70,
                                         random_state=7).fit(air[FEATURES[:3]], air.hit_distance_sc)


def fit_surface(rows, carry_model=None):
    x = rows[FEATURES] if carry_model is None else wall_features(rows, predict_carry(carry_model, rows))
    return HistGradientBoostingClassifier(
        max_iter=80, max_leaf_nodes=24, min_samples_leaf=80, learning_rate=.1,
        l2_regularization=2, early_stopping=False, random_state=0,
    ).fit(x, rows.y)


def aggregate_tilts(rows, probability, keys, prior_n, class_rate):
    expected = pd.DataFrame(probability, index=rows.index)
    observed = pd.DataFrame(np.eye(5)[rows.y], index=rows.index)
    groups = [rows[key] for key in keys]
    obs = observed.groupby(groups).sum()
    exp = expected.groupby(groups).sum()
    size = observed.groupby(groups).size().to_numpy()[:, None]
    prior = prior_n * np.maximum(exp.to_numpy() / size, .25 * class_rate)
    return (obs + prior) / (exp + prior)


def add_tilts(rows, probability, factors):
    index = pd.MultiIndex.from_frame(rows[factors.index.names])
    scaled = probability * factors.reindex(index).fillna(1).to_numpy()
    return scaled / scaled.sum(axis=1, keepdims=True)


@dataclass
class Model:
    surface: HistGradientBoostingClassifier
    main: pd.DataFrame
    profile: pd.DataFrame
    carry: HistGradientBoostingRegressor | None = None

    def base(self, rows):
        x = rows[FEATURES] if self.carry is None else wall_features(rows, predict_carry(self.carry, rows))
        return self.surface.predict_proba(x)

    def probability(self, rows, base=None, detailed=True):
        if base is None or self.carry is not None:
            base = self.base(rows)
        p = add_tilts(rows, base, self.main)
        return add_tilts(rows, p, self.profile) if detailed else p


def fit_models(rows, priors, *, wall=False, visiting_defense=False):
    carry = fit_carry(rows) if wall else None
    surface = fit_surface(rows, carry)
    return calibrate_models(rows, surface, priors, carry, visiting_defense=visiting_defense)


def calibrate_models(rows, surface, priors, carry=None, *, visiting_defense=False):
    calibrate = rows.loc[~rows.road] if visiting_defense else rows
    x = calibrate[FEATURES] if carry is None else wall_features(calibrate, predict_carry(carry, calibrate))
    base = surface.predict_proba(x)
    class_rate = np.bincount(calibrate.y, minlength=5) / len(calibrate)
    main = aggregate_tilts(calibrate, base, MAIN, 250, class_rate)
    generic = add_tilts(calibrate, base, main)
    return {prior: Model(surface, main, aggregate_tilts(calibrate, generic, PROFILE, prior, class_rate), carry)
            for prior in priors}


def non_hr(p):
    other = p[:, :4]
    return other / other.sum(axis=1, keepdims=True)


def log_loss(y, p):
    return -np.log(np.maximum(p[np.arange(len(y)), np.asarray(y, dtype=int)], 1e-12))


def bootstrap_error(rows, delta, group_key, draws=2000):
    frame = pd.DataFrame({"group": rows[group_key].to_numpy(), "error": delta})
    groups = frame.groupby("group").error.agg(["sum", "size"])
    return paired_mean_range(groups["sum"].to_numpy(), groups["size"].to_numpy(), draws=draws)


def paired_mean_range(totals, sizes, draws=2000):
    rng = np.random.default_rng(610)
    sample = rng.integers(0, len(totals), size=(draws, len(totals)))
    return np.quantile(totals[sample].sum(1) / sizes[sample].sum(1), [.025, .975]).tolist()


def typical_values(model, rows, parks):
    """Batting-side-only factors, applied to a common league contact mix."""
    sample = rows.groupby("righty", group_keys=False).sample(n=3000, random_state=610)
    base = model.base(sample)
    values = {}
    for park in parks.values():
        contact = with_park(sample, park)
        p = model.probability(contact, base, detailed=False)
        values[park["id"]] = [float((p[sample.righty.eq(side)] @ RUN_WEIGHTS).mean())
                               for side in [0, 1]]
    return values
