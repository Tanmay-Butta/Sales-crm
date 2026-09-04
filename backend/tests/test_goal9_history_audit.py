"""
Goal 9: History you cannot rewrite.
- Deal timeline records creation, stage transitions, owner changes, collaborators, and notes.
- Soft-deletion records immutable DEAL_DELETED event.
- No history records can be edited or deleted by anyone, including managers.
"""

from tests.base import BaseTestCase
from app.models.deal_history import DealHistory
from app.utils.constants import Stages


class TestGoal9HistoryAudit(BaseTestCase):

    def test_deal_creation_logs_history(self):
        """Creating a deal records DEAL_CREATED event in history timeline."""
        comp = self.create_test_company(self.alice)
        deal = self.create_test_deal(self.alice, comp.id, title="History Test Deal")

        events = DealHistory.query.filter_by(deal_id=deal.id).all()
        event_types = [e.event_type for e in events]
        self.assertIn('DEAL_CREATED', event_types)

    def test_stage_change_and_notes_logged_in_timeline(self):
        """Stage transitions and notes are recorded in history timeline."""
        comp = self.create_test_company(self.alice)
        deal = self.create_test_deal(self.alice, comp.id)

        # 1. Forward stage change
        self.client.post(f'/api/deals/{deal.id}/stage', headers=self.auth_headers(self.alice), json={
            'stage': Stages.QUALIFIED
        })

        # 2. Backward stage change with reason
        self.client.post(f'/api/deals/{deal.id}/stage', headers=self.auth_headers(self.alice), json={
            'stage': Stages.NEW,
            'reason': 'Customer requested delay'
        })

        # 3. Add note
        self.client.post(f'/api/deals/{deal.id}/notes', headers=self.auth_headers(self.alice), json={
            'note': 'Follow up scheduled for Monday'
        })

        res_history = self.client.get(f'/api/deals/{deal.id}/history', headers=self.auth_headers(self.alice))
        self.assertEqual(res_history.status_code, 200)
        history_list = res_history.get_json()['history']
        event_types = [h['event_type'] for h in history_list]

        self.assertIn('STAGE_CHANGED', event_types)
        self.assertIn('STAGE_BACKWARD', event_types)
        self.assertIn('NOTE_ADDED', event_types)

        # Verify backward reason stored
        bw_event = next(h for h in history_list if h['event_type'] == 'STAGE_BACKWARD')
        self.assertEqual(bw_event['reason'], 'Customer requested delay')

    def test_owner_reassignment_and_collab_logged(self):
        """Reassigning owner and managing collaborators generates timeline audit events."""
        comp = self.create_test_company(self.alice)
        deal = self.create_test_deal(self.alice, comp.id)

        # Add collaborator
        self.client.post(f'/api/deals/{deal.id}/collaborators', headers=self.auth_headers(self.alice), json={
            'user_id': self.bob.id
        })

        # Reassign owner to Bob via manager PUT /api/deals/<id>
        res_reassign = self.client.put(f'/api/deals/{deal.id}', headers=self.auth_headers(self.manager), json={
            'owner_id': self.bob.id
        })
        self.assertEqual(res_reassign.status_code, 200)

        res = self.client.get(f'/api/deals/{deal.id}/history', headers=self.auth_headers(self.manager))
        self.assertEqual(res.status_code, 200)
        events = res.get_json()['history']
        types = [e['event_type'] for e in events]
        self.assertIn('COLLABORATOR_ADDED', types)
        self.assertIn('OWNER_CHANGED', types)

    def test_deal_deletion_logs_immutable_delete_event(self):
        """Soft deleting a deal records a DEAL_DELETED event in deal history."""
        comp = self.create_test_company(self.alice)
        deal = self.create_test_deal(self.alice, comp.id, title="Audit Delete Deal")

        # Delete deal
        self.client.delete(f'/api/deals/{deal.id}', headers=self.auth_headers(self.alice))

        # Check history contains DEAL_DELETED
        del_event = DealHistory.query.filter_by(deal_id=deal.id, event_type='DEAL_DELETED').first()
        self.assertIsNotNone(del_event)
        self.assertEqual(del_event.actor_id, self.alice.id)

    def test_history_cannot_be_tampered_with(self):
        """No API routes exist to mutate or delete deal history records."""
        comp = self.create_test_company(self.alice)
        deal = self.create_test_deal(self.alice, comp.id)

        res_put = self.client.put(f'/api/deals/{deal.id}/history', headers=self.auth_headers(self.manager), json={})
        self.assertEqual(res_put.status_code, 405)

        res_delete = self.client.delete(f'/api/deals/{deal.id}/history', headers=self.auth_headers(self.manager))
        self.assertEqual(res_delete.status_code, 405)
