"""Beta-binomial (empirical Bayes) rate projections for hitters.

Each rate is successes over trials per season. The population of true rates is a Beta distribution with mean equal to
that season's league rate and concentration k, the number of league-average trials the estimate starts from. A
hitter's history is weighted by delta per season back (delta**(lag-1) for lags 1-5). The projection for season t is
the league anchor plus

    sum_l w_l * (s_l - n_l * league_l) / (sum_l w_l * n_l + k)

using seasons before t only. k and delta are fit per rate by PA-weighted squared error of the next-season rate.
"""
import math
import numpy as np
from scipy.optimize import minimize, minimize_scalar
from scipy.special import betaln


def _num(row, key):
    value = (row or {}).get(key)
    try:
        value = float(value)
    except (TypeError, ValueError):
        return 0.0
    return 0.0 if math.isnan(value) else value


# name: (successes, trials). K and BB match the protocol's K% and BB% (BB includes intentional walks).
STATS = {
    'K': (lambda r: _num(r, 'SO'), lambda r: _num(r, 'PA')),
    'BB': (lambda r: _num(r, 'BB'), lambda r: _num(r, 'PA')),
    'HRBIP': (lambda r: _num(r, 'HR'), lambda r: _num(r, 'AB') - _num(r, 'SO') + _num(r, 'SF')),
    'BABIP': (lambda r: _num(r, 'H') - _num(r, 'HR'),
              lambda r: _num(r, 'AB') - _num(r, 'SO') - _num(r, 'HR') + _num(r, 'SF')),
}
LAGS = 5


def counts(seasons, stat):
    """seasons: {player_id: {year: FanGraphs row}}. Returns per-player (s, n) by year and the league rate by year."""
    successes, trials = STATS[stat]
    by_player, totals = {}, {}
    for pid, history in seasons.items():
        for year, row in history.items():
            s, n = successes(row), trials(row)
            if n > 0:
                by_player.setdefault(pid, {})[year] = (s, n)
                ts, tn = totals.get(year, (0.0, 0.0))
                totals[year] = (ts + s, tn + n)
    league = {year: s / n for year, (s, n) in totals.items() if n}
    return by_player, league


def estimate(by_player, league, pid, t, k, delta):
    """League-relative estimate entering season t, from seasons t-1 ... t-5 only."""
    history = by_player.get(pid, {})
    num = den = 0.0
    for lag in range(1, LAGS + 1):
        year = t - lag
        if year in history:
            s, n = history[year]
            weight = delta ** (lag - 1)
            num += weight * (s - n * league[year])
            den += weight * n
    return num / (den + k)


def fit_k_delta(by_player, league, targets, min_trials=100):
    """Fit k and delta on next-season rates for the given target seasons (2020 excluded)."""
    obs = [(pid, t, history[t]) for pid, history in by_player.items() for t in targets
           if t != 2020 and t in history and history[t][1] >= min_trials
           and any((t - lag) in history for lag in range(1, LAGS + 1))]

    def loss(params):
        k, delta = math.exp(params[0]), 1 / (1 + math.exp(-params[1]))
        err = weight = 0.0
        for pid, t, (s, n) in obs:
            miss = (s / n - league[t]) - estimate(by_player, league, pid, t, k, delta)
            err += n * miss * miss
            weight += n
        return err / weight

    result = minimize(loss, [math.log(300), 0.5], method='Nelder-Mead',
                      options=dict(xatol=1e-3, fatol=1e-10, maxiter=300))
    return math.exp(result.x[0]), 1 / (1 + math.exp(-result.x[1])), len(obs)


def single_season_k(by_player, league, years, min_trials=50):
    """Maximum-likelihood beta-binomial concentration for single seasons (reported for reference)."""
    data = [(s, n, league[y]) for h in by_player.values() for y, (s, n) in h.items()
            if y in years and y != 2020 and n >= min_trials]
    s = np.array([d[0] for d in data]); n = np.array([d[1] for d in data]); m = np.array([d[2] for d in data])

    def nll(log_k):
        k = math.exp(log_k)
        return -np.sum(betaln(s + k * m, n - s + k * (1 - m)) - betaln(k * m, k * (1 - m)))

    return math.exp(minimize_scalar(nll, bounds=(0, 12), method='bounded').x)


def blend(dv, beta_binomial, weight=0.5):
    """The candidate v2 rate: weight * DV v1 + (1 - weight) * beta-binomial."""
    return weight * dv + (1 - weight) * beta_binomial
