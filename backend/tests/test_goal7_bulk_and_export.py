"""
Goal 7: Acting on many deals at once & CSV export.
- Sales managers bulk-reassign selected deals.
- Sales managers bulk-advance selected deals.
- Partial batch handling: reports per deal what succeeded and what failed with reason.
- De-duplication of duplicate IDs in bulk requests.
- Export pipeline as CSV with stage-weighted values.
- CSV formula injection sanitization (CWE-1236).
"""

import csv
import io
from tests.base import BaseTestCase
from app.models.deal import Deal
from app.utils.constants import Stages, Roles, ErrorCodes


class TestGoal7BulkAndExport(BaseTestCase):

    def test_bulk_advance_success_and_partial_failures(self):
        """Bulk advance moves eligible deals to next stage and reports ineligible deals with reasons."""
        comp = self.create_test_company(self.alice)
        deal1 = self.create_test_deal(self.alice, comp.id, stage=Stages.NEW)
        deal2 = self.create_test_deal(self.alice, comp.id, stage=Stages.QUALIFIED)

        # Closed deal that cannot advance
        deal_closed = self.create_test_deal(self.alice, comp.id, stage=Stages.WON)
        from app.extensions import db
        db.session.commit()

        # Sales Rep attempting bulk advance -> 403 MANAGER_REQUIRED
        res_rep = self.client.post('/api/deals/bulk-advance', headers=self.auth_headers(self.alice), json={
            'deal_ids': [deal1.id, deal2.id]
        })
        self.assertEqual(res_rep.status_code, 403)

        # Manager bulk advances [deal1, deal2, deal_closed, 999999]
        res_mgr = self.client.post('/api/deals/bulk-advance', headers=self.auth_headers(self.manager), json={
            'deal_ids': [deal1.id, deal2.id, deal_closed.id, 999999]
        })
        self.assertEqual(res_mgr.status_code, 200)
        data = res_mgr.get_json()
        self.assertEqual(data['total_requested'], 4)
        self.assertEqual(data['total_succeeded'], 2)
        self.assertEqual(data['total_failed'], 2)

        # Check DB updates for succeeded deals
        self.assertEqual(Deal.query.get(deal1.id).stage, Stages.QUALIFIED)
        self.assertEqual(Deal.query.get(deal2.id).stage, Stages.PROPOSAL)

        # Check per-deal error reporting
        results_map = {r['deal_id']: r for r in data['results']}
        self.assertTrue(results_map[deal1.id]['success'])
        self.assertTrue(results_map[deal2.id]['success'])
        self.assertFalse(results_map[deal_closed.id]['success'])
        self.assertFalse(results_map[999999]['success'])

    def test_bulk_advance_duplicate_id_deduplication(self):
        """Sending duplicate IDs in bulk advance rejects duplicates and prevents multi-hop skipping."""
        comp = self.create_test_company(self.alice)
        deal = self.create_test_deal(self.alice, comp.id, stage=Stages.NEW)

        res = self.client.post('/api/deals/bulk-advance', headers=self.auth_headers(self.manager), json={
            'deal_ids': [deal.id, deal.id]
        })
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data['total_requested'], 2)
        self.assertEqual(data['total_succeeded'], 1)
        self.assertEqual(data['total_failed'], 1)

        # Deal only advanced once (NEW -> QUALIFIED), NOT twice (to PROPOSAL)
        self.assertEqual(Deal.query.get(deal.id).stage, Stages.QUALIFIED)
        self.assertFalse(data['results'][1]['success'])
        self.assertIn("Duplicate deal ID", data['results'][1]['reason'])

    def test_bulk_reassign_deals(self):
        """Manager can bulk reassign deals to another sales rep."""
        comp = self.create_test_company(self.alice)
        deal1 = self.create_test_deal(self.alice, comp.id, owner_id=self.alice.id)
        deal2 = self.create_test_deal(self.alice, comp.id, owner_id=self.alice.id)

        res = self.client.post('/api/deals/bulk-reassign', headers=self.auth_headers(self.manager), json={
            'deal_ids': [deal1.id, deal2.id],
            'owner_id': self.bob.id,
            'keep_previous_owner_as_collaborator': True
        })
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data['total_succeeded'], 2)
        self.assertEqual(Deal.query.get(deal1.id).owner_id, self.bob.id)
        self.assertEqual(Deal.query.get(deal2.id).owner_id, self.bob.id)

    def test_export_pipeline_csv_and_formula_injection_escaping(self):
        """Export pipeline returns CSV of open deals with formula injection characters escaped."""
        comp_safe = self.create_test_company(self.alice, name="Safe Company")
        deal_safe = self.create_test_deal(self.alice, comp_safe.id, title="Normal Deal", value="10000.00", stage=Stages.PROPOSAL)

        # Injected deal and company names starting with =, +, -, @
        comp_vuln = self.create_test_company(self.bob, name="=CMD|' /C calc'!A0")
        deal_vuln = self.create_test_deal(self.bob, comp_vuln.id, title="+SUM(A1:A10)", value="20000.00", stage=Stages.NEW)

        res = self.client.get('/api/deals/export-csv', headers=self.auth_headers(self.manager))
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.content_type.split(';')[0], 'text/csv')

        csv_text = res.data.decode('utf-8')
        reader = list(csv.reader(io.StringIO(csv_text)))
        headers = reader[0]
        self.assertEqual(headers, ['Company', 'Deal Title', 'Stage', 'Value', 'Weighted Value'])

        rows = reader[1:]
        self.assertEqual(len(rows), 2)

        # Verify formula characters are escaped with leading single quote (')
        found_escaped_comp = False
        found_escaped_title = False
        for r in rows:
            if r[0].startswith("'="):
                found_escaped_comp = True
            if r[1].startswith("'+"):
                found_escaped_title = True
            # Verify no cell begins with unescaped formula triggers
            for cell in r:
                self.assertFalse(cell.startswith(('=', '+', '-', '@')), f"Raw formula trigger leaked: {cell}")

        self.assertTrue(found_escaped_comp, "Expected escaped company name in CSV")
        self.assertTrue(found_escaped_title, "Expected escaped deal title in CSV")
