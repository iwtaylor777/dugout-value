import pickle
import unittest

import numpy as np
import pandas as pd

from runtime import COMP, attrib
from evaluate import V2, credit, permute


class CreditAccounting(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with open(COMP/'2024_full.pkl','rb') as f:cls.c=pickle.load(f)

    def test_fip_equivalence_with_full_fielding(self):
        a=attrib.credit(self.c,'fip')
        b=attrib.credit(self.c,'dv',dict(V2,lam_f=1,lam_b=1))
        for x,y in zip(a,b):np.testing.assert_allclose(x,y,atol=2e-12,rtol=1e-12)

    def test_only_batting_changes_in_contact_candidate(self):
        a=credit(self.c,'fip');b=credit(self.c,'contact_only')
        np.testing.assert_allclose(b[0]-a[0],-.5*self.c['bat'].r,atol=2e-12)
        for x,y in zip(a[1:],b[1:]):np.testing.assert_allclose(x,y,atol=2e-12)

    def test_soft_fielding_centers_to_zero(self):
        self.assertLess(abs(self.c['fld'].soft.sum()),1e-9)

    def test_framing_transfer_is_equal_and_opposite(self):
        a=credit(self.c,'fip');b=credit(self.c,'fip_balanced')
        np.testing.assert_allclose(a[0],b[0],atol=1e-12)
        np.testing.assert_allclose(a[2],b[2],atol=1e-12)
        np.testing.assert_allclose(b[1]-a[1],-self.c['pit'].frm,atol=2e-12)

    def test_identity_permutation_preserves_rate_population(self):
        from evaluate import rates
        a=rates(self.c,'fip');b=permute(a,self.c,np.random.default_rng(42))
        for x,y in zip(a,b):np.testing.assert_allclose(np.sort(x),np.sort(y),atol=1e-12)
        self.assertGreater(float(np.max(np.abs(a[0]-b[0]))),.01)

    def test_athletics_alias_keeps_identical_team_predictions(self):
        from evaluate import rates,team_value
        a=team_value(rates(self.c,'fip'),self.c['pt'])
        pt={k:v.copy() for k,v in self.c['pt'].items()}
        for k in ['bat','pit','fld']:
            z=pt[k].reset_index();team='bat_team' if k=='bat' else 'fld_team'
            z[team]=z[team].replace({'OAK':'ATH'})
            pt[k]=z.set_index(list(pt[k].index.names))[pt[k].name]
        pt['team'].index=pt['team'].index.str.replace('OAK','ATH')
        b=team_value(rates(self.c,'fip'),pt)
        pd.testing.assert_frame_equal(a,b)


if __name__=='__main__':unittest.main()
