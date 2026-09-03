"""
Deal service - Business logic for Deals, Collaborators, and Visibility.
"""

import csv
import io
import math
from datetime import date, datetime, timezone
from flask import Response

def _parse_date(d):
    if isinstance(d, str):
        return date.fromisoformat(d)
    return d
from sqlalchemy.orm import joinedload, selectinload
from app.extensions import db
from app.models.deal import Deal
from app.models.deal_collaborator import DealCollaborator
from app.models.deal_history import DealHistory
from app.models.company import Company
from app.models.user import User
from app.utils.constants import (
    Roles, ErrorCodes, EventTypes, Stages, STAGE_TRANSITIONS,
    ALLOWED_DEAL_SORT_FIELDS, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE,
    WIN_PROBABILITIES
)
from app.utils.exceptions import AuthorizationError, ValidationError, NotFoundError, InternalError
from app.services import visibility_service


def get_deals(current_user):
    """Get all deals visible to the user globally (powers global search, listing, aggregates)."""
    return visibility_service.get_visible_deals_query(current_user).order_by(Deal.expected_close_date.desc()).all()


def get_deals_paginated(
    current_user,
    search=None,
    company_id=None,
    stage=None,
    owner_id=None,
    view_mode='all',
    sort_by='updated_at',
    sort_dir='desc',
    page=1,
    per_page=DEFAULT_PAGE_SIZE
):
    """Get deals visible to the user with server-side search, filtering, sorting, and pagination.
    
    100% database-executed query.
    Enforces visibility first so reps can never search or see unauthorized deals.
    """
    # 1. Base query from centralized visibility service
    query = visibility_service.get_visible_deals_query(current_user)

    # 2. View mode filtering (Server-side view tabs for Reps)
    if current_user.role == Roles.SALES_REP and view_mode:
        clean_view_mode = view_mode.lower().strip()
        collaborating_deal_ids = db.session.query(DealCollaborator.deal_id).filter_by(user_id=current_user.id)
        if clean_view_mode == 'my_deals':
            query = query.filter(
                db.or_(
                    Deal.owner_id == current_user.id,
                    Deal.id.in_(collaborating_deal_ids)
                )
            )
        elif clean_view_mode == 'via_company':
            owned_company_ids = db.session.query(Company.id).filter_by(owner_id=current_user.id)
            query = query.filter(
                Deal.company_id.in_(owned_company_ids),
                Deal.owner_id != current_user.id,
                ~Deal.id.in_(collaborating_deal_ids)
            )

    # 3. Company Filter (single ID or multiple IDs comma-separated / list)
    if company_id:
        try:
            if isinstance(company_id, (list, tuple, set)):
                cids = [int(x) for x in company_id if str(x).strip()]
                if cids:
                    query = query.filter(Deal.company_id.in_(cids))
            elif isinstance(company_id, str) and ',' in company_id:
                cids = [int(x.strip()) for x in company_id.split(',') if x.strip()]
                if cids:
                    query = query.filter(Deal.company_id.in_(cids))
            else:
                cid = int(company_id)
                query = query.filter(Deal.company_id == cid)
        except (ValueError, TypeError):
            raise ValidationError("Invalid company_id filter", code=ErrorCodes.VALIDATION_ERROR)

    # 4. Stage Filter
    if stage:
        clean_stage = stage.strip().upper()
        if clean_stage not in Stages.ALL:
            raise ValidationError(
                f"Invalid stage filter: '{stage}'. Allowed stages are: {', '.join(Stages.ALL)}",
                code=ErrorCodes.VALIDATION_ERROR
            )
        query = query.filter(Deal.stage == clean_stage)

    # 5. Owner Filter
    if owner_id:
        try:
            oid = int(owner_id)
            query = query.filter(Deal.owner_id == oid)
        except (ValueError, TypeError):
            raise ValidationError("Invalid owner_id filter", code=ErrorCodes.VALIDATION_ERROR)

    # 6. Text Search (Deal title & Company name - ANSI case-insensitive)
    if search and search.strip():
        term = f"%{search.strip().lower()}%"
        # Outer join Company to search by company name as well as deal title
        query = query.outerjoin(Company, Deal.company_id == Company.id).filter(
            db.or_(
                db.func.lower(Deal.title).like(term),
                db.func.lower(Company.name).like(term)
            )
        )

    # 7. Sorting
    clean_sort_by = (sort_by or 'updated_at').strip().lower()
    if clean_sort_by not in ALLOWED_DEAL_SORT_FIELDS:
        raise ValidationError(
            f"Invalid sort field: '{sort_by}'. Allowed sort fields are: {', '.join(ALLOWED_DEAL_SORT_FIELDS)}",
            code=ErrorCodes.VALIDATION_ERROR
        )

    clean_sort_dir = (sort_dir or 'desc').strip().lower()
    if clean_sort_dir not in ['asc', 'desc']:
        clean_sort_dir = 'desc'

    sort_col = getattr(Deal, clean_sort_by)
    order_expr = sort_col.asc() if clean_sort_dir == 'asc' else sort_col.desc()
    # Secondary deterministic tie-breaker on Deal.id to keep pagination consistent across pages
    query = query.order_by(order_expr, Deal.id.desc())

    # 8. Pagination
    try:
        page = int(page) if page else 1
        if page < 1:
            page = 1
    except (ValueError, TypeError):
        page = 1

    try:
        per_page = int(per_page) if per_page else DEFAULT_PAGE_SIZE
        if per_page < 1:
            per_page = DEFAULT_PAGE_SIZE
        if per_page > MAX_PAGE_SIZE:
            per_page = MAX_PAGE_SIZE
    except (ValueError, TypeError):
        per_page = DEFAULT_PAGE_SIZE

    total = query.count()
    pages = math.ceil(total / per_page) if total > 0 else 1
    offset = (page - 1) * per_page
    
    # Eager load relationships to prevent N+1 queries during serialization
    query = query.options(
        joinedload(Deal.company),
        joinedload(Deal.owner),
        selectinload(Deal.collaborators)
    )
    
    deals = query.offset(offset).limit(per_page).all()

    return {
        'deals': deals,
        'total': total,
        'page': page,
        'per_page': per_page,
        'pages': pages
    }


