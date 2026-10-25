import unittest
from copy import deepcopy
from unittest.mock import patch
import json

from run import actuals, by_id, check_schedule, endpoint_rate
from scoring import metrics, evaluate, paired_interval


class IntegrityTests(unittest.TestCase):
    def test_incomplete_response_cannot_create_zero_outcomes(self):
        c = dict(capture="20250731083705", key="fixture")
        payload = dict(dateRange="2025-07-31 and 2025-09-28", totalCount=1000, data=[])
        with patch("run.read_input", return_value=(json.dumps(payload).encode(), {})):
            with self.assertRaisesRegex(ValueError, "incomplete"):
                actuals(c, "target", [])

    def test_duplicate_or_ambiguous_id_is_not_silently_dropped(self):
        with self.assertRaisesRegex(ValueError, "duplicate"):
            by_id([dict(playerid="123"), dict(playerid=123)])
        with self.assertRaisesRegex(ValueError, "invalid"):
            by_id([dict(playerid="sa123")])

    def test_suspended_game_cannot_cross_cutoff(self):
        c = dict(key="fixture", capture="20240825063515")
        payload = dict(dates=[dict(games=[dict(gameType="R", gameDate="2024-08-26T18:05:00Z",
                                            resumedFrom="2024-06-26T23:10:00Z")])])
        with patch("run.read_input", return_value=(json.dumps(payload).encode(), {})):
            with self.assertRaisesRegex(ValueError, "suspended"):
                check_schedule(c, [])

    def test_capture_after_first_target_game_is_rejected(self):
        c = dict(key="fixture", capture="20250624183000")
        payload = dict(dates=[dict(games=[dict(gameType="R", gameDate="2025-06-24T18:00:00Z")])])
        with patch("run.read_input", return_value=(json.dumps(payload).encode(), {})):
            with self.assertRaisesRegex(ValueError, "after target"):
                check_schedule(c, [])

    def test_zero_work_does_not_mean_zero_rate(self):
        self.assertIsNone(endpoint_rate(dict(PA=0, SO=0, BB=0), "K%", "bat"))
        self.assertAlmostEqual(endpoint_rate(dict(TBF=100, SO=30, BB=10, IBB=2), "K-BB%", "pit"), .2)

    def test_weighting_and_bias_direction(self):
        result = metrics([0, 1], [1, 1], [3, 1])
        self.assertAlmostEqual(result["rmse"], .75 ** .5)
        self.assertEqual(result["bias"], .75)

    def test_zero_work_player_is_scored_for_workload_only(self):
        row = dict(kind="bat", actual_work=120, forecast_work=100, pace_work=80,
                   rates={"K%": dict(actual=.2, archived=.21, prior=.25, ytd=.3)})
        zero = deepcopy(row)
        zero.update(actual_work=0, forecast_work=150, pace_work=100)
        zero["rates"]["K%"]["actual"] = None
        result = evaluate([row, zero], iterations=20)
        self.assertEqual(result["workload"]["archived"]["n"], 2)
        self.assertEqual(result["workload"]["zero_actual"], 1)
        self.assertEqual(result["rates"]["K%"]["weighted"]["archived"]["n"], 1)
        self.assertGreater(result["workload"]["archived"]["mae"], 20)

    def test_identical_forecasts_have_zero_paired_gain(self):
        interval = paired_interval([.1, .2, .4], [.15, .3, .3], [.15, .3, .3], iterations=50)
        self.assertEqual(interval["rmse_reduction_pct"], 0)
        self.assertEqual(interval["interval95_pct"], [0, 0])


if __name__ == "__main__":
    unittest.main()
