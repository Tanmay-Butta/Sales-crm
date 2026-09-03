"""
Deal model for the Sales CRM application.
Represents sales opportunities associated with companies and assigned to Sales Reps.
"""

from datetime import datetime, timezone
from decimal import Decimal
from app.extensions import db
from app.utils.constants import Stages, WIN_PROBABILITIES


class Deal(db.Model):
    """Deal entity."""

    __tablename__ = 'deals'

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(255), nullable=False)
    value = db.Column(db.Numeric(15, 2), nullable=False)
    expected_close_date = db.Column(db.Date, nullable=False)
    stage = db.Column(db.String(20), nullable=False, default=Stages.NEW)
    previous_stage = db.Column(db.String(20), nullable=True)  # Stage before Won/Lost for reopen
    closed_at = db.Column(db.DateTime(timezone=True), nullable=True)

    company_id = db.Column(
        db.Integer, db.ForeignKey('companies.id'), nullable=False, index=True
    )
    owner_id = db.Column(
        db.Integer, db.ForeignKey('users.id'), nullable=False, index=True
    )

    alert_dismissed_for_date = db.Column(db.Date, nullable=True)

    created_at = db.Column(
        db.DateTime(timezone=True), nullable=False,
        default=lambda: datetime.now(timezone.utc)
    )
    updated_at = db.Column(
        db.DateTime(timezone=True), nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc)
    )
    deleted_at = db.Column(db.DateTime(timezone=True), nullable=True)

    # Relationships
    collaborators = db.relationship(
        'DealCollaborator', backref='deal', lazy=True,
        cascade='all, delete-orphan',
    )
    history = db.relationship(
        'DealHistory', backref='deal', lazy='dynamic',
        cascade='all, delete-orphan',
        order_by='DealHistory.created_at.asc()',
    )

    __table_args__ = (
        db.CheckConstraint("value >= 0", name='check_deal_value_positive'),
        db.CheckConstraint(
            "stage IN ('NEW','QUALIFIED','PROPOSAL','NEGOTIATION','WON','LOST')",
            name='check_deal_stage',
        ),
    )

    @property
    def is_closed(self):
        return self.stage in Stages.CLOSED

    @property
    def is_deleted(self):
        return self.deleted_at is not None

    @property
    def win_probability(self):
        return WIN_PROBABILITIES.get(self.stage, 0)

    @property
    def weighted_value(self):
        return self.value * Decimal(str(self.win_probability))

    def to_dict(self, include_company=False, include_owner=True, include_collaborators=True):
        """Serialize deal to dict."""
        data = {
            'id': self.id,
            'title': self.title,
            'value': str(self.value),  # String to preserve decimal precision
            'expected_close_date': self.expected_close_date.isoformat(),
            'stage': self.stage,
            'previous_stage': self.previous_stage,
            'company_id': self.company_id,
            'owner_id': self.owner_id,
            'is_closed': self.is_closed,
            'closed_at': self.closed_at.isoformat() if self.closed_at else None,
            'win_probability': self.win_probability,
            'weighted_value': str(self.weighted_value),
            'alert_dismissed_for_date': (
                self.alert_dismissed_for_date.isoformat()
                if self.alert_dismissed_for_date else None
            ),
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat(),
        }
        if include_company and self.company:
            data['company'] = {
                'id': self.company.id,
                'name': self.company.name,
                'industry': self.company.industry,
            }
        if include_owner and self.owner:
            data['owner'] = {
                'id': self.owner.id,
                'full_name': self.owner.full_name,
                'email': self.owner.email,
            }
        if include_collaborators:
            data['collaborators'] = [
                {
                    'id': dc.user.id,
                    'full_name': dc.user.full_name,
                    'email': dc.user.email,
                    'added_by': dc.added_by,
                    'added_at': dc.created_at.isoformat() if dc.created_at else None,
                }
                for dc in self.collaborators
                if dc.user
            ]
        return data
