"""
Models package — import all models here so Alembic and Flask-Migrate can discover them.
"""

from app.models.user import User
from app.models.company import Company
from app.models.deal import Deal
from app.models.deal_collaborator import DealCollaborator
from app.models.deal_history import DealHistory

__all__ = ['User', 'Company', 'Deal', 'DealCollaborator', 'DealHistory']
