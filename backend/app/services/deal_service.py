"""
Deal service - Business logic for Deals, Collaborators, and Visibility.
"""

from datetime import date, datetime, timezone

def _parse_date(d):
    if isinstance(d, str):
        return date.fromisoformat(d)
    return d
from app.extensions import db
from app.models.deal import Deal
from app.models.deal_collaborator import DealCollaborator
from app.models.deal_history import DealHistory
from app.models.company import Company
from app.models.user import User
from app.utils.constants import Roles, ErrorCodes, EventTypes
from app.utils.exceptions import AuthorizationError, ValidationError, NotFoundError
from app.services import visibility_service


def get_deals(current_user):
    """Get all deals visible to the user globally (powers global search, listing, aggregates)."""
    return visibility_service.get_visible_deals_query(current_user).order_by(Deal.expected_close_date.desc()).all()


def get_my_deals(current_user):
    """Get deals where current user is owner OR collaborator ONLY (spec §5 My Deals)."""
    return visibility_service.get_my_deals_query(current_user).order_by(Deal.expected_close_date.desc()).all()


def get_deal(current_user, deal_id):
    """Get a specific deal, enforcing visibility rules."""
    deal = Deal.query.filter_by(id=deal_id, deleted_at=None).first()
    if not deal:
        raise NotFoundError("Deal not found", code=ErrorCodes.DEAL_NOT_FOUND)

    # Enforce visibility via centralized query
    is_visible = visibility_service.get_visible_deals_query(current_user).filter(Deal.id == deal_id).first() is not None
    if not is_visible:
        raise AuthorizationError("You do not have access to this deal")

    return deal


def can_edit_deal(current_user, deal) -> bool:
    """Check if current user can edit deal fields (title, value, expected_close_date).

    Managers, deal owners, and collaborators can update deal details.
    """
    if current_user.role == Roles.SALES_MANAGER:
        return True
    if deal.owner_id == current_user.id:
        return True
    is_collaborator = DealCollaborator.query.filter_by(deal_id=deal.id, user_id=current_user.id).first() is not None
    return is_collaborator


def can_manage_collaborators(current_user, deal) -> bool:
    """Check if current user can add or remove collaborators on a deal.

    Only the deal owner or a sales manager can add/remove collaborators.
    """
    return current_user.role == Roles.SALES_MANAGER or deal.owner_id == current_user.id


def _validate_owner(owner_id):
    owner = User.query.get(owner_id)
    if not owner:
        raise ValidationError("Provided owner does not exist", code=ErrorCodes.USER_NOT_FOUND)
    if owner.role != Roles.SALES_REP:
        raise ValidationError("Deal owner must be a Sales Rep, never a Manager", code=ErrorCodes.VALIDATION_ERROR)
    return owner


def create_deal(current_user, data):
    """Create a new deal under a company."""
    company = Company.query.get(data['company_id'])
    if not company:
        raise ValidationError("Company does not exist", code=ErrorCodes.COMPANY_NOT_FOUND)
    if company.archived_at:
        raise ValidationError("Cannot create a deal for an archived company", code=ErrorCodes.COMPANY_ARCHIVED)

    # Manager vs Rep owner assignment
    if current_user.role == Roles.SALES_REP:
        data['owner_id'] = current_user.id
    else:
        if 'owner_id' not in data or not data['owner_id']:
            raise ValidationError("Sales Managers must explicitly assign a Sales Rep as the owner")

    owner = _validate_owner(data['owner_id'])

    deal = Deal(
        title=data['title'].strip(),
        value=data['value'],
        expected_close_date=_parse_date(data['expected_close_date']),
        company_id=data['company_id'],
        owner_id=owner.id
    )
    db.session.add(deal)
    db.session.flush()

    # Log initial creation event in audit timeline
    history_entry = DealHistory(
        deal_id=deal.id,
        event_type=EventTypes.DEAL_CREATED,
        old_value=None,
        new_value={
            'title': deal.title,
            'value': str(deal.value),
            'stage': deal.stage,
            'owner_id': deal.owner_id,
            'owner_name': owner.full_name,
        },
        actor_id=current_user.id,
        created_at=datetime.now(timezone.utc)
    )
    db.session.add(history_entry)
    db.session.commit()
    return deal


def update_deal(current_user, deal_id, data):
    """Update deal details or reassign deal owner."""
    deal = get_deal(current_user, deal_id)

    if not can_edit_deal(current_user, deal):
        raise AuthorizationError("You do not have permission to edit this deal")

    if 'title' in data and data['title'] is not None:
        deal.title = data['title'].strip()
    if 'value' in data and data['value'] is not None:
        deal.value = data['value']
    if 'expected_close_date' in data and data['expected_close_date'] is not None:
        deal.expected_close_date = _parse_date(data['expected_close_date'])

    if 'owner_id' in data and data['owner_id'] is not None:
        # Only Sales Managers can reassign deals
        if current_user.role != Roles.SALES_MANAGER:
            raise AuthorizationError("Only Sales Managers can reassign deals")

        new_owner = _validate_owner(data['owner_id'])
        if deal.owner_id != new_owner.id:
            old_owner = User.query.get(deal.owner_id)
            
            # If the new owner was previously a collaborator on this deal, remove collaboration record
            existing_collab = DealCollaborator.query.filter_by(deal_id=deal.id, user_id=new_owner.id).first()
            if existing_collab:
                db.session.delete(existing_collab)

            # Record immutable audit trail entry for OWNER_CHANGED
            history_entry = DealHistory(
                deal_id=deal.id,
                event_type=EventTypes.OWNER_CHANGED,
                old_value={'owner_id': deal.owner_id, 'owner_name': old_owner.full_name if old_owner else None},
                new_value={'owner_id': new_owner.id, 'owner_name': new_owner.full_name},
                actor_id=current_user.id,
                created_at=datetime.now(timezone.utc)
            )
            db.session.add(history_entry)

            # Optional keep previous owner as collaborator
            keep_as_collab = data.get('keep_previous_owner_as_collaborator', False)
            if keep_as_collab and old_owner and old_owner.role == Roles.SALES_REP:
                collab_check = DealCollaborator.query.filter_by(deal_id=deal.id, user_id=old_owner.id).first()
                if not collab_check:
                    new_collab = DealCollaborator(
                        deal_id=deal.id,
                        user_id=old_owner.id,
                        added_by=current_user.id,
                        created_at=datetime.now(timezone.utc)
                    )
                    db.session.add(new_collab)

                    collab_history = DealHistory(
                        deal_id=deal.id,
                        event_type=EventTypes.COLLABORATOR_ADDED,
                        old_value=None,
                        new_value={
                            'user_id': old_owner.id,
                            'user_name': old_owner.full_name,
                            'email': old_owner.email,
                            'note': 'Retained as collaborator upon owner reassignment'
                        },
                        actor_id=current_user.id,
                        created_at=datetime.now(timezone.utc)
                    )
                    db.session.add(collab_history)

            deal.owner_id = new_owner.id

    db.session.commit()
    return deal


