"""Focused checks for deterministic fit, replay, and zero-work scoring."""

import json
import unittest

from model import predict, train_model
from score import score


def row(i, work, active, minor):
    return {"mlbam_id": i, "name": f"Player {i}", "actual_work": work,
            "remaining_games": 100.0,
            "features": {"mlb_current_pace": (i % 5) * 0.8,
                         "mlb_prior_pace": (i % 4) * 0.7,
                         "active": active, "aaa_current": minor,
                         "aa_current": minor / 2, "aaa_prior": minor / 3,
                         "aa_prior": minor / 4},
            "prior_mlb": i % 4 != 0, "current_mlb": i % 5 != 0,
            "baselines": {"archived": 120.0, "calendar": 110.0,
                          "games": 105.0, "multiyear": 115.0}}


class PlayingTimeTest(unittest.TestCase):
    def setUp(self):
        self.rows = [row(i, 0.0 if i % 6 == 0 else 30 + i * 3,
                         int(i % 3 != 0), i * 4.0) for i in range(1, 61)]

    def test_fit_json_replay_and_output_identity(self):
        fitted = train_model(self.rows)
        replayed = json.loads(json.dumps(fitted))
        self.assertEqual(fitted, train_model(self.rows))
        self.assertEqual(predict(fitted, self.rows), predict(replayed, self.rows))
        for prediction in predict(fitted, self.rows):
            for method in ("constant", "mlb", "roster", "minors"):
                part = prediction[method]
                self.assertGreaterEqual(part["conditional_pa_per_game"], 0)
                self.assertAlmostEqual(part["expected_pa"],
                                       part["probability"] * part["conditional_pa_per_game"] * 100)

    def test_score_keeps_zero_work_and_paired_intervals(self):
        fitted = train_model(self.rows)
        result = score(self.rows, predict(fitted, self.rows), iterations=50)
        self.assertEqual(result["n"], 60)
        self.assertEqual(result["zero_outcomes"], 10)
        self.assertEqual(result["workload"]["metrics"]["archived"]["n"], 60)
        self.assertEqual(sum(x["n"] for x in result["probability"]["metrics"]["minors"]["reliability_bins"]), 60)
        self.assertEqual(result["conditional_positive_only"]["minors"]["pa"]["n"], 50)
        self.assertEqual(result, score(self.rows, predict(fitted, self.rows), iterations=50))
        self.assertIn("minors_vs_archived", result["workload"]["comparisons"])
        self.assertNotIn("archived", result["probability"]["metrics"])

    def test_rejects_duplicate_identity_and_bad_features(self):
        fitted = train_model(self.rows)
        with self.assertRaisesRegex(ValueError, "duplicate"):
            score(self.rows + [self.rows[0]], predict(fitted, self.rows + [self.rows[0]]), iterations=2)
        broken = json.loads(json.dumps(self.rows))
        broken[0]["features"]["aaa_current"] = -1
        with self.assertRaisesRegex(ValueError, "invalid features"):
            train_model(broken)


if __name__ == "__main__":
    unittest.main()
