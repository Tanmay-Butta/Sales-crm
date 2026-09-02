"""
Dashboard routes — single aggregated landing view endpoint (Spec §8).
"""

from flask import Blueprint, jsonify
from app.middleware.auth import auth_required
from app.services import dashboard_service

dashboard_bp = Blueprint('dashboard', __name__, url_prefix='/api/dashboard')


@dashboard_bp.route('', methods=['GET'])
@auth_required
def get_dashboard(current_user):
    """
    Get dashboard metrics, breakdown by stage and owner, and 8-week won deals chart.
    Calculations strictly respect current user's role-based deal visibility.
    """
    data = dashboard_service.get_dashboard_data(current_user)
    return jsonify(data), 200
