"""
Goal 8: A dashboard.
- Headline numbers: open deals, weighted pipeline value, won this month, lost this month.
- Breakdowns by stage and by owner.
- 8-week won deals timeline.
- Role-based metric scoping (Manager sees all; Rep sees visible deals).
"""

from datetime import datetime, timezone, timedelta
from decimal import Decimal
from tests.base import BaseTestCase
from app.extensions import db
from app.models.deal import Deal
from app.utils.constants import Stages, WIN_PROBABILITIES


class TestGoal8Dashboard(BaseTestCase):

    def setUp(self):
        super().setUp()
        self.comp = self.create_test_company(self.alice, name="Global Corp")

        # 1. Open deal in NEW: 10,000 * 0.10 = 1,000 (Alice owner)
        self.deal_new = self.create_test_deal(
            self.alice, self.comp.id, owner_id=self.alice.id,
            title="Deal New", value="10000.00", stage=Stages.NEW
        )

        # 2. Open deal in PROPOSAL: 20,000 * 0.50 = 10,000 (Bob owner, created by Manager)
        self.deal_prop = self.create_test_deal(
            self.manager, self.comp.id, owner_id=self.bob.id,
            title="Deal Proposal", value="20000.00", stage=Stages.PROPOSAL
        )

        # 3. Won deal this month: closed today
        self.deal_won = self.create_test_deal(
            self.alice, self.comp.id, owner_id=self.alice.id,
            title="Deal Won", value="30000.00", stage=Stages.WON
        )
        self.deal_won.closed_at = datetime.now(timezone.utc)

        # 4. Lost deal this month: closed today
        self.deal_lost = self.create_test_deal(
            self.alice, self.comp.id, owner_id=self.alice.id,
            title="Deal Lost", value="5000.00", stage=Stages.LOST
        )
        self.deal_lost.closed_at = datetime.now(timezone.utc)

        db.session.commit()

    def test_dashboard_headline_numbers(self):
        """Dashboard calculates accurate counts and weighted pipeline value."""
        res = self.client.get('/api/dashboard', headers=self.auth_headers(self.manager))
        self.assertEqual(res.status_code, 200)
        data = res.get_json()

        # Headline numbers
        headline = data['headline']
        self.assertEqual(headline['open_deals'], 2)
        # Weighted pipeline: 10,000 * 0.10 + 20,000 * 0.50 = 11,000
        self.assertEqual(Decimal(str(headline['weighted_pipeline'])), Decimal('11000.00'))
        self.assertEqual(headline['won_this_month'], 1)
        self.assertEqual(headline['lost_this_month'], 1)

    def test_dashboard_stage_and_owner_breakdowns(self):
        """Dashboard includes stage breakdown and owner breakdown for open deals."""
        res = self.client.get('/api/dashboard', headers=self.auth_headers(self.manager))
        self.assertEqual(res.status_code, 200)
        data = res.get_json()

        # By stage
        stage_map = {item['stage']: item for item in data['by_stage']}
        self.assertIn(Stages.NEW, stage_map)
        self.assertIn(Stages.PROPOSAL, stage_map)
        self.assertEqual(stage_map[Stages.NEW]['count'], 1)
        self.assertEqual(stage_map[Stages.PROPOSAL]['count'], 1)

        # By owner
        owner_ids = [item['owner_id'] for item in data['by_owner']]
        self.assertIn(self.alice.id, owner_ids)
        self.assertIn(self.bob.id, owner_ids)

    def test_dashboard_eight_week_won_chart(self):
        """Dashboard returns 8 continuous weekly buckets for won deals chart."""
        res = self.client.get('/api/dashboard', headers=self.auth_headers(self.manager))
        self.assertEqual(res.status_code, 200)
        data = res.get_json()

        wins_by_week = data['wins_by_week']
        self.assertEqual(len(wins_by_week), 8)
        # Most recent week contains the deal won today
        current_week = wins_by_week[-1]
        self.assertEqual(current_week['count'], 1)
        self.assertEqual(Decimal(str(current_week['total_value'])), Decimal('30000.00'))

    def test_rep_visibility_scoping_on_dashboard(self):
        """A sales rep's dashboard only includes metrics for deals they have access to."""
        comp_bob = self.create_test_company(self.bob, name="Bob Only Corp")
        deal_bob_secret = self.create_test_deal(
            self.bob, comp_bob.id, owner_id=self.bob.id,
            title="Secret Deal", value="100000.00", stage=Stages.PROPOSAL
        )

        res_rep = self.client.get('/api/dashboard', headers=self.auth_headers(self.alice))
        self.assertEqual(res_rep.status_code, 200)
        rep_headline = res_rep.get_json()['headline']

        # Alice should NOT see Bob's 100k secret deal
        open_deals_alice = rep_headline['open_deals']
        res_mgr = self.client.get('/api/dashboard', headers=self.auth_headers(self.manager))
        mgr_headline = res_mgr.get_json()['headline']

        self.assertGreater(mgr_headline['open_deals'], open_deals_alice)
        self.assertGreater(Decimal(str(mgr_headline['weighted_pipeline'])), Decimal(str(rep_headline['weighted_pipeline'])))
