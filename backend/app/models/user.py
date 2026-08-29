"""
User model — stores authentication credentials and role.
Roles: SALES_MANAGER, SALES_REP
"""

from app.extensions import db
from datetime import datetime, timezone


class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    full_name = db.Column(db.String(255), nullable=False)
    role = db.Column(
        db.String(20),
        nullable=False,
        # DB-level constraint: only these two roles allowed
    )
    created_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(
        db.DateTime, nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # Relationships
    owned_companies = db.relationship('Company', backref='owner', lazy='dynamic', foreign_keys='Company.owner_id')
    owned_deals = db.relationship('Deal', backref='owner', lazy='dynamic', foreign_keys='Deal.owner_id')

    __table_args__ = (
        db.CheckConstraint("role IN ('SALES_MANAGER', 'SALES_REP')", name='check_user_role'),
    )

    @property
    def is_manager(self):
        return self.role == 'SALES_MANAGER'

    @property
    def is_rep(self):
        return self.role == 'SALES_REP'

    def to_dict(self):
        """Serialize user to dict — NEVER includes password_hash."""
        return {
            'id': self.id,
            'email': self.email,
            'full_name': self.full_name,
            'role': self.role,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat(),
        }
