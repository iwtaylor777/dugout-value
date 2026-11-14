"""Unit tests that need no raw data: run with  python3 -m unittest test_rates  from this folder."""
import hashlib
import json
import unittest
from pathlib import Path
import eb_rates as E

HERE = Path(__file__).resolve().parents[1]


class RateTests(unittest.TestCase):
    def history(self):
        rows = {2023: dict(PA=500, SO=150, BB=40), 2024: dict(PA=400, SO=80, BB=40), 2025: dict(PA=600, SO=120, BB=60)}
        return {'a': rows, 'b': {y: dict(PA=1000, SO=220, BB=80) for y in (2023, 2024, 2025)}}

    def test_estimate_uses_only_prior_seasons(self):
        h = self.history(); by_player, lg = E.counts(h, 'K')
        before = E.estimate(by_player, lg, 'a', 2025, 65, 0.5)
        h['a'][2025]['SO'] = 300
        by_player2, lg2 = E.counts(h, 'K')
        # changing 2025 moves the league rate for 2025 only, which a 2025 estimate never reads
        self.assertAlmostEqual(before, E.estimate(by_player2, lg2, 'a', 2025, 65, 0.5))

    def test_estimate_formula(self):
        by_player, lg = E.counts(self.history(), 'K')
        k, d = 65.0, 0.5
        s23, n23 = 150, 500; s24, n24 = 80, 400
        expect = (d * (s23 - n23 * lg[2023]) + (s24 - n24 * lg[2024])) / (d * n23 + n24 + k)
        self.assertAlmostEqual(E.estimate(by_player, lg, 'a', 2025, k, d), expect)

    def test_blend_is_even(self):
        self.assertAlmostEqual(E.blend(0.30, 0.20), 0.25)

    def test_protocol_hash(self):
        line = (HERE / 'PROTOCOL.sha256').read_text().split()
        self.assertEqual(hashlib.sha256((HERE / 'PROTOCOL.md').read_bytes()).hexdigest(), line[0])

    def test_frozen_predictions_hash(self):
        lock = json.loads((HERE / 'LOCK-2027.json').read_text())
        for name, digest in lock['files'].items():
            self.assertEqual(hashlib.sha256((HERE / name).read_bytes()).hexdigest(), digest, name)


if __name__ == '__main__':
    unittest.main()
