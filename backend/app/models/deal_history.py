"""
DealHistory model — immutable, append-only audit log.
No updated_at column. No UPDATE or DELETE operations allowed.
This is the single source of truth for what happened to a deal.
"""

from app.extensions import db
from datetime import datetime, timezone


class DealHistory(db.Model):
    __tablename__ = 'deal_history'

    id = db.Column(db.Integer, primary_key=True)
    deal_id = db.Column(db.Integer, db.ForeignKey('deals.id'), nullable=False, index=True)
    event_type = db.Column(db.String(50), nullable=False)
    old_value = db.Column(db.JSON, nullable=True)  # e.g. {"stage": "NEW"} or {"owner_id": 5}
    new_value = db.Column(db.JSON, nullable=True)  # e.g. {"stage": "QUALIFIED"} or {"owner_id": 7}
    reason = db.Column(db.Text, nullable=True)  # Only for backward stage moves
    actor_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(
        db.DateTime, nullable=False,
        default=lambda: datetime.now(timezone.utc),
        index=True,
    )
    # Intentionally NO updated_at — this table is immutable

    # Relationships
    actor = db.relationship('User', lazy='joined')

    __table_args__ = (
        db.CheckConstraint(
            "event_type IN ("
            "'DEAL_CREATED','STAGE_CHANGED','STAGE_BACKWARD',"
            "'DEAL_REOPENED','DEAL_CLOSED','OWNER_CHANGED',"
            "'COLLABORATOR_ADDED','COLLABORATOR_REMOVED','NOTE_ADDED'"
            ")",
            name='check_event_type',
        ),
    )

    def to_dict(self):
        """Serialize history entry to dict."""
        return {
            'id': self.id,
            'deal_id': self.deal_id,
            'event_type': self.event_type,
            'old_value': self.old_value,
            'new_value': self.new_value,
            'reason': self.reason,
            'actor_id': self.actor_id,
            'actor': {
                'id': self.actor.id,
                'full_name': self.actor.full_name,
            } if self.actor else None,
            'created_at': (
                self.created_at.replace(tzinfo=timezone.utc).isoformat()
                if self.created_at.tzinfo is None
                else self.created_at.isoformat()
            ),
        }