def delete_deal(current_user, deal_id):
    """Delete (soft-delete) a deal."""
    deal = get_deal(current_user, deal_id)

    # Only manager or deal owner can delete a deal (collaborators cannot delete)
    if not (current_user.role == Roles.SALES_MANAGER or deal.owner_id == current_user.id):
        raise AuthorizationError("Only the deal owner or a sales manager can delete this deal")

    deal.deleted_at = datetime.now(timezone.utc)
    db.session.commit()
    return True


def add_collaborator(current_user, deal_id, user_id):
    """Add a sales rep as a collaborator to a deal."""
    deal = get_deal(current_user, deal_id)

    # Only owner or manager can add - a collaborator cannot add other
    # collaborators (prevents a deal from accumulating collaborators nobody
    # authorized).
    # Reject: target is the deal owner (owner isn't a "collaborator" on
    #   their own deal - redundant role, would break owner-vs-collaborator
    #   permission checks elsewhere).
    # Reject: target is a manager (spec scopes collaboration to reps only -
    #   managers already have full access, adding them as collaborator is
    #   meaningless and would pollute the collaborator list).
    # Reject: duplicate (unique constraint backstops this, but we check
    #   first to return a clear 422 instead of a raw DB error).
    if not can_manage_collaborators(current_user, deal):
        raise AuthorizationError("Only the deal owner or a sales manager can manage collaborators")

    target_user = User.query.get(user_id)
    if not target_user:
        raise NotFoundError("User not found", code=ErrorCodes.USER_NOT_FOUND)

    if user_id == deal.owner_id:
        raise ValidationError("Deal owner cannot be added as a collaborator", code=ErrorCodes.SELF_COLLABORATION)

    if target_user.role != Roles.SALES_REP:
        raise ValidationError("Collaborators must be Sales Reps, not Managers", code=ErrorCodes.INVALID_COLLABORATOR)

    existing_collaborator = DealCollaborator.query.filter_by(deal_id=deal.id, user_id=user_id).first()
    if existing_collaborator:
        raise ValidationError("User is already a collaborator on this deal", code=ErrorCodes.VALIDATION_ERROR)

    collab = DealCollaborator(
        deal_id=deal.id,
        user_id=user_id,
        added_by=current_user.id,
        created_at=datetime.now(timezone.utc)
    )
    db.session.add(collab)

    # COLLABORATOR_ADDED / COLLABORATOR_REMOVED events are NOT explicitly
    # required by the spec - §9 only requires stage changes, reason on backward
    # moves, and owner reassignments in the timeline. Logging collaborator
    # changes too is an extension for consistency with "history you cannot
    # rewrite." Flagged here and in docs/decisions.md, not presented as a
    # literal requirement.
    history_entry = DealHistory(
        deal_id=deal.id,
        event_type=EventTypes.COLLABORATOR_ADDED,
        old_value=None,
        new_value={'user_id': target_user.id, 'user_name': target_user.full_name, 'email': target_user.email},
        actor_id=current_user.id,
        created_at=datetime.now(timezone.utc)
    )
    db.session.add(history_entry)

    db.session.commit()
    return collab


def remove_collaborator(current_user, deal_id, user_id):
    """Remove a sales rep collaborator from a deal."""
    deal = get_deal(current_user, deal_id)

    if not can_manage_collaborators(current_user, deal):
        raise AuthorizationError("Only the deal owner or a sales manager can manage collaborators")

    collab = DealCollaborator.query.filter_by(deal_id=deal.id, user_id=user_id).first()
    if not collab:
        raise NotFoundError("Collaborator not found on this deal", code=ErrorCodes.NOT_FOUND)

    target_user = User.query.get(user_id)

    db.session.delete(collab)

    # Log collaborator removal in audit trail
    history_entry = DealHistory(
        deal_id=deal.id,
        event_type=EventTypes.COLLABORATOR_REMOVED,
        old_value={'user_id': target_user.id, 'user_name': target_user.full_name if target_user else None},
        new_value=None,
        actor_id=current_user.id,
        created_at=datetime.now(timezone.utc)
    )
    db.session.add(history_entry)

    db.session.commit()
    return True


def get_deal_collaborators(current_user, deal_id):
    """Get all collaborators for a deal."""
    deal = get_deal(current_user, deal_id)
    return DealCollaborator.query.filter_by(deal_id=deal.id).all()
