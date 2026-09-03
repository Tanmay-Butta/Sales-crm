from flask import Blueprint, request, jsonify
from sqlalchemy.orm import joinedload, selectinload
from app.schemas.company import company_create_schema, company_update_schema
from app.services import company_service, visibility_service
from app.models.deal import Deal
from app.models.deal_collaborator import DealCollaborator
from app.middleware.auth import auth_required

companies_bp = Blueprint('companies', __name__, url_prefix='/api/companies')

@companies_bp.route('', methods=['GET'])
@auth_required
def get_companies(current_user):
    show_archived = request.args.get('show_archived', 'false').lower() == 'true'
    companies = company_service.get_companies(current_user, show_archived)
    
    company_ids = [c.id for c in companies]
    deals_by_company = {cid: [] for cid in company_ids}
    
    if company_ids:
        # 1. Fetch all visible deals across all companies in ONE single batch query
        visible_deals = visibility_service.get_visible_deals_query(current_user).filter(
            Deal.company_id.in_(company_ids)
        ).options(
            joinedload(Deal.owner),
            selectinload(Deal.collaborators)
        ).order_by(Deal.created_at.desc()).all()
        
        for d in visible_deals:
            d_dict = d.to_dict(include_company=False, include_owner=True, include_collaborators=True)
            deals_by_company.setdefault(d.company_id, []).append(d_dict)
            
    result = []
    for c in companies:
        company_data = c.to_dict(include_deals=False)
        company_data['deals'] = deals_by_company.get(c.id, [])
        company_data['owner'] = c.owner.to_dict() if c.owner else None
        result.append(company_data)
        
    return jsonify({'companies': result}), 200

@companies_bp.route('/<int:company_id>', methods=['GET'])
@auth_required
def get_company(current_user, company_id):
    company = company_service.get_company(current_user, company_id)
    company_data = company.to_dict(include_deals=False)
    deals = company_service.get_company_deals(current_user, company.id)
    company_data['deals'] = [d.to_dict(include_company=False, include_owner=True, include_collaborators=True) for d in deals]
    company_data['owner'] = company.owner.to_dict() if company.owner else None
    return jsonify({'company': company_data}), 200

@companies_bp.route('', methods=['POST'])
@auth_required
def create_company(current_user):
    data = company_create_schema.load(request.get_json())
    company = company_service.create_company(current_user, data)
    return jsonify({'company': company.to_dict()}), 201

@companies_bp.route('/<int:company_id>', methods=['PUT'])
@auth_required
def update_company(current_user, company_id):
    data = company_update_schema.load(request.get_json())
    company = company_service.update_company(current_user, company_id, data)
    return jsonify({'company': company.to_dict()}), 200

@companies_bp.route('/<int:company_id>/archive', methods=['PATCH'])
@auth_required
def archive_company(current_user, company_id):
    company = company_service.archive_company(current_user, company_id)
    return jsonify({'company': company.to_dict()}), 200

@companies_bp.route('/<int:company_id>/restore', methods=['PATCH'])
@auth_required
def restore_company(current_user, company_id):
    company = company_service.restore_company(current_user, company_id)
    return jsonify({'company': company.to_dict()}), 200

