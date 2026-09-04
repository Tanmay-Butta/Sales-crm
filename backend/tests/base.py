"""
Base test case for Sales CRM tests.
Configures in-memory SQLite database, clean context per test, and test client helpers.
"""

import unittest
from datetime import date, datetime, timezone
from decimal import Decimal
from flask_jwt_extended import create_access_token

from app import create_app
from app.extensions import db
from app.models.user import User
from app.models.company import Company
from app.models.deal import Deal
from app.models.deal_collaborator import DealCollaborator
from app.models.deal_history import DealHistory
from app.services import auth_service, company_service, deal_service
from app.utils.constants import Roles, Stages


class BaseTestCase(unittest.TestCase):
    """Base class for all CRM test cases."""

    def setUp(self):
        self.app = create_app('testing')
        self.client = self.app.test_client()
        self.app_context = self.app.app_context()
        self.app_context.push()
        db.create_all()

        # Seed standard baseline accounts
        self.manager, self.manager_token = auth_service.register_user({
            'email': 'manager@test.com',
            'password': 'password123',
            'full_name': 'Manager Mike',
            'role': Roles.SALES_MANAGER,
        })

        self.alice, self.alice_token = auth_service.register_user({
            'email': 'alice@test.com',
            'password': 'password123',
            'full_name': 'Alice Rep',
            'role': Roles.SALES_REP,
        })

        self.bob, self.bob_token = auth_service.register_user({
            'email': 'bob@test.com',
            'password': 'password123',
            'full_name': 'Bob Rep',
            'role': Roles.SALES_REP,
        })

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.app_context.pop()

    def get_token(self, user):
        """Generate JWT token for a given user."""
        return create_access_token(
            identity=str(user.id),
            additional_claims={'role': user.role, 'email': user.email}
        )

    def auth_headers(self, user):
        """Return Authorization header dict for a given user."""
        token = self.get_token(user)
        return {
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json'
        }

    def create_test_company(self, user, name="Acme Corp", industry="Technology", website="https://acme.com", owner_id=None):
        """Helper to create a company."""
        data = {
            'name': name,
            'industry': industry,
            'website': website,
        }
        if owner_id is not None:
            data['owner_id'] = owner_id
        return company_service.create_company(user, data)

    def create_test_deal(self, user, company_id, owner_id=None, title="Test Deal", value="10000.00", expected_close_date=None, stage=Stages.NEW):
        """Helper to create a deal."""
        if expected_close_date is None:
            expected_close_date = date(2026, 12, 31).isoformat()
        elif isinstance(expected_close_date, date):
            expected_close_date = expected_close_date.isoformat()

        data = {
            'title': title,
            'value': str(value),
            'expected_close_date': expected_close_date,
            'company_id': company_id,
        }
        if owner_id is not None:
            data['owner_id'] = owner_id

        deal = deal_service.create_deal(user, data)
        if stage != Stages.NEW:
            # Advance to desired stage if needed
            deal.stage = stage
            db.session.commit()
        return deal