def get_my_deals(current_user):
    query = visibility_service.get_my_deals_query(current_user)
    return query.options(
        joinedload(Deal.company),
        joinedload(Deal.owner),
        selectinload(Deal.collaborators)
    ).order_by(Deal.expected_close_date.desc()).all()


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
        raise ValidationError("Deal owner must be a Sales Rep. Sales Managers cannot be deal owners.", code=ErrorCodes.VALIDATION_ERROR)
    return owner


def create_deal(current_user, data):
    """Create a new deal under a company."""
    company = Company.query.get(data['company_id'])
    if not company:
        raise ValidationError("Company does not exist", code=ErrorCodes.COMPANY_NOT_FOUND)
    if company.archived_at:
        raise ValidationError("Cannot create a deal for an archived company", code=ErrorCodes.COMPANY_ARCHIVED)

    # Security check: User must have visibility to the company to attach a deal to it.
    if not visibility_service.can_view_company(current_user, company):
        raise AuthorizationError("You do not have permission to attach deals to this company.")

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

    if 'stage' in data:
        raise ValidationError(
            "Direct stage edits are not permitted. Use the dedicated lifecycle transition endpoints (/api/deals/<id>/stage or /reopen).",
            code=ErrorCodes.VALIDATION_ERROR
        )

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


# --- Deal Lifecycle State Machine ---

