"""
Goal 1: Accounts and roles.
- Sign in with email and password.
- Two roles: Sales Manager and Sales Rep.
- Difference enforced on server (manager-required gating on administrative endpoints).
- Public registration disabled (404).
- User provisioning strictly manager-gated and role-tamper proof.
- Directory listing permissions.
"""

from tests.base import BaseTestCase
from app.models.user import User
from app.utils.constants import Roles, ErrorCodes


class TestGoal1AccountsAndRoles(BaseTestCase):

    def test_login_success_and_role_claims(self):
        """Users can sign in with valid email and password, receiving JWT with correct role claims."""
        res = self.client.post('/api/auth/login', json={
            'email': 'manager@test.com',
            'password': 'password123'
        })
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertIn('access_token', data)
        self.assertEqual(data['user']['email'], 'manager@test.com')
        self.assertEqual(data['user']['role'], Roles.SALES_MANAGER)

        # Rep login
        res_rep = self.client.post('/api/auth/login', json={
            'email': 'alice@test.com',
            'password': 'password123'
        })
        self.assertEqual(res_rep.status_code, 200)
        rep_data = res_rep.get_json()
        self.assertEqual(rep_data['user']['role'], Roles.SALES_REP)

    def test_login_invalid_credentials(self):
        """Invalid password or nonexistent email is rejected with 401."""
        res = self.client.post('/api/auth/login', json={
            'email': 'manager@test.com',
            'password': 'wrongpassword'
        })
        self.assertEqual(res.status_code, 401)
        self.assertEqual(res.get_json()['error']['code'], ErrorCodes.INVALID_CREDENTIALS)

        res_none = self.client.post('/api/auth/login', json={
            'email': 'nobody@test.com',
            'password': 'password123'
        })
        self.assertEqual(res_none.status_code, 401)

    def test_public_registration_disabled(self):
        """Public /api/auth/register route must be completely disabled (returns 404)."""
        res = self.client.post('/api/auth/register', json={
            'email': 'attacker@test.com',
            'password': 'password123',
            'full_name': 'Attacker',
            'role': Roles.SALES_MANAGER
        })
        self.assertEqual(res.status_code, 404)

    def test_user_creation_manager_gated(self):
        """POST /api/auth/users requires authentication and manager role."""
        # 1. Unauthenticated request -> 401
        res_unauth = self.client.post('/api/auth/users', json={
            'email': 'newrep@test.com',
            'password': 'password123',
            'full_name': 'New Rep'
        })
        self.assertEqual(res_unauth.status_code, 401)

        # 2. Rep request -> 403 MANAGER_REQUIRED
        res_rep = self.client.post('/api/auth/users', headers=self.auth_headers(self.alice), json={
            'email': 'newrep@test.com',
            'password': 'password123',
            'full_name': 'New Rep'
        })
        self.assertEqual(res_rep.status_code, 403)
        self.assertEqual(res_rep.get_json()['error']['code'], ErrorCodes.MANAGER_REQUIRED)

    def test_user_creation_role_tampering_rejected(self):
        """Passing 'role' in creation payload is rejected with 422 VALIDATION_ERROR and creates no user."""
        initial_count = User.query.count()
        res = self.client.post('/api/auth/users', headers=self.auth_headers(self.manager), json={
            'email': 'tampered@test.com',
            'password': 'password123',
            'full_name': 'Tampered Account',
            'role': Roles.SALES_MANAGER
        })
        self.assertEqual(res.status_code, 422)
        body = res.get_json()
        self.assertEqual(body['error']['code'], ErrorCodes.VALIDATION_ERROR)
        self.assertIn('role', body['error']['details'])
        self.assertEqual(User.query.count(), initial_count)

    def test_manager_provisions_sales_rep_successfully(self):
        """Manager creates a sales rep: server forces role to SALES_REP and does not return usable session token."""
        res = self.client.post('/api/auth/users', headers=self.auth_headers(self.manager), json={
            'email': 'charlie@test.com',
            'password': 'password123',
            'full_name': 'Charlie Rep'
        })
        self.assertEqual(res.status_code, 201)
        data = res.get_json()
        self.assertEqual(data['user']['role'], Roles.SALES_REP)
        self.assertEqual(data['user']['email'], 'charlie@test.com')
        # Manager should NOT receive a session token for the new user
        self.assertIsNone(data.get('access_token'))

        # Verify new user can log in with their credentials
        login_res = self.client.post('/api/auth/login', json={
            'email': 'charlie@test.com',
            'password': 'password123'
        })
        self.assertEqual(login_res.status_code, 200)

    def test_duplicate_email_rejected(self):
        """Attempting to create user with existing email returns 422 EMAIL_ALREADY_EXISTS."""
        res = self.client.post('/api/auth/users', headers=self.auth_headers(self.manager), json={
            'email': 'alice@test.com',
            'password': 'password123',
            'full_name': 'Duplicate Alice'
        })
        self.assertEqual(res.status_code, 422)
        self.assertEqual(res.get_json()['error']['code'], ErrorCodes.EMAIL_ALREADY_EXISTS)

    def test_user_directory_access_control(self):
        """GET /api/auth/users is manager-only; GET /api/auth/users/reps is rep-accessible."""
        # Rep calling full user list -> 403
        rep_res = self.client.get('/api/auth/users', headers=self.auth_headers(self.alice))
        self.assertEqual(rep_res.status_code, 403)
        self.assertEqual(rep_res.get_json()['error']['code'], ErrorCodes.MANAGER_REQUIRED)

        # Manager calling full user list -> 200
        mgr_res = self.client.get('/api/auth/users', headers=self.auth_headers(self.manager))
        self.assertEqual(mgr_res.status_code, 200)
        users = mgr_res.get_json()['users']
        self.assertGreaterEqual(len(users), 3)

        # Rep calling reps-only list -> 200 with only sales reps
        reps_res = self.client.get('/api/auth/users/reps', headers=self.auth_headers(self.alice))
        self.assertEqual(reps_res.status_code, 200)
        reps = reps_res.get_json()['users']
        for r in reps:
            self.assertEqual(r['role'], Roles.SALES_REP)
