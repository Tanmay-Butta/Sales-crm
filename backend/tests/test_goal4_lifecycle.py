"""
Goal 4: A deal lifecycle with rules.
- Stages: New -> Qualified -> Proposal -> Negotiation -> Won / Lost.
- Win-probabilities for stage-weighting.
- Skipping stages forward rejected.
- Moving backward: exactly one stage allowed, requires recorded reason.
- Premature closing rejected (can only close from Negotiation).
- Closed deals locked from direct stage edits.
- Manager-only reopening to exact previous stage.
"""

from tests.base import BaseTestCase
from app.models.deal import Deal
from app.models.deal_history import DealHistory
from app.utils.constants import Stages, WIN_PROBABILITIES, ErrorCodes


class TestGoal4Lifecycle(BaseTestCase):

    def test_stage_win_probabilities(self):
        """Verify standard win probabilities per stage."""
        self.assertEqual(WIN_PROBABILITIES[Stages.NEW], 0.10)
        self.assertEqual(WIN_PROBABILITIES[Stages.QUALIFIED], 0.25)
        self.assertEqual(WIN_PROBABILITIES[Stages.PROPOSAL], 0.50)
        self.assertEqual(WIN_PROBABILITIES[Stages.NEGOTIATION], 0.75)
        self.assertEqual(WIN_PROBABILITIES[Stages.WON], 1.00)
        self.assertEqual(WIN_PROBABILITIES[Stages.LOST], 0.00)

    def test_forward_sequential_progression(self):
        """Deal advances sequentially: NEW -> QUALIFIED -> PROPOSAL -> NEGOTIATION -> WON."""
        comp = self.create_test_company(self.alice)
        deal = self.create_test_deal(self.alice, comp.id)
        self.assertEqual(deal.stage, Stages.NEW)

        # 1. NEW -> QUALIFIED
        res = self.client.post(f'/api/deals/{deal.id}/stage', headers=self.auth_headers(self.alice), json={
            'stage': Stages.QUALIFIED
        })
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.get_json()['deal']['stage'], Stages.QUALIFIED)

        # 2. QUALIFIED -> PROPOSAL
        res = self.client.post(f'/api/deals/{deal.id}/stage', headers=self.auth_headers(self.alice), json={
            'stage': Stages.PROPOSAL
        })
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.get_json()['deal']['stage'], Stages.PROPOSAL)

        # 3. PROPOSAL -> NEGOTIATION
        res = self.client.post(f'/api/deals/{deal.id}/stage', headers=self.auth_headers(self.alice), json={
            'stage': Stages.NEGOTIATION
        })
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.get_json()['deal']['stage'], Stages.NEGOTIATION)

        # 4. NEGOTIATION -> WON
        res = self.client.post(f'/api/deals/{deal.id}/stage', headers=self.auth_headers(self.alice), json={
            'stage': Stages.WON
        })
        self.assertEqual(res.status_code, 200)
        data = res.get_json()['deal']
        self.assertEqual(data['stage'], Stages.WON)
        self.assertTrue(data['is_closed'])
        self.assertEqual(data['previous_stage'], Stages.NEGOTIATION)

    def test_skipping_stages_forward_rejected(self):
        """Skipping forward (e.g. NEW -> PROPOSAL, QUALIFIED -> NEGOTIATION) is rejected."""
        comp = self.create_test_company(self.alice)
        deal = self.create_test_deal(self.alice, comp.id)

        res = self.client.post(f'/api/deals/{deal.id}/stage', headers=self.auth_headers(self.alice), json={
            'stage': Stages.PROPOSAL
        })
        self.assertEqual(res.status_code, 422)
        self.assertEqual(res.get_json()['error']['code'], ErrorCodes.INVALID_STAGE_TRANSITION)

    def test_premature_closing_rejected(self):
        """Closing a deal directly from NEW, QUALIFIED, or PROPOSAL is rejected."""
        comp = self.create_test_company(self.alice)
        deal = self.create_test_deal(self.alice, comp.id)

        res_won = self.client.post(f'/api/deals/{deal.id}/stage', headers=self.auth_headers(self.alice), json={
            'stage': Stages.WON
        })
        self.assertEqual(res_won.status_code, 422)

        res_lost = self.client.post(f'/api/deals/{deal.id}/stage', headers=self.auth_headers(self.alice), json={
            'stage': Stages.LOST
        })
        self.assertEqual(res_lost.status_code, 422)

    def test_backward_move_rules(self):
        """Moving backward requires reason; moving backward >1 stage is rejected."""
        comp = self.create_test_company(self.alice)
        deal = self.create_test_deal(self.alice, comp.id)

        # Move to QUALIFIED
        self.client.post(f'/api/deals/{deal.id}/stage', headers=self.auth_headers(self.alice), json={
            'stage': Stages.QUALIFIED
        })

        # Backward without reason -> 422 BACKWARD_REASON_REQUIRED
        res_no_reason = self.client.post(f'/api/deals/{deal.id}/stage', headers=self.auth_headers(self.alice), json={
            'stage': Stages.NEW
        })
        self.assertEqual(res_no_reason.status_code, 422)
        self.assertEqual(res_no_reason.get_json()['error']['code'], ErrorCodes.BACKWARD_REASON_REQUIRED)

        # Backward with reason -> 200 and logged in history
        res_with_reason = self.client.post(f'/api/deals/{deal.id}/stage', headers=self.auth_headers(self.alice), json={
            'stage': Stages.NEW,
            'reason': 'Client leadership requested re-scoping'
        })
        self.assertEqual(res_with_reason.status_code, 200)
        self.assertEqual(res_with_reason.get_json()['deal']['stage'], Stages.NEW)

        # Check history record
        hist = DealHistory.query.filter_by(deal_id=deal.id, event_type='STAGE_BACKWARD').first()
        self.assertIsNotNone(hist)
        self.assertEqual(hist.reason, 'Client leadership requested re-scoping')

        # Advance to NEGOTIATION and try moving back 2 steps to QUALIFIED
        self.client.post(f'/api/deals/{deal.id}/stage', headers=self.auth_headers(self.alice), json={'stage': Stages.QUALIFIED})
        self.client.post(f'/api/deals/{deal.id}/stage', headers=self.auth_headers(self.alice), json={'stage': Stages.PROPOSAL})
        self.client.post(f'/api/deals/{deal.id}/stage', headers=self.auth_headers(self.alice), json={'stage': Stages.NEGOTIATION})

        res_two_steps = self.client.post(f'/api/deals/{deal.id}/stage', headers=self.auth_headers(self.alice), json={
            'stage': Stages.QUALIFIED,
            'reason': 'Trying to skip backward two steps'
        })
        self.assertEqual(res_two_steps.status_code, 422)
        self.assertEqual(res_two_steps.get_json()['error']['code'], ErrorCodes.INVALID_STAGE_TRANSITION)

    def test_closed_deal_locked_and_manager_reopen(self):
        """Closed deals are locked from stage edits; only managers can reopen to previous stage."""
        comp = self.create_test_company(self.alice)
        deal = self.create_test_deal(self.alice, comp.id)

        # Advance to NEGOTIATION and close as LOST
        self.client.post(f'/api/deals/{deal.id}/stage', headers=self.auth_headers(self.alice), json={'stage': Stages.QUALIFIED})
        self.client.post(f'/api/deals/{deal.id}/stage', headers=self.auth_headers(self.alice), json={'stage': Stages.PROPOSAL})
        self.client.post(f'/api/deals/{deal.id}/stage', headers=self.auth_headers(self.alice), json={'stage': Stages.NEGOTIATION})
        self.client.post(f'/api/deals/{deal.id}/stage', headers=self.auth_headers(self.alice), json={'stage': Stages.LOST})

        # Attempt to change stage on closed deal -> 422 DEAL_CLOSED
        res_locked = self.client.post(f'/api/deals/{deal.id}/stage', headers=self.auth_headers(self.alice), json={
            'stage': Stages.NEGOTIATION
        })
        self.assertEqual(res_locked.status_code, 422)
        self.assertEqual(res_locked.get_json()['error']['code'], ErrorCodes.DEAL_CLOSED)

        # Rep attempts reopen -> 403 MANAGER_REQUIRED
        res_rep_reopen = self.client.post(f'/api/deals/{deal.id}/reopen', headers=self.auth_headers(self.alice))
        self.assertEqual(res_rep_reopen.status_code, 403)
        self.assertEqual(res_rep_reopen.get_json()['error']['code'], ErrorCodes.MANAGER_REQUIRED)

        # Manager reopens deal -> 200, returns to NEGOTIATION
        res_mgr_reopen = self.client.post(f'/api/deals/{deal.id}/reopen', headers=self.auth_headers(self.manager))
        self.assertEqual(res_mgr_reopen.status_code, 200)
        reopened_data = res_mgr_reopen.get_json()['deal']
        self.assertEqual(reopened_data['stage'], Stages.NEGOTIATION)
        self.assertFalse(reopened_data['is_closed'])
        self.assertIsNone(reopened_data['closed_at'])
