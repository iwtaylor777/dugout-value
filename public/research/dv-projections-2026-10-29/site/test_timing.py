"""Forecast-origin regression checks; these do not require proprietary inputs."""
import unittest
from runtime import training_years, innings_to_decimal

class TimingTests(unittest.TestCase):
    def test_baseball_innings_count_outs_instead_of_decimal_tenths(self):
        self.assertAlmostEqual(innings_to_decimal(174.2),174+2/3)
        self.assertAlmostEqual(innings_to_decimal(6.1),6+1/3)
        self.assertEqual(innings_to_decimal(0),0)

    def test_invalid_outs_notation_is_rejected(self):
        with self.assertRaises(ValueError): innings_to_decimal(6.3)
    def test_five_year_forecast_excludes_every_unavailable_outcome(self):
        years=list(training_years(2016,2026,5))
        self.assertEqual(years,[2020,2021])
        self.assertTrue(all(y<=2021 for y in years))

    def test_one_year_window_is_unchanged(self):
        self.assertEqual(list(training_years(2016,2026,1)),list(range(2016,2026)))

    def test_signing_paths_share_one_information_cutoff(self):
        for season in range(2021,2027):
            for horizon in range(1,6):
                years=training_years(2013,season+horizon-1,horizon)
                self.assertTrue(all(y<=season-1 for y in years))

    def test_future_training_cutoff_is_rejected(self):
        with self.assertRaises(ValueError):
            training_years(2016,2026,5,cutoff=2022)

    def test_future_outcome_changes_cannot_change_a_historical_fit(self):
        # Exercise the real fit loop with small in-memory data and a deterministic
        # estimator. This catches a caller reverting to range(..., target), even
        # if the standalone training_years helper still passes its own checks.
        import importlib.util
        from pathlib import Path
        import types
        from unittest.mock import patch
        import numpy as np
        history={year:{'PA':600.,'WAR':float(year),'Age':25.} for year in range(2010,2027)}
        D={'p':history}
        fake_data=types.ModuleType('data')
        fake_data.seasons=lambda kind:D
        fake_data.league=lambda kind:{}
        fake_dvp=types.ModuleType('dvp')
        fake_dvp.LB=fake_dvp.LP={year:{'WAR600':0.,'WAR180':0.} for year in range(2010,2027)}
        fake_dvp.anchor=lambda lg,T,key:0.
        fake_dvp.blend_fit=lambda A,y,w,B:np.full(len(B),float(np.mean(y)))
        features={}
        for name in ('feat_bat2','feat_bat3','feat_pit'):
            mod=types.ModuleType(name)
            mod.row_features=lambda h,T,L:{'prior_year':float(T-1)}
            mod.fnum=lambda v:float(v) if v is not None else float('nan')
            features[name]=mod
        fake_runtime=types.ModuleType('runtime')
        fake_runtime.configure=lambda **kwargs:None
        fake_runtime.training_years=training_years
        modules=dict(features,data=fake_data,dvp=fake_dvp,runtime=fake_runtime)
        with patch.dict('sys.modules',modules):
            spec=importlib.util.spec_from_file_location('_timing_fit_test',Path(__file__).with_name('dvp_site.py'))
            model=importlib.util.module_from_spec(spec);spec.loader.exec_module(model)
            before=model.fit('bat',2026,5,'v3')
            for year in range(2022,2027): history[year].update(WAR=100000.,PA=10000.)
            after=model.fit('bat',2026,5,'v3')
        self.assertEqual(before,after)

if __name__=='__main__': unittest.main()
