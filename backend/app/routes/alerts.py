"""
Alerts routes — past-due deal notifications and dismissal (Spec §10).
"""

from flask import Blueprint, jsonify
from app.middleware.auth import auth_required
from app.services import alert_service

alerts_bp = Blueprint('alerts', __name__, url_prefix='/api/alerts')


@alerts_bp.route('', methods=['GET'])
@auth_required
def get_alerts(current_user):
    """
    Get all active past-due deal alerts visible to current_user.
    Includes deal metadata, overdue days, and dismissal capability.
    """
    data = alert_service.get_alerts_data(current_user)
    return jsonify(data), 200


@alerts_bp.route('/count', methods=['GET'])
@auth_required
def get_alerts_count(current_user):
    """
    Lightweight endpoint returning the total active past-due alerts count
    for dynamic navigation badge updates.
    """
    count = alert_service.get_alerts_count(current_user)
    return jsonify({'count': count}), 200


@alerts_bp.route('/<int:deal_id>/dismiss', methods=['POST'])
@auth_required
def dismiss_alert(current_user, deal_id):
    """
    Dismiss the past-due alert for a specific deal.
    Allowed only for the Deal's primary owner or a Sales Manager.
    Collaborators receive 403 Forbidden.
    """
    deal = alert_service.dismiss_alert(current_user, deal_id)
    return jsonify({
        'message': 'Alert dismissed successfully',
        'deal': deal.to_dict()
    }), 200
