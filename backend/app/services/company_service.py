"""
Company service - Business logic for Companies.
Enforces invariants:
1. Sales Reps can only view/manage companies they own.
2. Sales Managers can view/manage all companies.
3. owner_id must ALWAYS reference a SALES_REP.
4. Archiving is soft-delete.
"""

from datetime import datetime, timezone
from app.extensions import db
from app.models.company import Company
from app.models.user import User
from app.utils.constants import Roles, ErrorCodes
from app.utils.exceptions import AuthorizationError, ValidationError, NotFoundError

def get_companies(current_user, show_archived=False):
    query = Company.query
    if not show_archived:
        query = query.filter_by(archived_at=None)

    if current_user.role == Roles.SALES_REP:
        query = query.filter_by(owner_id=current_user.id)
    
    return query.order_by(Company.name).all()


def get_company(current_user, company_id):
    company = Company.query.get(company_id)
    if not company:
        raise NotFoundError("Company not found", code=ErrorCodes.NOT_FOUND)
    
    if current_user.role == Roles.SALES_REP and company.owner_id != current_user.id:
        raise AuthorizationError("You don't have access to this company")
        
    return company


def _validate_and_get_owner(owner_id):
    owner = User.query.get(owner_id)
    if not owner:
        raise ValidationError("Provided owner does not exist")
    if owner.role != Roles.SALES_REP:
        raise ValidationError("Company owner must be a Sales Rep, never a Manager", code=ErrorCodes.VALIDATION_ERROR)
    return owner


def create_company(current_user, data):
    # Enforce ownership rules
    if current_user.role == Roles.SALES_REP:
        data['owner_id'] = current_user.id
    else:
        # Manager is creating
        if 'owner_id' not in data or not data['owner_id']:
            raise ValidationError("Sales Managers must explicitly assign a Sales Rep as the owner when creating a company")
            
    _validate_and_get_owner(data['owner_id'])
    
    company = Company(
        name=data['name'].strip(),
        industry=data['industry'].strip(),
        website=data.get('website'),
        owner_id=data['owner_id']
    )
    db.session.add(company)
    db.session.commit()
    return company


def update_company(current_user, company_id, data):
    company = get_company(current_user, company_id)
    
    if company.archived_at:
        raise ValidationError("Cannot modify an archived company")

    if 'owner_id' in data:
        if current_user.role == Roles.SALES_REP and data['owner_id'] != company.owner_id:
            raise AuthorizationError("Sales Reps cannot reassign company ownership")
        if data['owner_id'] != company.owner_id:
            _validate_and_get_owner(data['owner_id'])
            company.owner_id = data['owner_id']

    if 'name' in data:
        company.name = data['name'].strip()
    if 'industry' in data:
        company.industry = data['industry'].strip()
    if 'website' in data:
        company.website = data['website']
        
    db.session.commit()
    return company


def archive_company(current_user, company_id):
    company = get_company(current_user, company_id)
    if not company.archived_at:
        company.archived_at = datetime.now(timezone.utc)
        db.session.commit()
    return company


def restore_company(current_user, company_id):
    company = get_company(current_user, company_id)
    if company.archived_at:
        company.archived_at = None
        db.session.commit()
    return company
