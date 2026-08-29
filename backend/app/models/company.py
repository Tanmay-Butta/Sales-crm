"""
Company model — a company has an owning sales rep.
Supports soft-archive via archived_at timestamp.
"""

from app.extensions import db
from datetime import datetime, timezone


class Company(db.Model):
    __tablename__ = 'companies'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    industry = db.Column(db.String(255), nullable=False)
    website = db.Column(db.String(500))
    owner_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)

    # Soft-archive: NULL = active, timestamp = archived
    archived_at = db.Column(db.DateTime, nullable=True, index=True)

    created_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(
        db.DateTime, nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # Relationships
    deals = db.relationship('Deal', backref='company', lazy='dynamic')

    @property
    def is_archived(self):
        return self.archived_at is not None

    def to_dict(self, include_owner=True):
        """Serialize company to dict."""
        data = {
            'id': self.id,
            'name': self.name,
            'industry': self.industry,
            'website': self.website,
            'owner_id': self.owner_id,
            'is_archived': self.is_archived,
            'archived_at': self.archived_at.isoformat() if self.archived_at else None,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat(),
        }
        if include_owner and self.owner:
            data['owner'] = {
                'id': self.owner.id,
                'full_name': self.owner.full_name,
                'email': self.owner.email,
            }
        return data
