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
from app.models.deal import Deal
from app.models.user import User
from app.utils.constants import Roles, ErrorCodes
from app.utils.exceptions import AuthorizationError, ValidationError, NotFoundError

from sqlalchemy.orm import joinedload
from app.services import visibility_service

def get_companies(current_user, show_archived=False):
    """Get all companies visible to the current user, eagerly loading owners."""
    return visibility_service.get_visible_companies_query(current_user, show_archived).options(
        joinedload(Company.owner)
    ).order_by(Company.name).all()

def get_company(current_user, company_id):
    """Get a specific company, checking visibility permissions."""
    company = Company.query.get(company_id)
    if not company:
        raise NotFoundError("Company not found", code=ErrorCodes.COMPANY_NOT_FOUND)
    
    if not visibility_service.can_view_company(current_user, company):
        raise AuthorizationError("You don't have access to this company")
        
    return company

def get_company_deals(current_user, company_id):
    """Get deals within a company visible to the current user (enforcing asymmetry)."""
    return visibility_service.get_deals_in_company_query(current_user, company_id).order_by(Deal.created_at.desc()).all()

def _validate_owner(owner_id):
    owner = User.query.get(owner_id)
    if not owner:
        raise ValidationError("Provided owner does not exist")
    if owner.role != Roles.SALES_REP:
        raise ValidationError("Company owner must be a Sales Rep, never a Manager", code=ErrorCodes.VALIDATION_ERROR)
    return owner

def _check_duplicate_name(name, current_user, exclude_company_id=None, allow_duplicate=False):
    """Prevent duplicate company creation across reps. Managers can optionally override."""
    clean_name = name.strip()
    query = Company.query.filter(db.func.lower(Company.name) == db.func.lower(clean_name))
    if exclude_company_id:
        query = query.filter(Company.id != exclude_company_id)
    
    existing = query.first()
    if existing:
        owner_name = existing.owner.full_name if existing.owner else f"Rep #{existing.owner_id}"
        archived_str = " (archived)" if existing.archived_at else ""
        
        if current_user.role == Roles.SALES_MANAGER:
            if not allow_duplicate:
                raise ValidationError(
                    f"A company named '{existing.name}' already exists{archived_str} (assigned to {owner_name}).",
                    code="DUPLICATE_COMPANY_WARNING"
                )
        else:
            raise ValidationError(
                f"A company named '{existing.name}' already exists{archived_str} (owned by {owner_name}). "
                f"Please coordinate with {owner_name} or a Sales Manager to collaborate.",
                code=ErrorCodes.VALIDATION_ERROR
            )

def create_company(current_user, data):
    name = data.get('name', '').strip()
    if not name:
        raise ValidationError("Company name is required")
        
    allow_duplicate = data.get('allow_duplicate', False) and current_user.role == Roles.SALES_MANAGER
    _check_duplicate_name(name, current_user, allow_duplicate=allow_duplicate)

    if current_user.role == Roles.SALES_REP:
        data['owner_id'] = current_user.id
    else:
        if 'owner_id' not in data or not data['owner_id']:
            raise ValidationError("Sales Managers must explicitly assign a Sales Rep as the owner")
    
    _validate_owner(data['owner_id'])

    company = Company(
        name=name,
        industry=data['industry'].strip(),
        website=data.get('website', '').strip() if data.get('website') else None,
        owner_id=data['owner_id']
    )
    db.session.add(company)
    db.session.commit()
    return company

def update_company(current_user, company_id, data):
    company = get_company(current_user, company_id)
    
    if current_user.role == Roles.SALES_REP and company.owner_id != current_user.id:
        raise AuthorizationError("Only the company owner can edit company details")

    if 'owner_id' in data:
        if current_user.role == Roles.SALES_REP and data['owner_id'] != company.owner_id:
            raise AuthorizationError("Sales Reps cannot reassign company ownership")
        if data['owner_id'] != company.owner_id:
            _validate_owner(data['owner_id'])
            company.owner_id = data['owner_id']

    if 'name' in data:
        new_name = data['name'].strip()
        if not new_name:
            raise ValidationError("Company name cannot be empty")
        if new_name.lower() != company.name.lower():
            allow_duplicate = data.get('allow_duplicate', False) and current_user.role == Roles.SALES_MANAGER
            _check_duplicate_name(new_name, current_user, exclude_company_id=company.id, allow_duplicate=allow_duplicate)
        company.name = new_name

    if 'industry' in data:
        company.industry = data['industry'].strip()
    if 'website' in data:
        company.website = data['website'].strip() if data['website'] else None
        
    db.session.commit()
    return company

def archive_company(current_user, company_id):
    company = get_company(current_user, company_id)
    
    if current_user.role == Roles.SALES_REP and company.owner_id != current_user.id:
        raise AuthorizationError("Only the company owner can archive the company")
        
    if not company.archived_at:
        company.archived_at = datetime.now(timezone.utc)
        db.session.commit()
    return company

def restore_company(current_user, company_id):
    company = get_company(current_user, company_id)
    
    if current_user.role == Roles.SALES_REP and company.owner_id != current_user.id:
        raise AuthorizationError("Only the company owner can restore the company")

    if company.archived_at:
        company.archived_at = None
        db.session.commit()
    return company

