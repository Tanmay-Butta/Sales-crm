"""
Goal 5: Collaborators.
- Single owner, multiple collaborators.
- Collaborators can update deal.
- Single rep can collaborate on multiple deals.
- Only deal owner or sales manager can add/remove collaborators.
- Reps see all deals where they are owner or collaborator (My Deals).
"""

from tests.base import BaseTestCase
from app.models.deal import Deal
from app.models.deal_collaborator import DealCollaborator
from app.utils.constants import Roles, Stages, ErrorCodes


class TestGoal5Collaborators(BaseTestCase):

    def test_add_and_remove_collaborator_permissions(self):
        """Only deal owner or manager can add/remove collaborators; other reps get 403."""
        comp = self.create_test_company(self.alice)
        deal = self.create_test_deal(self.alice, comp.id, title="Collab Deal")

        # Non-owner rep Bob tries to add collaborator -> 403
        res_bob_add = self.client.post(f'/api/deals/{deal.id}/collaborators', headers=self.auth_headers(self.bob), json={
            'user_id': self.bob.id
        })
        self.assertEqual(res_bob_add.status_code, 403)

        # Owner Alice adds Bob as collaborator -> 201
        res_alice_add = self.client.post(f'/api/deals/{deal.id}/collaborators', headers=self.auth_headers(self.alice), json={
            'user_id': self.bob.id
        })
        self.assertEqual(res_alice_add.status_code, 201)
        collab_entry = DealCollaborator.query.filter_by(deal_id=deal.id, user_id=self.bob.id).first()
        self.assertIsNotNone(collab_entry)

        # Manager removes Bob as collaborator -> 200
        res_mgr_del = self.client.delete(f'/api/deals/{deal.id}/collaborators/{self.bob.id}', headers=self.auth_headers(self.manager))
        self.assertEqual(res_mgr_del.status_code, 200)
        self.assertIsNone(DealCollaborator.query.filter_by(deal_id=deal.id, user_id=self.bob.id).first())

    def test_cannot_add_owner_as_collaborator_or_duplicates(self):
        """Adding the deal owner as collaborator or adding duplicate collaborator is rejected."""
        comp = self.create_test_company(self.alice)
        deal = self.create_test_deal(self.alice, comp.id)

        # Add owner Alice -> 422
        res_owner = self.client.post(f'/api/deals/{deal.id}/collaborators', headers=self.auth_headers(self.alice), json={
            'user_id': self.alice.id
        })
        self.assertEqual(res_owner.status_code, 422)

        # Add Bob once -> 201
        self.client.post(f'/api/deals/{deal.id}/collaborators', headers=self.auth_headers(self.alice), json={
            'user_id': self.bob.id
        })
        # Add Bob second time -> 422
        res_dup = self.client.post(f'/api/deals/{deal.id}/collaborators', headers=self.auth_headers(self.alice), json={
            'user_id': self.bob.id
        })
        self.assertEqual(res_dup.status_code, 422)

    def test_collaborator_can_update_deal(self):
        """A collaborator can update the deal (e.g. stage transition)."""
        comp = self.create_test_company(self.alice)
        deal = self.create_test_deal(self.alice, comp.id)

        # Owner Alice adds Bob as collaborator
        self.client.post(f'/api/deals/{deal.id}/collaborators', headers=self.auth_headers(self.alice), json={
            'user_id': self.bob.id
        })

        # Collaborator Bob advances stage from NEW to QUALIFIED -> 200
        res_bob_stage = self.client.post(f'/api/deals/{deal.id}/stage', headers=self.auth_headers(self.bob), json={
            'stage': Stages.QUALIFIED
        })
        self.assertEqual(res_bob_stage.status_code, 200)
        self.assertEqual(res_bob_stage.get_json()['deal']['stage'], Stages.QUALIFIED)

    def test_rep_my_deals_visibility(self):
        """A rep sees deals they own and deals they collaborate on, but not unrelated deals."""
        comp_a = self.create_test_company(self.alice, name="Alice Co")
        comp_b = self.create_test_company(self.bob, name="Bob Co")

        # Deal 1: Owned by Alice
        deal1 = self.create_test_deal(self.alice, comp_a.id, title="Alice Exclusive Deal")
        # Deal 2: Owned by Bob, Alice is collaborator
        deal2 = self.create_test_deal(self.bob, comp_b.id, title="Bob Deal with Alice Collab")
        self.client.post(f'/api/deals/{deal2.id}/collaborators', headers=self.auth_headers(self.bob), json={
            'user_id': self.alice.id
        })
        # Deal 3: Owned by Bob, Alice NOT a collaborator
        deal3 = self.create_test_deal(self.bob, comp_b.id, title="Bob Secret Deal")

        # Alice requests 'my_deals'
        res = self.client.get('/api/deals?view_mode=my_deals', headers=self.auth_headers(self.alice))
        self.assertEqual(res.status_code, 200)
        deal_ids = [d['id'] for d in res.get_json()['deals']]
        self.assertIn(deal1.id, deal_ids)
        self.assertIn(deal2.id, deal_ids)
        self.assertNotIn(deal3.id, deal_ids)
