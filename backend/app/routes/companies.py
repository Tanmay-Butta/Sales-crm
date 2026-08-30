"""
Company routes.
"""

from flask import Blueprint, request, jsonify
from app.schemas.company import company_create_schema, company_update_schema
from app.services import company_service
from app.middleware.auth import auth_required

companies_bp = Blueprint('companies', __name__, url_prefix='/api/companies')

@companies_bp.route('', methods=['GET'])
@auth_required
def get_companies(current_user):
    show_archived = request.args.get('show_archived', 'false').lower() == 'true'
    companies = company_service.get_companies(current_user, show_archived)
    return jsonify({
        'companies': [
            {
                **c.to_dict(include_deals=True),
                'owner': c.owner.to_dict() if c.owner else None
            } for c in companies
        ]
    }), 200

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

