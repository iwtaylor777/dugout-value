import unittest
from normalize import schedule_check,fg_work,number

class SourceTests(unittest.TestCase):
 def test_counts_missing_are_not_zero(self):
  for value in [None,-1,1.5,float('nan')]:
   with self.assertRaises(ValueError):number(value)
 def test_conflicting_crosswalk_cannot_choose_one_provider_id(self):
  a={'PA':10,'xMLBAMID':11};b={'PA':20,'xMLBAMID':22}
  with self.assertRaisesRegex(ValueError,'conflict'):
   fg_work({'matched_fg_id':'1','mlbam_id':'22'},({'1':a},{'22':b}))
 def test_postponed_final_status_is_not_completed_and_duplicates_count_once(self):
  a=dict(gamePk=1,gameType='R',officialDate='2024-05-30',status={'codedGameState':'F'})
  b=dict(gamePk=2,gameType='R',officialDate='2024-05-30',status={'codedGameState':'D','abstractGameState':'Final'})
  result=schedule_check({'dates':[{'games':[a,a,b]}]},'2024-05-31')
  self.assertEqual(result['completed_games'],1)
 def test_future_completion_cannot_enter_dated_features(self):
  a=dict(gamePk=1,gameType='R',officialDate='2024-05-30',resumeDate='2024-06-02T12:00:00Z',status={'codedGameState':'F'})
  with self.assertRaisesRegex(ValueError,'suspended'):
   schedule_check({'dates':[{'games':[a]}]},'2024-05-31')

if __name__=='__main__':unittest.main()
