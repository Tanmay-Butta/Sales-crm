"""
Goal 10: Past-due deal alerts.
- Open deals past expected close date trigger alerts.
- Alert count badge.
- Owner/manager can dismiss active alert.
- Pre-dismissal prevention (future deals, closed deals, duplicate dismissal rejected).
- Alert returns if close date is changed and that new date passes.
"""

from datetime import date, timedelta
from tests.base import BaseTestCase
from app.extensions import db
from app.models.deal import Deal
from app.utils.constants import Stages, ErrorCodes


class TestGoal10Alerts(BaseTestCase):

    def test_past_due_deal_triggers_alert(self):
        """Deals past their expected close date trigger alerts; future deals do not."""
        comp = self.create_test_company(self.alice)
        yesterday = date.today() - timedelta(days=1)
        tomorrow = date.today() + timedelta(days=1)

        # Overdue deal
        overdue_deal = self.create_test_deal(
            self.alice, comp.id, title="Overdue Deal",
            expected_close_date=yesterday, stage=Stages.PROPOSAL
        )

        # On-track deal
        future_deal = self.create_test_deal(
            self.alice, comp.id, title="Future Deal",
            expected_close_date=tomorrow, stage=Stages.PROPOSAL
        )

        res = self.client.get('/api/alerts', headers=self.auth_headers(self.alice))
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data['count'], 1)
        self.assertEqual(data['alerts'][0]['deal_id'], overdue_deal.id)

    def test_closed_and_deleted_deals_do_not_trigger_alerts(self):
        """Closed (Won/Lost) and deleted deals never trigger alerts even if past due."""
        comp = self.create_test_company(self.alice)
        yesterday = date.today() - timedelta(days=2)

        # Won deal
        won_deal = self.create_test_deal(self.alice, comp.id, expected_close_date=yesterday, stage=Stages.WON)

        # Deleted deal
        del_deal = self.create_test_deal(self.alice, comp.id, expected_close_date=yesterday, stage=Stages.NEW)
        del_deal.deleted_at = db.func.now()
        db.session.commit()

        res = self.client.get('/api/alerts', headers=self.auth_headers(self.alice))
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.get_json()['count'], 0)

    def test_dismiss_alert_and_pre_dismissal_prevention(self):
        """Alerts can be dismissed when active; pre-dismissal of future or closed deals is rejected."""
        comp = self.create_test_company(self.alice)
        yesterday = date.today() - timedelta(days=1)
        tomorrow = date.today() + timedelta(days=5)

        # 1. Future deal pre-dismissal -> 422
        future_deal = self.create_test_deal(self.alice, comp.id, expected_close_date=tomorrow)
        res_future = self.client.post(f'/api/alerts/{future_deal.id}/dismiss', headers=self.auth_headers(self.alice))
        self.assertEqual(res_future.status_code, 422)

        # 2. Overdue deal valid dismissal -> 200
        overdue_deal = self.create_test_deal(self.alice, comp.id, expected_close_date=yesterday)
        res_dismiss = self.client.post(f'/api/alerts/{overdue_deal.id}/dismiss', headers=self.auth_headers(self.alice))
        self.assertEqual(res_dismiss.status_code, 200)
        self.assertIn('deal', res_dismiss.get_json())

        # Now active alerts count should be 0
        res_check = self.client.get('/api/alerts', headers=self.auth_headers(self.alice))
        self.assertEqual(res_check.get_json()['count'], 0)

        # 3. Duplicate dismissal of already dismissed date -> 422
        res_dup = self.client.post(f'/api/alerts/{overdue_deal.id}/dismiss', headers=self.auth_headers(self.alice))
        self.assertEqual(res_dup.status_code, 422)

    def test_alert_reappears_if_close_date_changes_and_passes_again(self):
        """If close date changes to a new date that also passes, the alert returns."""
        comp = self.create_test_company(self.alice)
        past_date_1 = date.today() - timedelta(days=5)

        # Create overdue deal and dismiss it
        deal = self.create_test_deal(self.alice, comp.id, expected_close_date=past_date_1)
        self.client.post(f'/api/alerts/{deal.id}/dismiss', headers=self.auth_headers(self.alice))

        # Verified dismissed
        res1 = self.client.get('/api/alerts', headers=self.auth_headers(self.alice))
        self.assertEqual(res1.get_json()['count'], 0)

        # Move close date forward to a new date that has ALSO passed (e.g. yesterday)
        past_date_2 = date.today() - timedelta(days=1)
        self.client.put(f'/api/deals/{deal.id}', headers=self.auth_headers(self.alice), json={
            'expected_close_date': past_date_2.isoformat()
        })

        # The alert must return because past_date_2 != last_alert_dismissed_date
        res2 = self.client.get('/api/alerts', headers=self.auth_headers(self.alice))
        self.assertEqual(res2.status_code, 200)
        self.assertEqual(res2.get_json()['count'], 1)
        self.assertEqual(res2.get_json()['alerts'][0]['deal_id'], deal.id)
