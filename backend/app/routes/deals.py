"""
Deals routes - endpoints for Deals CRUD, My Deals, Collaborators, History, Notes, and Lifecycle state machine.
"""

from flask import Blueprint, request, jsonify
from app.middleware.auth import auth_required
from app.schemas.deal import deal_create_schema, deal_update_schema, deal_stage_change_schema, deal_note_schema
from app.services import deal_service
from app.models.deal_history import DealHistory
from app.utils.exceptions import ValidationError

deals_bp = Blueprint('deals', __name__, url_prefix='/api/deals')


@deals_bp.route('', methods=['GET'])
@auth_required
def get_deals(current_user):
    """Get deals visible to current user with search, filter, sort, and pagination."""
    search = request.args.get('search')
    company_id = request.args.get('company_id')
    stage = request.args.get('stage')
    owner_id = request.args.get('owner_id')
    view_mode = request.args.get('view_mode', 'all')
    sort_by = request.args.get('sort_by', 'updated_at')
    sort_dir = request.args.get('sort_dir', 'desc')
    page = request.args.get('page', 1)
    per_page = request.args.get('per_page', 20)

    result = deal_service.get_deals_paginated(
        current_user=current_user,
        search=search,
        company_id=company_id,
        stage=stage,
        owner_id=owner_id,
        view_mode=view_mode,
        sort_by=sort_by,
        sort_dir=sort_dir,
        page=page,
        per_page=per_page
    )

    return jsonify({
        'deals': [d.to_dict(include_company=True, include_owner=True, include_collaborators=True) for d in result['deals']],
        'total': result['total'],
        'page': result['page'],
        'per_page': result['per_page'],
        'pages': result['pages']
    }), 200


@deals_bp.route('/my-deals', methods=['GET'])
@auth_required
def get_my_deals(current_user):
    """Get deals where user is owner or collaborator (Spec §5 My Deals)."""
    deals = deal_service.get_my_deals(current_user)
    return jsonify({
        'deals': [d.to_dict(include_company=True, include_owner=True, include_collaborators=True) for d in deals]
    }), 200


@deals_bp.route('/<int:deal_id>', methods=['GET'])
@auth_required
def get_deal(current_user, deal_id):
    """Get a single deal."""
    deal = deal_service.get_deal(current_user, deal_id)
    return jsonify({'deal': deal.to_dict(include_company=True, include_owner=True, include_collaborators=True)}), 200


@deals_bp.route('', methods=['POST'])
@auth_required
def create_deal(current_user):
    """Create a new deal."""
    data = deal_create_schema.load(request.get_json())
    deal = deal_service.create_deal(current_user, data)
    return jsonify({'deal': deal.to_dict(include_company=True, include_owner=True, include_collaborators=True)}), 201


@deals_bp.route('/<int:deal_id>', methods=['PUT'])
@auth_required
def update_deal(current_user, deal_id):
    """Update deal basic info or reassign owner (Manager only)."""
    data = deal_update_schema.load(request.get_json())
    deal = deal_service.update_deal(current_user, deal_id, data)
    return jsonify({'deal': deal.to_dict(include_company=True, include_owner=True, include_collaborators=True)}), 200


@deals_bp.route('/<int:deal_id>', methods=['DELETE'])
@auth_required
def delete_deal(current_user, deal_id):
    """Soft-delete a deal."""
    deal_service.delete_deal(current_user, deal_id)
    return jsonify({'message': 'Deal deleted successfully'}), 200


# --- Lifecycle & State Machine Endpoints ---

@deals_bp.route('/<int:deal_id>/stage', methods=['POST'])
@auth_required
def change_stage(current_user, deal_id):
    """Transition a deal stage (forward, backward with reason, or close)."""
    data = deal_stage_change_schema.load(request.get_json())
    deal = deal_service.change_deal_stage(
        current_user, deal_id, data['stage'], data.get('reason')
    )
    return jsonify({
        'deal': deal.to_dict(include_company=True, include_owner=True, include_collaborators=True),
        'message': f"Deal moved to {deal.stage}"
    }), 200


@deals_bp.route('/<int:deal_id>/reopen', methods=['POST'])
@auth_required
def reopen_deal(current_user, deal_id):
    """Reopen a closed deal to its previous open stage (Sales Manager only)."""
    deal = deal_service.reopen_deal(current_user, deal_id)
    return jsonify({
        'deal': deal.to_dict(include_company=True, include_owner=True, include_collaborators=True),
        'message': f"Deal reopened to {deal.stage}"
    }), 200


# --- Collaborator Endpoints ---

@deals_bp.route('/<int:deal_id>/collaborators', methods=['GET'])
@auth_required
def get_collaborators(current_user, deal_id):
    """Get list of collaborators on a deal."""
    collaborators = deal_service.get_deal_collaborators(current_user, deal_id)
    return jsonify({'collaborators': [c.to_dict() for c in collaborators]}), 200


@deals_bp.route('/<int:deal_id>/collaborators', methods=['POST'])
@auth_required
def add_collaborator(current_user, deal_id):
    """Add a collaborator to a deal (Owner or Manager only)."""
    body = request.get_json() or {}
    user_id = body.get('user_id')
    if not user_id:
        raise ValidationError("user_id is required")

    collab = deal_service.add_collaborator(current_user, deal_id, int(user_id))
    return jsonify({'collaborator': collab.to_dict(), 'message': 'Collaborator added successfully'}), 201


@deals_bp.route('/<int:deal_id>/collaborators/<int:user_id>', methods=['DELETE'])
@auth_required
def remove_collaborator(current_user, deal_id, user_id):
    """Remove a collaborator from a deal (Owner or Manager only)."""
    deal_service.remove_collaborator(current_user, deal_id, user_id)
    return jsonify({'message': 'Collaborator removed successfully'}), 200


# --- History / Audit Trail Endpoint ---

@deals_bp.route('/<int:deal_id>/history', methods=['GET'])
@auth_required
def get_deal_history(current_user, deal_id):
    """Get immutable timeline audit trail for a deal.
    Returns history in reverse chronological order (newest first).
    No UPDATE or DELETE endpoint exists for history — this is intentional (§9).
    """
    deal = deal_service.get_deal(current_user, deal_id)
    history = DealHistory.query.filter_by(deal_id=deal.id).order_by(DealHistory.created_at.desc()).all()
    return jsonify({'history': [h.to_dict() for h in history]}), 200


# --- Notes Endpoint (Append-only, part of immutable timeline §9) ---

@deals_bp.route('/<int:deal_id>/notes', methods=['POST'])
@auth_required
def add_note(current_user, deal_id):
    """Add an immutable note to a deal's timeline. Once created, cannot be edited or deleted."""
    data = deal_note_schema.load(request.get_json())
    history_entry = deal_service.add_note(current_user, deal_id, data['note'])
    return jsonify({
        'history': history_entry.to_dict(),
        'message': 'Note added to deal timeline'
    }), 201
