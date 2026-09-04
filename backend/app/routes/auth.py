"""
Auth routes — user management, login, and profile.
"""

from flask import Blueprint, request, jsonify

from app.schemas.auth import create_rep_schema, login_schema
from app.services import auth_service
from app.middleware.auth import auth_required, manager_required
from app.utils.constants import Roles

auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')


@auth_bp.route('/users', methods=['POST'])
@manager_required
def create_rep(current_user):
    """Create a new sales rep account (Manager-only)."""
    data = create_rep_schema.load(request.get_json())
    data['role'] = Roles.SALES_REP
    user, _ = auth_service.register_user(data)
    return jsonify({'user': user.to_dict()}), 201


@auth_bp.route('/login', methods=['POST'])
def login():
    """Authenticate and receive a JWT token."""
    data = login_schema.load(request.get_json())
    user, token = auth_service.login_user(data)
    return jsonify({
        'user': user.to_dict(),
        'access_token': token,
    }), 200


@auth_bp.route('/me', methods=['GET'])
@auth_required
def me(current_user):
    """Get the currently authenticated user's profile."""
    return jsonify({'user': current_user.to_dict()}), 200


@auth_bp.route('/users/reps', methods=['GET'])
@auth_required
def get_reps(current_user):
    """Get all sales reps (for dropdowns: assign deal owner, collaborators, etc.)."""
    reps = auth_service.get_all_reps()
    return jsonify({'users': [r.to_dict() for r in reps]}), 200


@auth_bp.route('/users', methods=['GET'])
@manager_required
def get_users(current_user):
    """Get all users (for admin views, manager-only)."""
    users = auth_service.get_all_users()
    return jsonify({'users': [u.to_dict() for u in users]}), 200
