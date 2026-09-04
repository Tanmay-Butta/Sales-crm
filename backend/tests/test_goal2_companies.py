"""
Goal 2: Companies.
- Sales reps and managers create companies with name, industry, website, owning sales rep.
- Edit company details.
- Archiving and restoring companies strictly restricted to Sales Managers.
- Archiving hides company from default views without destroying its deals.
- Creating fresh deals under archived companies is blocked.
"""

from tests.base import BaseTestCase
from app.models.company import Company
from app.models.deal import Deal
from app.utils.constants import Roles, ErrorCodes


class TestGoal2Companies(BaseTestCase):

    def test_create_company_by_rep_and_manager(self):
        """Sales reps and managers can create companies with required metadata."""
        # Rep Alice creates company (owner defaults to Alice)
        res_rep = self.client.post('/api/companies', headers=self.auth_headers(self.alice), json={
            'name': 'Alpha Tech',
            'industry': 'Technology',
            'website': 'https://alphatech.com'
        })
        self.assertEqual(res_rep.status_code, 201)
        data_rep = res_rep.get_json()['company']
        self.assertEqual(data_rep['name'], 'Alpha Tech')
        self.assertEqual(data_rep['owner_id'], self.alice.id)
        self.assertIsNone(data_rep['archived_at'])

        # Manager creates company and assigns owner to Bob
        res_mgr = self.client.post('/api/companies', headers=self.auth_headers(self.manager), json={
            'name': 'Beta Finance',
            'industry': 'Finance',
            'website': 'https://betafin.com',
            'owner_id': self.bob.id
        })
        self.assertEqual(res_mgr.status_code, 201)
        data_mgr = res_mgr.get_json()['company']
        self.assertEqual(data_mgr['owner_id'], self.bob.id)

    def test_company_owner_must_be_sales_rep(self):
        """Assigning a manager as company owner is rejected with 422 VALIDATION_ERROR."""
        res = self.client.post('/api/companies', headers=self.auth_headers(self.manager), json={
            'name': 'Invalid Owner Corp',
            'industry': 'Legal',
            'owner_id': self.manager.id
        })
        self.assertEqual(res.status_code, 422)

    def test_edit_company_permissions(self):
        """Owner and manager can edit company; other reps are rejected with 403."""
        comp = self.create_test_company(self.alice, name="Original Name")

        # Owner (Alice) edits -> 200
        res_owner = self.client.put(f'/api/companies/{comp.id}', headers=self.auth_headers(self.alice), json={
            'name': 'Updated Name by Owner'
        })
        self.assertEqual(res_owner.status_code, 200)
        self.assertEqual(res_owner.get_json()['company']['name'], 'Updated Name by Owner')

        # Non-owner rep (Bob) edits -> 403
        res_other = self.client.put(f'/api/companies/{comp.id}', headers=self.auth_headers(self.bob), json={
            'name': 'Hacked Name'
        })
        self.assertEqual(res_other.status_code, 403)

        # Manager edits -> 200
        res_mgr = self.client.put(f'/api/companies/{comp.id}', headers=self.auth_headers(self.manager), json={
            'name': 'Updated Name by Manager'
        })
        self.assertEqual(res_mgr.status_code, 200)
        self.assertEqual(res_mgr.get_json()['company']['name'], 'Updated Name by Manager')

    def test_archive_and_restore_manager_only(self):
        """Only Sales Managers can archive or restore companies; Reps are rejected with 403."""
        comp = self.create_test_company(self.alice, name="Archive Test Corp")

        # Rep attempts archive -> 403 MANAGER_REQUIRED
        res_rep_arch = self.client.patch(f'/api/companies/{comp.id}/archive', headers=self.auth_headers(self.alice))
        self.assertEqual(res_rep_arch.status_code, 403)
        self.assertEqual(res_rep_arch.get_json()['error']['code'], ErrorCodes.MANAGER_REQUIRED)

        # Manager archives -> 200
        res_mgr_arch = self.client.patch(f'/api/companies/{comp.id}/archive', headers=self.auth_headers(self.manager))
        self.assertEqual(res_mgr_arch.status_code, 200)
        self.assertTrue(res_mgr_arch.get_json()['company']['is_archived'])

        # Rep attempts restore -> 403
        res_rep_rest = self.client.patch(f'/api/companies/{comp.id}/restore', headers=self.auth_headers(self.alice))
        self.assertEqual(res_rep_rest.status_code, 403)

        # Manager restores -> 200
        res_mgr_rest = self.client.patch(f'/api/companies/{comp.id}/restore', headers=self.auth_headers(self.manager))
        self.assertEqual(res_mgr_rest.status_code, 200)
        self.assertFalse(res_mgr_rest.get_json()['company']['is_archived'])

    def test_archive_hides_from_default_views_without_destroying_deals(self):
        """Archiving hides company from default list view but preserves existing deals."""
        comp = self.create_test_company(self.alice, name="Preserve Deals Corp")
        deal = self.create_test_deal(self.alice, comp.id, title="Deal Under Archived Company")

        # Archive company
        self.client.patch(f'/api/companies/{comp.id}/archive', headers=self.auth_headers(self.manager))

        # Default GET /api/companies should NOT include archived company
        res_list = self.client.get('/api/companies', headers=self.auth_headers(self.alice))
        self.assertEqual(res_list.status_code, 200)
        active_ids = [c['id'] for c in res_list.get_json()['companies']]
        self.assertNotIn(comp.id, active_ids)

        # Manager can view with show_archived=true
        res_arch_list = self.client.get('/api/companies?show_archived=true', headers=self.auth_headers(self.manager))
        self.assertEqual(res_arch_list.status_code, 200)
        all_ids = [c['id'] for c in res_arch_list.get_json()['companies']]
        self.assertIn(comp.id, all_ids)

        # The deal must still exist and remain accessible
        db_deal = Deal.query.get(deal.id)
        self.assertIsNotNone(db_deal)
        self.assertEqual(db_deal.company_id, comp.id)

    def test_create_deal_under_archived_company_blocked(self):
        """Creating a new deal under an archived company is rejected with 422 COMPANY_ARCHIVED."""
        comp = self.create_test_company(self.alice, name="Closed Account Corp")
        self.client.patch(f'/api/companies/{comp.id}/archive', headers=self.auth_headers(self.manager))

        res_deal = self.client.post('/api/deals', headers=self.auth_headers(self.alice), json={
            'title': 'New Deal on Closed Account',
            'value': '25000.00',
            'expected_close_date': '2026-12-31',
            'company_id': comp.id
        })
        self.assertEqual(res_deal.status_code, 422)
        self.assertEqual(res_deal.get_json()['error']['code'], ErrorCodes.COMPANY_ARCHIVED)