def validate_stage_transition(deal, target_stage, reason=None):
    """Validate a stage transition against the state machine lookup table.

    Returns:
        tuple: (move_type, clean_reason) where move_type is 'FORWARD', 'BACKWARD', or 'CLOSE'.

    Raises:
        ValidationError: If the requested move is illegal or missing required reason.
    """
    if deal.is_closed:
        raise ValidationError(
            f"Deal is closed ({deal.stage}) and cannot change stages without being reopened by a Sales Manager first.",
            code=ErrorCodes.DEAL_CLOSED
        )

    if target_stage == deal.stage:
        raise ValidationError(
            f"Deal is already in the '{deal.stage}' stage.",
            code=ErrorCodes.VALIDATION_ERROR
        )

    transitions = STAGE_TRANSITIONS.get(deal.stage, {'forward': [], 'backward': [], 'close': []})

    if target_stage in transitions['forward']:
        return ('FORWARD', None)

    if target_stage in transitions['backward']:
        if not reason or not reason.strip():
            raise ValidationError(
                "A reason is required when moving a deal backward to an earlier stage.",
                code=ErrorCodes.BACKWARD_REASON_REQUIRED
            )
        return ('BACKWARD', reason.strip())

    if target_stage in transitions['close']:
        return ('CLOSE', None)

    # Rejection handling for explicit illegal moves:
    if target_stage in Stages.CLOSED:
        raise ValidationError(
            f"Deals can only be marked Won or Lost from the Negotiation stage (currently in '{deal.stage}').",
            code=ErrorCodes.INVALID_STAGE_TRANSITION
        )

    if target_stage in Stages.OPEN_ORDERED and deal.stage in Stages.OPEN_ORDERED:
        curr_idx = Stages.OPEN_ORDERED.index(deal.stage)
        target_idx = Stages.OPEN_ORDERED.index(target_stage)

        if target_idx > curr_idx:
            next_stage = transitions['forward'][0] if transitions['forward'] else 'Negotiation'
            raise ValidationError(
                f"Cannot skip stages. Deals must progress sequentially one stage at a time ({deal.stage} -> {next_stage}).",
                code=ErrorCodes.INVALID_STAGE_TRANSITION
            )
        elif target_idx < curr_idx - 1:
            prev_stage = transitions['backward'][0] if transitions['backward'] else 'New'
            raise ValidationError(
                f"Cannot move backward more than one stage at a time ({deal.stage} -> {prev_stage}).",
                code=ErrorCodes.INVALID_STAGE_TRANSITION
            )

    raise ValidationError(
        f"Invalid stage transition from '{deal.stage}' to '{target_stage}'.",
        code=ErrorCodes.INVALID_STAGE_TRANSITION
    )


def change_deal_stage(current_user, deal_id, target_stage, reason=None):
    """Transition a deal to a new stage enforcing lifecycle state machine rules."""
    deal = get_deal(current_user, deal_id)

    if not can_edit_deal(current_user, deal):
        raise AuthorizationError("You do not have permission to change the stage of this deal")

    move_type, clean_reason = validate_stage_transition(deal, target_stage, reason)
    old_stage = deal.stage

    if move_type == 'FORWARD':
        deal.stage = target_stage
        history_entry = DealHistory(
            deal_id=deal.id,
            event_type=EventTypes.STAGE_CHANGED,
            old_value={'stage': old_stage},
            new_value={'stage': target_stage},
            actor_id=current_user.id,
            created_at=datetime.now(timezone.utc)
        )
        db.session.add(history_entry)

    elif move_type == 'BACKWARD':
        deal.stage = target_stage
        history_entry = DealHistory(
            deal_id=deal.id,
            event_type=EventTypes.STAGE_BACKWARD,
            old_value={'stage': old_stage},
            new_value={'stage': target_stage},
            reason=clean_reason,
            actor_id=current_user.id,
            created_at=datetime.now(timezone.utc)
        )
        db.session.add(history_entry)

    elif move_type == 'CLOSE':
        deal.previous_stage = old_stage  # Store immediate open stage before closing
        deal.stage = target_stage
        deal.closed_at = datetime.now(timezone.utc)
        history_entry = DealHistory(
            deal_id=deal.id,
            event_type=EventTypes.DEAL_CLOSED,
            old_value={'stage': old_stage},
            new_value={'stage': target_stage},
            actor_id=current_user.id,
            created_at=datetime.now(timezone.utc)
        )
        db.session.add(history_entry)

    # Single atomic commit: deal mutation + history entry together.
    # Either both succeed or neither does — no orphaned history or missing audit trail.
    db.session.commit()
    return deal


