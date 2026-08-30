"""
# Full reasoning: docs/decisions.md, "Company vs deal visibility"

Centralized visibility model for Companies and Deals.

The spec (README §1) only says reps see companies/deals they "own or
collaborate on." Read literally, that leaves a gap: if a manager reassigns
a deal to a rep who has no ownership stake in the parent company, that rep
has a deal to work but no way to see the company it belongs to.

Design decision (see docs/decisions.md): company ownership grants implicit
visibility into deals-in-that-company, and deal ownership/collaboration
grants implicit visibility into the parent company. Every screen that lists
companies or deals must go through the functions below — no screen may
implement its own filter, or the two lists (e.g. dashboard vs global search)
can silently disagree with each other.
"""

from app.extensions import db
from app.models.company import Company
from app.models.deal import Deal
from app.models.deal_collaborator import DealCollaborator
from app.utils.constants import Roles


def can_view_company(user, company) -> bool:
    """Check if a user has permission to view a specific company.

    # Manager: always true.
    # Rep: true if they own the company OR own/collaborate on >=1 deal in it.
    # This second clause is not stated in the spec directly - it's inferred
    # so a reassigned deal's new owner isn't locked out of the company page.
    """
    if user.role == Roles.SALES_MANAGER:
        return True

    if company.owner_id == user.id:
        return True

    # Check if user owns or collaborates on at least one deal in this company
    collaborating_deal_ids = db.session.query(DealCollaborator.deal_id).filter_by(user_id=user.id)
    has_deal = Deal.query.filter(
        Deal.company_id == company.id,
        Deal.deleted_at.is_(None),
        db.or_(
            Deal.owner_id == user.id,
            Deal.id.in_(collaborating_deal_ids)
        )
    ).first() is not None

    return has_deal


def get_visible_companies_query(user, show_archived=False):
    """Get SQLAlchemy query for all companies visible to the user.

    Applies to company listing pages.
    """
    query = Company.query

    if not show_archived:
        query = query.filter(Company.archived_at.is_(None))

    if user.role == Roles.SALES_MANAGER:
        return query

    # Sales Rep: own company OR own/collaborate on a deal in the company
    collaborating_deal_ids = db.session.query(DealCollaborator.deal_id).filter_by(user_id=user.id)
    deals_involving_rep = db.session.query(Deal.company_id).filter(
        Deal.deleted_at.is_(None),
        db.or_(
            Deal.owner_id == user.id,
            Deal.id.in_(collaborating_deal_ids)
        )
    )

    return query.filter(
        db.or_(
            Company.owner_id == user.id,
            Company.id.in_(deals_involving_rep)
        )
    )


def get_deals_in_company_query(user, company_id):
    """Get SQLAlchemy query for deals inside a company visible to the user.

    # Asymmetric on purpose: the company OWNER sees every deal inside their
    # company (their responsibility, spec-adjacent to point 2). Anyone who
    # can merely see the company via a single deal only sees THEIR deal(s),
    # not their teammates'. Don't collapse this into "if can_view_company,
    # return all deals" - that would leak deals a rep shouldn't see.
    """
    company = Company.query.get(company_id)
    if not company:
        return Deal.query.filter(db.false())

    query = Deal.query.filter(
        Deal.company_id == company_id,
        Deal.deleted_at.is_(None)
    )

    if user.role == Roles.SALES_MANAGER or company.owner_id == user.id:
        return query

    # Rep does not own the company -> only see deals they own or collaborate on
    collaborating_deal_ids = db.session.query(DealCollaborator.deal_id).filter_by(user_id=user.id)
    return query.filter(
        db.or_(
            Deal.owner_id == user.id,
            Deal.id.in_(collaborating_deal_ids)
        )
    )


def get_visible_deals_query(user):
    """Get SQLAlchemy query for all deals visible to the user globally.

    # Powers global search (§6), dashboard aggregates (§8), CSV export (§7).
    # Deliberately WIDER than get_my_deals_query - includes deals visible
    # only because the user owns the parent company.
    """
    query = Deal.query.filter(Deal.deleted_at.is_(None))

    if user.role == Roles.SALES_MANAGER:
        return query

    # Sales Rep: owns deal OR collaborates on deal OR owns the deal's parent company
    collaborating_deal_ids = db.session.query(DealCollaborator.deal_id).filter_by(user_id=user.id)
    owned_company_ids = db.session.query(Company.id).filter_by(owner_id=user.id)

    return query.filter(
        db.or_(
            Deal.owner_id == user.id,
            Deal.id.in_(collaborating_deal_ids),
            Deal.company_id.in_(owned_company_ids)
        )
    )


def get_my_deals_query(user):
    """Get SQLAlchemy query for deals specifically assigned to or collaborated on by the user.

    # Powers the "My Deals" list required by §5: owner OR collaborator ONLY.
    # Narrower than get_visible_deals_query on purpose - do not merge these
    # two functions even though they look similar. A rep who owns a company
    # but isn't on a given deal should NOT see it here.
    """
    query = Deal.query.filter(Deal.deleted_at.is_(None))

    if user.role == Roles.SALES_MANAGER:
        return query

    collaborating_deal_ids = db.session.query(DealCollaborator.deal_id).filter_by(user_id=user.id)
    return query.filter(
        db.or_(
            Deal.owner_id == user.id,
            Deal.id.in_(collaborating_deal_ids)
        )
    )
