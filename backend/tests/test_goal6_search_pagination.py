"""
Goal 6: Finding deals.
- Server-side text search over deal title and company name.
- Server-side filtering for company, stage, owner.
- Server-side sorting by value, expected close date, or last update.
- Server-side pagination showing total number of matches.
"""

from datetime import date
from decimal import Decimal
from tests.base import BaseTestCase
from app.utils.constants import Stages


class TestGoal6SearchAndPagination(BaseTestCase):

    def setUp(self):
        super().setUp()
        # Create dataset for searching, filtering, sorting, pagination
        self.comp_tech = self.create_test_company(self.alice, name="Skyline Technologies")
        self.comp_finance = self.create_test_company(self.bob, name="Apex Capital")

        # 5 deals with distinct titles, values, stages, and close dates
        self.deal1 = self.create_test_deal(
            self.manager, self.comp_tech.id, owner_id=self.alice.id,
            title="Cloud Infrastructure Migration", value="50000.00",
            expected_close_date=date(2026, 10, 1), stage=Stages.NEW
        )
        self.deal2 = self.create_test_deal(
            self.manager, self.comp_tech.id, owner_id=self.alice.id,
            title="Kubernetes Security Audit", value="15000.00",
            expected_close_date=date(2026, 11, 1), stage=Stages.QUALIFIED
        )
        self.deal3 = self.create_test_deal(
            self.manager, self.comp_finance.id, owner_id=self.bob.id,
            title="Payment Gateway Integration", value="85000.00",
            expected_close_date=date(2026, 12, 1), stage=Stages.PROPOSAL
        )
        self.deal4 = self.create_test_deal(
            self.manager, self.comp_finance.id, owner_id=self.bob.id,
            title="Fintech Mobile App", value="30000.00",
            expected_close_date=date(2026, 9, 15), stage=Stages.NEGOTIATION
        )
        self.deal5 = self.create_test_deal(
            self.manager, self.comp_tech.id, owner_id=self.alice.id,
            title="DevOps Toolchain License", value="5000.00",
            expected_close_date=date(2026, 10, 15), stage=Stages.NEW
        )

    def test_text_search_by_title_and_company_name(self):
        """Search query matches against deal title and company name case-insensitively."""
        # Match by title keyword 'Kubernetes'
        res_title = self.client.get('/api/deals?search=kubernetes', headers=self.auth_headers(self.manager))
        self.assertEqual(res_title.status_code, 200)
        data = res_title.get_json()
        self.assertEqual(data['total'], 1)
        self.assertEqual(data['deals'][0]['id'], self.deal2.id)

        # Match by company name 'Skyline'
        res_comp = self.client.get('/api/deals?search=skyline', headers=self.auth_headers(self.manager))
        self.assertEqual(res_comp.status_code, 200)
        data_comp = res_comp.get_json()
        self.assertEqual(data_comp['total'], 3)
        found_ids = [d['id'] for d in data_comp['deals']]
        self.assertIn(self.deal1.id, found_ids)
        self.assertIn(self.deal2.id, found_ids)
        self.assertIn(self.deal5.id, found_ids)

    def test_filter_by_stage_and_owner(self):
        """Deals can be filtered by stage and owner ID."""
        # Filter by stage 'NEW'
        res_stage = self.client.get(f'/api/deals?stage={Stages.NEW}', headers=self.auth_headers(self.manager))
        self.assertEqual(res_stage.status_code, 200)
        data_stage = res_stage.get_json()
        self.assertEqual(data_stage['total'], 2)
        for d in data_stage['deals']:
            self.assertEqual(d['stage'], Stages.NEW)

        # Filter by owner Bob
        res_owner = self.client.get(f'/api/deals?owner_id={self.bob.id}', headers=self.auth_headers(self.manager))
        self.assertEqual(res_owner.status_code, 200)
        data_owner = res_owner.get_json()
        self.assertEqual(data_owner['total'], 2)
        for d in data_owner['deals']:
            self.assertEqual(d['owner_id'], self.bob.id)

    def test_sorting_by_value_and_close_date(self):
        """Deals can be sorted by value and expected_close_date ascending and descending."""
        # Sort by value desc (Highest first: 85000 -> 50000 -> 30000 -> 15000 -> 5000)
        res_val_desc = self.client.get('/api/deals?sort_by=value&sort_dir=desc', headers=self.auth_headers(self.manager))
        self.assertEqual(res_val_desc.status_code, 200)
        deals_val_desc = res_val_desc.get_json()['deals']
        values = [Decimal(d['value']) for d in deals_val_desc]
        self.assertEqual(values, sorted(values, reverse=True))

        # Sort by expected_close_date asc (Earliest first)
        res_date_asc = self.client.get('/api/deals?sort_by=expected_close_date&sort_dir=asc', headers=self.auth_headers(self.manager))
        self.assertEqual(res_date_asc.status_code, 200)
        deals_date_asc = res_date_asc.get_json()['deals']
        dates = [d['expected_close_date'] for d in deals_date_asc]
        self.assertEqual(dates, sorted(dates))

    def test_server_side_pagination(self):
        """Pagination returns accurate total, page, per_page, and sliced results."""
        # Page 1, per_page 2 -> 2 items, total 5, pages 3
        res_p1 = self.client.get('/api/deals?page=1&per_page=2', headers=self.auth_headers(self.manager))
        self.assertEqual(res_p1.status_code, 200)
        p1 = res_p1.get_json()
        self.assertEqual(p1['total'], 5)
        self.assertEqual(p1['page'], 1)
        self.assertEqual(p1['per_page'], 2)
        self.assertEqual(p1['pages'], 3)
        self.assertEqual(len(p1['deals']), 2)

        # Page 3, per_page 2 -> 1 item
        res_p3 = self.client.get('/api/deals?page=3&per_page=2', headers=self.auth_headers(self.manager))
        self.assertEqual(res_p3.status_code, 200)
        p3 = res_p3.get_json()
        self.assertEqual(len(p3['deals']), 1)