def reopen_deal(current_user, deal_id):
    """Reopen a closed deal (Won or Lost). Sales Manager only."""
    if current_user.role != Roles.SALES_MANAGER:
        raise AuthorizationError("Only Sales Managers can reopen a closed deal", code=ErrorCodes.MANAGER_REQUIRED)

    deal = get_deal(current_user, deal_id)

    if not deal.is_closed:
        raise ValidationError("Deal is already open and cannot be reopened", code=ErrorCodes.VALIDATION_ERROR)

    # Invariant enforcement: loud failure if state corruption detected
    if not deal.previous_stage:
        raise InternalError(
            f"Corrupted state: closed deal #{deal.id} lacks previous_stage record",
            code=ErrorCodes.INVARIANT_VIOLATION
        )
    if deal.previous_stage not in Stages.OPEN_ORDERED:
        raise InternalError(
            f"Corrupted state: previous_stage '{deal.previous_stage}' is not a valid open stage",
            code=ErrorCodes.INVARIANT_VIOLATION
        )

    old_stage = deal.stage
    target_stage = deal.previous_stage

    deal.stage = target_stage
    deal.previous_stage = None
    deal.closed_at = None

    history_entry = DealHistory(
        deal_id=deal.id,
        event_type=EventTypes.DEAL_REOPENED,
        old_value={'stage': old_stage},
        new_value={'stage': target_stage},
        actor_id=current_user.id,
        created_at=datetime.now(timezone.utc)
    )
    db.session.add(history_entry)
    # Atomic: deal state change + history entry committed together
    db.session.commit()
    return deal


def add_note(current_user, deal_id, note_text):
    """Add an immutable note to a deal's audit timeline.

    Notes are append-only entries in the deal_history table.
    Once created, they cannot be edited or deleted — even by managers (§9).
    The note and its history entry are committed atomically.
    """
    deal = get_deal(current_user, deal_id)

    if not can_edit_deal(current_user, deal):
        raise AuthorizationError("You do not have permission to add notes to this deal")

    clean_note = note_text.strip()
    if not clean_note:
        raise ValidationError("Note text cannot be empty", code=ErrorCodes.VALIDATION_ERROR)

    history_entry = DealHistory(
        deal_id=deal.id,
        event_type=EventTypes.NOTE_ADDED,
        old_value=None,
        new_value={'note': clean_note},
        actor_id=current_user.id,
        created_at=datetime.now(timezone.utc)
    )
    db.session.add(history_entry)
    db.session.commit()
    return history_entry


# --- Goal 7: Bulk Deal Actions & Pipeline CSV Export ---

