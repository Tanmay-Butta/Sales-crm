"""
Validation schemas for Company routes.
"""

from marshmallow import Schema, fields, validate

class CompanyCreateSchema(Schema):
    name = fields.Str(required=True, validate=validate.Length(min=1, max=255))
    industry = fields.Str(required=True, validate=validate.Length(min=1, max=255))
    website = fields.Url(required=False, allow_none=True)
    owner_id = fields.Int(required=False, allow_none=True)

class CompanyUpdateSchema(Schema):
    name = fields.Str(required=False, validate=validate.Length(min=1, max=255))
    industry = fields.Str(required=False, validate=validate.Length(min=1, max=255))
    website = fields.Url(required=False, allow_none=True)
    owner_id = fields.Int(required=False, allow_none=True)

company_create_schema = CompanyCreateSchema()
company_update_schema = CompanyUpdateSchema()
