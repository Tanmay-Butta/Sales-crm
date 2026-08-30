"""
DealCollaborator model — many-to-many join between deals and sales reps.
Constraint: a deal's owner cannot be its own collaborator (enforced in service layer).
"""

from app.extensions import db
from datetime import datetime, timezone


class DealCollaborator(db.Model):
    __tablename__ = 'deal_collaborators'

    id = db.Column(db.Integer, primary_key=True)
    deal_id = db.Column(db.Integer, db.ForeignKey('deals.id', ondelete='CASCADE'), nullable=False, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    added_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))

    @property
    def added_at(self):
        return self.created_at

    # Relationships to get collaborator and adder user info
    user = db.relationship('User', foreign_keys=[user_id], lazy='joined')
    added_by_user = db.relationship('User', foreign_keys=[added_by], lazy='joined')

    __table_args__ = (
        db.UniqueConstraint('deal_id', 'user_id', name='uq_deal_collaborator'),
    )

    def to_dict(self):
        return {
            'id': self.id,
            'deal_id': self.deal_id,
            'user_id': self.user_id,
            'added_by': self.added_by,
            'added_at': self.created_at.isoformat(),
            'user': {
                'id': self.user.id,
                'full_name': self.user.full_name,
                'email': self.user.email,
            } if self.user else None,
            'added_by_user': {
                'id': self.added_by_user.id,
                'full_name': self.added_by_user.full_name,
                'email': self.added_by_user.email,
            } if self.added_by_user else None,
        }