def bulk_advance_deals(current_user, deal_ids, negotiation_outcome=None):
    """
    Bulk advance selected deals to their next sequential stage.
    Only Sales Managers can perform bulk operations (§7).
    Each deal is processed individually and atomically so partial successes are preserved.

    Args:
        current_user: The authenticated user (must be SALES_MANAGER).
        deal_ids (list): List of deal IDs to advance.
        negotiation_outcome (str, optional): 'WON', 'LOST', or None.
            If 'WON' / 'LOST', deals at NEGOTIATION will be closed accordingly.
            If None, deals at NEGOTIATION will be skipped with an explanatory rejection message.

    Returns:
        dict: { total_requested, total_succeeded, total_failed, results }
    """
    if current_user.role != Roles.SALES_MANAGER:
        raise AuthorizationError("Only Sales Managers can perform bulk deal actions", code=ErrorCodes.MANAGER_REQUIRED)

    if not isinstance(deal_ids, list) or not deal_ids:
        raise ValidationError("deal_ids must be a non-empty list of integers", code=ErrorCodes.VALIDATION_ERROR)

    clean_outcome = None
    if negotiation_outcome:
        clean_outcome = str(negotiation_outcome).strip().upper()
        if clean_outcome not in [Stages.WON, Stages.LOST]:
            raise ValidationError(
                f"Invalid negotiation_outcome: '{negotiation_outcome}'. Must be 'WON', 'LOST', or omitted.",
                code=ErrorCodes.VALIDATION_ERROR
            )

    results = []
    total_succeeded = 0
    total_failed = 0

    for raw_id in deal_ids:
        deal_title = "Unknown"
        try:
            try:
                deal_id = int(raw_id)
            except (ValueError, TypeError):
                results.append({
                    "deal_id": raw_id,
                    "deal_title": "Unknown",
                    "success": False,
                    "reason": "Invalid deal ID format"
                })
                total_failed += 1
                continue

            deal = Deal.query.filter_by(id=deal_id, deleted_at=None).first()
            if not deal:
                results.append({
                    "deal_id": deal_id,
                    "deal_title": "Unknown",
                    "success": False,
                    "reason": "Deal not found or deleted"
                })
                total_failed += 1
                continue

            deal_title = deal.title

            if deal.is_closed:
                results.append({
                    "deal_id": deal_id,
                    "deal_title": deal_title,
                    "success": False,
                    "reason": f"Deal is already closed ({deal.stage}) and cannot advance"
                })
                total_failed += 1
                continue

            old_stage = deal.stage

            # Handle Negotiation stage
            if old_stage == Stages.NEGOTIATION:
                if clean_outcome == Stages.WON:
                    deal.previous_stage = old_stage
                    deal.stage = Stages.WON
                    deal.closed_at = datetime.now(timezone.utc)
                    deal.updated_at = datetime.now(timezone.utc)

                    history_entry = DealHistory(
                        deal_id=deal.id,
                        event_type=EventTypes.DEAL_CLOSED,
                        old_value={'stage': old_stage},
                        new_value={'stage': Stages.WON},
                        actor_id=current_user.id,
                        created_at=datetime.now(timezone.utc)
                    )
                    db.session.add(history_entry)
                    db.session.commit()

                    results.append({
                        "deal_id": deal_id,
                        "deal_title": deal_title,
                        "success": True,
                        "old_stage": old_stage,
                        "new_stage": Stages.WON,
                        "message": "Closed as WON from Negotiation"
                    })
                    total_succeeded += 1
                    continue

                elif clean_outcome == Stages.LOST:
                    deal.previous_stage = old_stage
                    deal.stage = Stages.LOST
                    deal.closed_at = datetime.now(timezone.utc)
                    deal.updated_at = datetime.now(timezone.utc)

                    history_entry = DealHistory(
                        deal_id=deal.id,
                        event_type=EventTypes.DEAL_CLOSED,
                        old_value={'stage': old_stage},
                        new_value={'stage': Stages.LOST},
                        actor_id=current_user.id,
                        created_at=datetime.now(timezone.utc)
                    )
                    db.session.add(history_entry)
                    db.session.commit()

                    results.append({
                        "deal_id": deal_id,
                        "deal_title": deal_title,
                        "success": True,
                        "old_stage": old_stage,
                        "new_stage": Stages.LOST,
                        "message": "Closed as LOST from Negotiation"
                    })
                    total_succeeded += 1
                    continue

                else:
                    results.append({
                        "deal_id": deal_id,
                        "deal_title": deal_title,
                        "success": False,
                        "reason": "Deal is at Negotiation stage. Closing as Won or Lost requires explicit outcome selection"
                    })
                    total_failed += 1
                    continue

            # Standard open stages: NEW -> QUALIFIED -> PROPOSAL -> NEGOTIATION
            transitions = STAGE_TRANSITIONS.get(deal.stage, {'forward': []})
            forward_stages = transitions.get('forward', [])
            if not forward_stages:
                results.append({
                    "deal_id": deal_id,
                    "deal_title": deal_title,
                    "success": False,
                    "reason": f"No forward stage exists from '{deal.stage}'"
                })
                total_failed += 1
                continue

            next_stage = forward_stages[0]

            deal.stage = next_stage
            deal.updated_at = datetime.now(timezone.utc)
            history_entry = DealHistory(
                deal_id=deal.id,
                event_type=EventTypes.STAGE_CHANGED,
                old_value={'stage': old_stage},
                new_value={'stage': next_stage},
                actor_id=current_user.id,
                created_at=datetime.now(timezone.utc)
            )
            db.session.add(history_entry)
            db.session.commit()

            results.append({
                "deal_id": deal_id,
                "deal_title": deal_title,
                "success": True,
                "old_stage": old_stage,
                "new_stage": next_stage,
                "message": f"Advanced from {old_stage} to {next_stage}"
            })
            total_succeeded += 1

        except Exception as e:
            db.session.rollback()
            results.append({
                "deal_id": raw_id,
                "deal_title": deal_title,
                "success": False,
                "reason": str(e)
            })
            total_failed += 1

    return {
        "total_requested": len(deal_ids),
        "total_succeeded": total_succeeded,
        "total_failed": total_failed,
        "results": results
    }


