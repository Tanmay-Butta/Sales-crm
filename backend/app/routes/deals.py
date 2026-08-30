"""
Deals routes - endpoints for Deals CRUD.
"""

from flask import Blueprint, request, jsonify
from app.middleware.auth import auth_required
from app.schemas.deal import deal_create_schema, deal_update_schema
from app.services import deal_service

deals_bp = Blueprint('deals', __name__, url_prefix='/api/deals')

@deals_bp.route('', methods=['GET'])
@auth_required
def get_deals(current_user):
    deals = deal_service.get_deals(current_user)
    return jsonify({
        'deals': [d.to_dict(include_company=True, include_owner=True) for d in deals]
    }), 200

@deals_bp.route('/<int:deal_id>', methods=['GET'])
@auth_required
def get_deal(current_user, deal_id):
    deal = deal_service.get_deal(current_user, deal_id)
    return jsonify({'deal': deal.to_dict(include_company=True, include_owner=True)}), 200

@deals_bp.route('', methods=['POST'])
@auth_required
def create_deal(current_user):
    data = deal_create_schema.load(request.get_json())
    deal = deal_service.create_deal(current_user, data)
    return jsonify({'deal': deal.to_dict(include_company=True, include_owner=True)}), 201

@deals_bp.route('/<int:deal_id>', methods=['PUT'])
@auth_required
def update_deal(current_user, deal_id):
    data = deal_update_schema.load(request.get_json())
    deal = deal_service.update_deal(current_user, deal_id, data)
    return jsonify({'deal': deal.to_dict(include_company=True, include_owner=True)}), 200

@deals_bp.route('/<int:deal_id>', methods=['DELETE'])
@auth_required
def delete_deal(current_user, deal_id):
    deal_service.delete_deal(current_user, deal_id)
    return jsonify({'message': 'Deal deleted successfully'}), 200
