"""add DEAL_DELETED to deal_history check constraint

Revision ID: b1c2d3e4f5a6
Revises: a942316df9ee
Create Date: 2026-09-04 13:25:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'b1c2d3e4f5a6'
down_revision = 'a942316df9ee'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('deal_history', schema=None) as batch_op:
        batch_op.drop_constraint('check_event_type', type_='check')
        batch_op.create_check_constraint(
            'check_event_type',
            "event_type IN ('DEAL_CREATED','STAGE_CHANGED','STAGE_BACKWARD','DEAL_REOPENED','DEAL_CLOSED','OWNER_CHANGED','COLLABORATOR_ADDED','COLLABORATOR_REMOVED','NOTE_ADDED','DEAL_DELETED')"
        )


def downgrade():
    with op.batch_alter_table('deal_history', schema=None) as batch_op:
        batch_op.drop_constraint('check_event_type', type_='check')
        batch_op.create_check_constraint(
            'check_event_type',
            "event_type IN ('DEAL_CREATED','STAGE_CHANGED','STAGE_BACKWARD','DEAL_REOPENED','DEAL_CLOSED','OWNER_CHANGED','COLLABORATOR_ADDED','COLLABORATOR_REMOVED','NOTE_ADDED')"
        )
