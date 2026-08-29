"""
DealCollaborator model — many-to-many join between deals and sales reps.
Constraint: a deal's owner cannot be its own collaborator (enforced in service layer).
"""

from app.extensions import db
from datetime import datetime, timezone


class DealCollaborator(db.Model):
    __tablename__ = 'deal_collaborators'

    id = db.Column(db.Integer, primary_key=True)
    deal_id = db.Column(db.Integer, db.ForeignKey('deals.id', ondelete='CASCADE'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))

    # Relationship to get user info
    user = db.relationship('User', lazy='joined')

    __table_args__ = (
        db.UniqueConstraint('deal_id', 'user_id', name='uq_deal_collaborator'),
    )
