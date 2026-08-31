"""
Marshmallow schemas for Deal validation.
"""

from marshmallow import Schema, fields, validate

class DealCreateSchema(Schema):
    title = fields.Str(required=True, validate=validate.Length(min=1, max=255))
    value = fields.Decimal(required=True, validate=validate.Range(min=0))
    expected_close_date = fields.Date(required=True)
    company_id = fields.Int(required=True)
    
    # Manager can optionally assign owner on creation
    owner_id = fields.Int(required=False)

class DealUpdateSchema(Schema):
    title = fields.Str(required=False, validate=validate.Length(min=1, max=255))
    value = fields.Decimal(required=False, validate=validate.Range(min=0))
    expected_close_date = fields.Date(required=False)
    owner_id = fields.Int(required=False)
    keep_previous_owner_as_collaborator = fields.Bool(required=False, load_default=False)

from app.utils.constants import Stages

class DealStageChangeSchema(Schema):
    stage = fields.Str(required=True, validate=validate.OneOf(Stages.ALL))
    reason = fields.Str(required=False, allow_none=True)

class DealNoteSchema(Schema):
    """Schema for adding an immutable note to a deal's timeline.
    Notes are append-only — once created, they cannot be edited or deleted (§9).
    """
    note = fields.Str(required=True, validate=validate.Length(min=1, max=2000))

# Initialize schema instances
deal_create_schema = DealCreateSchema()
deal_update_schema = DealUpdateSchema()
deal_stage_change_schema = DealStageChangeSchema()
deal_note_schema = DealNoteSchema()