def bulk_reassign_deals(current_user, deal_ids, owner_id, keep_previous_owner_as_collaborator=True):
    """
    Bulk reassign selected deals to a new Sales Rep owner.
    Only Sales Managers can perform bulk operations (§7).
    Validates new owner exists and is a Sales Rep (Managers cannot own deals).
    Each deal is processed individually and atomically.

    Args:
        current_user: Authenticated user (must be SALES_MANAGER).
        deal_ids (list): List of deal IDs to reassign.
        owner_id (int): Target Sales Rep ID.
        keep_previous_owner_as_collaborator (bool): Whether previous rep owner is retained as collaborator.

    Returns:
        dict: { total_requested, total_succeeded, total_failed, results }
    """
    if current_user.role != Roles.SALES_MANAGER:
        raise AuthorizationError("Only Sales Managers can perform bulk deal actions", code=ErrorCodes.MANAGER_REQUIRED)

    if not isinstance(deal_ids, list) or not deal_ids:
        raise ValidationError("deal_ids must be a non-empty list of integers", code=ErrorCodes.VALIDATION_ERROR)

    new_owner = _validate_owner(owner_id)

    results = []
    total_succeeded = 0
    total_failed = 0

    for raw_id in deal_ids:
        deal_title = "Unknown"
        try:
            try:
                deal_id = int(raw_id)
            except (ValueError, TypeError):
                results.append({
                    "deal_id": raw_id,
                    "deal_title": "Unknown",
                    "success": False,
                    "reason": "Invalid deal ID format"
                })
                total_failed += 1
                continue

            deal = Deal.query.filter_by(id=deal_id, deleted_at=None).first()
            if not deal:
                results.append({
                    "deal_id": deal_id,
                    "deal_title": "Unknown",
                    "success": False,
                    "reason": "Deal not found or deleted"
                })
                total_failed += 1
                continue

            deal_title = deal.title

            if deal.owner_id == new_owner.id:
                results.append({
                    "deal_id": deal_id,
                    "deal_title": deal_title,
                    "success": False,
                    "reason": f"Deal is already owned by {new_owner.full_name}"
                })
                total_failed += 1
                continue

            old_owner = User.query.get(deal.owner_id)

            # If new owner was previously a collaborator on this deal, remove old collaboration record
            existing_collab = DealCollaborator.query.filter_by(deal_id=deal.id, user_id=new_owner.id).first()
            if existing_collab:
                db.session.delete(existing_collab)

            # Record immutable audit history entry for OWNER_CHANGED
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
            collab_msg = ""
            if keep_previous_owner_as_collaborator and old_owner and old_owner.role == Roles.SALES_REP:
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
                            'note': 'Retained as collaborator upon bulk owner reassignment'
                        },
                        actor_id=current_user.id,
                        created_at=datetime.now(timezone.utc)
                    )
                    db.session.add(collab_history)
                    collab_msg = f" ({old_owner.full_name} retained as collaborator)"

            deal.owner_id = new_owner.id
            deal.updated_at = datetime.now(timezone.utc)
            db.session.commit()

            results.append({
                "deal_id": deal_id,
                "deal_title": deal_title,
                "success": True,
                "message": f"Reassigned to {new_owner.full_name}{collab_msg}"
            })
            total_succeeded += 1

        except Exception as e:
            db.session.rollback()
            results.append({
                "deal_id": raw_id,
                "deal_title": deal_title,
                "success": False,
                "reason": str(e)
            })
            total_failed += 1

    return {
        "total_requested": len(deal_ids),
        "total_succeeded": total_succeeded,
        "total_failed": total_failed,
        "results": results
    }


