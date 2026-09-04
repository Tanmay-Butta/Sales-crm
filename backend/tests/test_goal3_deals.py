"""
Goal 3: Deals inside companies.
- Every deal belongs to exactly one company.
- Carries title, value expressed as exact decimal amount, expected close date, owning sales rep.
- Deals can be created, edited, and deleted.
- Opening a company shows its deals.
- Soft-deletion removes deal from active pipeline while preserving audit record.
"""

from decimal import Decimal
from tests.base import BaseTestCase
from app.models.deal import Deal
from app.utils.constants import Roles, ErrorCodes


class TestGoal3Deals(BaseTestCase):

    def test_create_deal_with_exact_decimal_and_metadata(self):
        """Deal is created with title, exact decimal value, close date, and company."""
        comp = self.create_test_company(self.alice, name="Deal Hub Inc")

        res = self.client.post('/api/deals', headers=self.auth_headers(self.alice), json={
            'title': 'Enterprise License',
            'value': '12345.67',
            'expected_close_date': '2026-11-15',
            'company_id': comp.id
        })
        self.assertEqual(res.status_code, 201)
        deal_data = res.get_json()['deal']
        self.assertEqual(deal_data['title'], 'Enterprise License')
        self.assertEqual(deal_data['value'], '12345.67')
        self.assertEqual(deal_data['company_id'], comp.id)
        self.assertEqual(deal_data['owner_id'], self.alice.id)
        self.assertEqual(deal_data['stage'], 'NEW')

        # Check DB precision
        db_deal = Deal.query.get(deal_data['id'])
        self.assertEqual(db_deal.value, Decimal('12345.67'))

    def test_opening_company_shows_its_deals(self):
        """Opening a company (GET /api/companies/<id>) returns the company and all its deals."""
        comp = self.create_test_company(self.alice, name="Acme Group")
        deal1 = self.create_test_deal(self.alice, comp.id, title="Deal 1", value="10000.00")
        deal2 = self.create_test_deal(self.alice, comp.id, title="Deal 2", value="20000.00")

        # Other company and deal
        comp2 = self.create_test_company(self.bob, name="Other Group")
        self.create_test_deal(self.bob, comp2.id, title="Deal 3")

        res = self.client.get(f'/api/companies/{comp.id}', headers=self.auth_headers(self.alice))
        self.assertEqual(res.status_code, 200)
        company_data = res.get_json()['company']
        deals = company_data['deals']
        deal_ids = [d['id'] for d in deals]
        self.assertIn(deal1.id, deal_ids)
        self.assertIn(deal2.id, deal_ids)
        self.assertEqual(len(deals), 2)

    def test_edit_deal_metadata(self):
        """Owner and manager can edit deal metadata (title, value, expected close date)."""
        comp = self.create_test_company(self.alice)
        deal = self.create_test_deal(self.alice, comp.id, title="Initial Title", value="5000.00")

        # Owner edits
        res_edit = self.client.put(f'/api/deals/{deal.id}', headers=self.auth_headers(self.alice), json={
            'title': 'Renamed Title',
            'value': '8500.00'
        })
        self.assertEqual(res_edit.status_code, 200)
        self.assertEqual(res_edit.get_json()['deal']['title'], 'Renamed Title')
        self.assertEqual(res_edit.get_json()['deal']['value'], '8500.00')

        # Non-owner / non-collaborator rep cannot edit
        res_unauth = self.client.put(f'/api/deals/{deal.id}', headers=self.auth_headers(self.bob), json={
            'title': 'Intruder Title'
        })
        self.assertEqual(res_unauth.status_code, 403)

    def test_delete_deal_soft_delete(self):
        """Deleting a deal soft-deletes it; removed from standard queries but retained in DB."""
        comp = self.create_test_company(self.alice)
        deal = self.create_test_deal(self.alice, comp.id, title="Deal to Delete")

        # Rep Bob cannot delete Alice's deal -> 403
        res_unauth = self.client.delete(f'/api/deals/{deal.id}', headers=self.auth_headers(self.bob))
        self.assertEqual(res_unauth.status_code, 403)

        # Owner Alice deletes deal -> 200
        res_del = self.client.delete(f'/api/deals/{deal.id}', headers=self.auth_headers(self.alice))
        self.assertEqual(res_del.status_code, 200)

        # Disappears from active deals list
        res_list = self.client.get('/api/deals', headers=self.auth_headers(self.alice))
        active_ids = [d['id'] for d in res_list.get_json()['deals']]
        self.assertNotIn(deal.id, active_ids)

        # Remains in database with deleted_at timestamp for audit retention
        db_deal = Deal.query.get(deal.id)
        self.assertIsNotNone(db_deal)
        self.assertIsNotNone(db_deal.deleted_at)
