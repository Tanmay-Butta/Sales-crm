"""
Deal service - Business logic for basic Deal CRUD (Phase 3A).
Lifecycle rules will be added in Phase 3B.
"""

from datetime import datetime, timezone
from app.extensions import db
from app.models.deal import Deal
from app.models.company import Company
from app.models.user import User
from app.utils.constants import Roles, ErrorCodes
from app.utils.exceptions import AuthorizationError, ValidationError, NotFoundError

def get_deals(current_user):
    """Get all deals the user is authorized to see."""
    query = Deal.query
    if current_user.role == Roles.SALES_REP:
        query = query.filter_by(owner_id=current_user.id)
    return query.order_by(Deal.expected_close_date.desc()).all()

def get_deal(current_user, deal_id):
    """Get a specific deal, enforcing visibility rules."""
    deal = Deal.query.get(deal_id)
    if not deal:
        raise NotFoundError("Deal not found", code=ErrorCodes.DEAL_NOT_FOUND)
    
    if current_user.role == Roles.SALES_REP and deal.owner_id != current_user.id:
        raise AuthorizationError("You do not have access to this deal")
    return deal

def _validate_owner(owner_id):
    owner = User.query.get(owner_id)
    if not owner:
        raise ValidationError("Provided owner does not exist")
    if owner.role != Roles.SALES_REP:
        raise ValidationError("Deal owner must be a Sales Rep, never a Manager", code=ErrorCodes.VALIDATION_ERROR)
    return owner

def create_deal(current_user, data):
    # Verify company exists and is not archived
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
    
    _validate_owner(data['owner_id'])

    deal = Deal(
        title=data['title'].strip(),
        value=data['value'],
        expected_close_date=data['expected_close_date'],
        company_id=data['company_id'],
        owner_id=data['owner_id']
    )
    db.session.add(deal)
    db.session.commit()
    return deal

def update_deal(current_user, deal_id, data):
    deal = get_deal(current_user, deal_id)
    
    if 'title' in data:
        deal.title = data['title'].strip()
    if 'value' in data:
        deal.value = data['value']
    if 'expected_close_date' in data:
        deal.expected_close_date = data['expected_close_date']
        
    if 'owner_id' in data:
        if current_user.role != Roles.SALES_MANAGER:
            raise AuthorizationError("Only Sales Managers can reassign deals")
        _validate_owner(data['owner_id'])
        deal.owner_id = data['owner_id']
        
    db.session.commit()
    return deal

def delete_deal(current_user, deal_id):
    deal = get_deal(current_user, deal_id)
    db.session.delete(deal)
    db.session.commit()
    return True

