"""
Auth validation schemas using Marshmallow.
"""

from marshmallow import Schema, fields, validate


class RegisterSchema(Schema):
    email = fields.Email(required=True)
    password = fields.String(
        required=True,
        validate=validate.Length(min=8, max=128),
    )
    full_name = fields.String(
        required=True,
        validate=validate.Length(min=1, max=255),
    )
    role = fields.String(
        required=True,
        validate=validate.OneOf(['SALES_MANAGER', 'SALES_REP']),
    )


class LoginSchema(Schema):
    email = fields.Email(required=True)
    password = fields.String(required=True)


register_schema = RegisterSchema()
login_schema = LoginSchema()