def export_pipeline_csv(current_user, search=None, company_id=None, stage=None, owner_id=None, view_mode='all'):
    """
    Export the sales pipeline as a CSV file (§7).
    Scope: Every OPEN deal visible to the viewer (strictly excludes WON/LOST deals).
    Supports optional search, company, stage, owner, and view_mode filters.
    Columns: Company, Deal Title, Stage, Value, Weighted Value.
    Calculations: Uses standard fixed stage win probabilities from WIN_PROBABILITIES.
    """
    # 1. Base query from visibility service (strictly enforces role permissions)
    query = visibility_service.get_visible_deals_query(current_user)

    # 2. View Mode handling for Sales Reps
    if current_user.role == Roles.SALES_REP and view_mode:
        clean_view_mode = view_mode.strip().lower()
        collaborating_deal_ids = db.session.query(DealCollaborator.deal_id).filter_by(user_id=current_user.id)

        if clean_view_mode == 'my_deals':
            query = query.filter(
                db.or_(
                    Deal.owner_id == current_user.id,
                    Deal.id.in_(collaborating_deal_ids)
                )
            )
        elif clean_view_mode == 'via_company':
            owned_company_ids = db.session.query(Company.id).filter_by(owner_id=current_user.id)
            query = query.filter(
                Deal.company_id.in_(owned_company_ids),
                Deal.owner_id != current_user.id,
                ~Deal.id.in_(collaborating_deal_ids)
            )

    # 3. Company Filter (single ID or multiple IDs comma-separated / list)
    if company_id:
        try:
            if isinstance(company_id, (list, tuple, set)):
                cids = [int(x) for x in company_id if str(x).strip()]
                if cids:
                    query = query.filter(Deal.company_id.in_(cids))
            elif isinstance(company_id, str) and ',' in company_id:
                cids = [int(x.strip()) for x in company_id.split(',') if x.strip()]
                if cids:
                    query = query.filter(Deal.company_id.in_(cids))
            else:
                cid = int(company_id)
                query = query.filter(Deal.company_id == cid)
        except (ValueError, TypeError):
            pass

    # 4. Stage Filter (must still be an open stage to be included in pipeline export)
    if stage:
        clean_stage = stage.strip().upper()
        if clean_stage in Stages.ALL:
            query = query.filter(Deal.stage == clean_stage)

    # 5. Owner Filter
    if owner_id:
        try:
            oid = int(owner_id)
            query = query.filter(Deal.owner_id == oid)
        except (ValueError, TypeError):
            pass

    # 6. Search across Deal Title and Company Name
    query = query.outerjoin(Company, Deal.company_id == Company.id)
    if search and search.strip():
        term = f"%{search.strip().lower()}%"
        query = query.filter(
            db.or_(
                db.func.lower(Deal.title).like(term),
                db.func.lower(Company.name).like(term)
            )
        )

    # 7. Filter strictly to OPEN deals (not WON, not LOST, not deleted)
    query = query.filter(
        Deal.deleted_at == None,
        Deal.stage.in_(Stages.OPEN_ORDERED)
    ).order_by(Company.name.asc(), Deal.title.asc())

    open_deals = query.all()

    output = io.StringIO()
    writer = csv.writer(output)

    # Standard CSV Header
    writer.writerow(['Company', 'Deal Title', 'Stage', 'Value', 'Weighted Value'])

    for d in open_deals:
        comp_name = d.company.name if d.company else "Unknown"
        val = float(d.value)
        prob = WIN_PROBABILITIES.get(d.stage, 0.0)
        weighted_val = round(val * prob, 2)

        writer.writerow([
            comp_name,
            d.title,
            d.stage,
            f"{val:.2f}",
            f"{weighted_val:.2f}"
        ])

    csv_data = output.getvalue()
    output.close()

    filename = f"pipeline_export_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.csv"

    return Response(
        csv_data,
        mimetype="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename={filename}",
            "Content-Type": "text/csv; charset=utf-8"
        }
    )

