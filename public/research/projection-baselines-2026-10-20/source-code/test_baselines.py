import unittest

from baselines import rate_baselines,workload_baselines
from run import games_elapsed,index,match,counts
from scoring import metrics,comparison


class BaselineTests(unittest.TestCase):
    def test_rates_weight_opportunities_not_season_percentages(self):
        # 20/100 current, 0/1000 last year: averaging .2 and 0 would be wrong.
        result=rate_baselines([100,20,0],[[1000,0,0],[0,0,0],[0,0,0]],{"K%":.1})
        self.assertAlmostEqual(result["K%"],40/1100)

    def test_no_history_rate_is_league_prior(self):
        self.assertEqual(rate_baselines([0,0,0],[[0,0,0]]*3,{"K-BB%":.15}),{"K-BB%":.15})

    def test_missing_seasons_are_zero_not_missing_weights(self):
        one=workload_baselines(0,[600,0,0],81,81)["multiyear"]
        all_three=workload_baselines(0,[600,600,600],81,81)["multiyear"]
        self.assertEqual(one,75)
        self.assertEqual(all_three,150)

    def test_no_history_workload_stays_zero_and_is_not_dropped(self):
        self.assertEqual(workload_baselines(0,[0,0,0],20,142),{"games":0,"multiyear":0})
        self.assertEqual(metrics([0,100],[100,100])["mae"],50)

    def test_suspension_cannot_count_as_completed_before_resumption(self):
        game=dict(gamePk=1,gameType="R",officialDate="2024-06-26",gameDate="2024-06-26T23:10:00Z",
                  resumeDate="2024-08-26T18:05:00Z",status={"abstractGameState":"Final","codedGameState":"F"})
        earlier=dict(gamePk=2,gameType="R",officialDate="2024-06-25",gameDate="2024-06-25T23:00:00Z",
                     status={"abstractGameState":"Final","codedGameState":"F"})
        payload=dict(dates=[dict(games=[game,earlier,earlier])])
        result=games_elapsed(payload,"2024-07-17","2024-07-18","20240718005043")
        self.assertEqual(result["completed_games"],1)
        self.assertEqual(result["gap_games_started"],0)

    def test_late_gap_games_use_no_performance_counts(self):
        first=dict(gamePk=1,gameType="R",officialDate="2025-06-22",gameDate="2025-06-22T23:10:00Z",status={"abstractGameState":"Final","codedGameState":"F"})
        gap=dict(gamePk=2,gameType="R",officialDate="2025-06-23",gameDate="2025-06-24T01:40:00Z",status={"abstractGameState":"Final","codedGameState":"F"})
        result=games_elapsed(dict(dates=[dict(games=[first,gap])]),"2025-06-22","2025-06-24","20250624042535")
        self.assertEqual(result["completed_games"],1)
        self.assertEqual(result["gap_games_started"],1)

    def test_conflicting_identities_fail_instead_of_name_matching(self):
        table=index([dict(playerid=1,xMLBAMID=11),dict(playerid=2,xMLBAMID=22)])
        with self.assertRaisesRegex(ValueError,"conflicting"):
            match(dict(matched_fg_id=1,matched_mlbam_id="22"),table)

    def test_postponed_final_bucket_is_not_a_played_game(self):
        def game(pk,code):return dict(gamePk=pk,gameType="R",officialDate="2025-05-30",gameDate="2025-05-30T23:10:00Z",status={"abstractGameState":"Final","codedGameState":code})
        result=games_elapsed(dict(dates=[dict(games=[game(1,"F"),game(2,"D")])]),"2025-05-31","2025-06-01","20250601113224")
        self.assertEqual(result["completed_games"],1)

    def test_missing_counts_are_not_treated_as_zero(self):
        with self.assertRaisesRegex(ValueError,"missing"):
            counts(dict(PA=100,SO=None,BB=10),"bat")

    def test_paired_identical_predictions_have_zero_gain(self):
        result=comparison([0,10,20],[1,11,21],[1,11,21],iterations=20)
        self.assertEqual(result["interval95_pct"],[0,0])


if __name__=="__main__":unittest.main()
