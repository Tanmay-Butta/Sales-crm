"""
Alert service — Manages past-due deal alerts and dismissal lifecycles (Goal 10).
All dates calculated with Indian Standard Time (IST, UTC+05:30).
"""

from datetime import datetime, timezone, timedelta, date
from sqlalchemy.orm import joinedload
from app.extensions import db
from app.models.deal import Deal
from app.utils.constants import Roles, ErrorCodes, Stages
from app.utils.exceptions import AuthorizationError
from app.services import visibility_service, deal_service


def get_today_ist():
    """Returns today's date in Indian Standard Time (IST, UTC+05:30)."""
    ist_tz = timezone(timedelta(hours=5, minutes=30))
    return datetime.now(ist_tz).date()


def get_active_alerts_query(current_user):
    """
    Returns a query for active past-due deal alerts visible to current_user.
    Conditions:
    - Deal is open (NEW, QUALIFIED, PROPOSAL, NEGOTIATION)
    - Deal expected_close_date < today_ist
    - alert_dismissed_for_date != expected_close_date (or is NULL)
    - Deal is not soft-deleted (enforced by visible_deals_query)
    """
    today = get_today_ist()
    visible_query = visibility_service.get_visible_deals_query(current_user)

    return visible_query.filter(
        Deal.stage.in_(Stages.OPEN_ORDERED),
        Deal.expected_close_date < today,
        db.or_(
            Deal.alert_dismissed_for_date.is_(None),
            Deal.alert_dismissed_for_date != Deal.expected_close_date
        )
    ).options(
        joinedload(Deal.company),
        joinedload(Deal.owner)
    ).order_by(Deal.expected_close_date.asc())


def get_alerts_data(current_user):
    """Returns serialized active alerts and total count for current_user."""
    today = get_today_ist()
    alerts_query = get_active_alerts_query(current_user)
    deals = alerts_query.all()

    alerts = []
    for d in deals:
        days_overdue = (today - d.expected_close_date).days
        can_dismiss = (current_user.role == Roles.SALES_MANAGER or d.owner_id == current_user.id)

        alerts.append({
            'deal_id': d.id,
            'title': d.title,
            'value': str(d.value),
            'stage': d.stage,
            'expected_close_date': d.expected_close_date.isoformat(),
            'days_overdue': days_overdue,
            'company': {
                'id': d.company.id,
                'name': d.company.name,
                'industry': d.company.industry
            } if d.company else None,
            'owner': {
                'id': d.owner.id,
                'full_name': d.owner.full_name,
                'email': d.owner.email
            } if d.owner else None,
            'can_dismiss': can_dismiss,
            'alert_dismissed_for_date': (
                d.alert_dismissed_for_date.isoformat()
                if d.alert_dismissed_for_date else None
            )
        })

    return {
        'count': len(alerts),
        'alerts': alerts
    }


def get_alerts_count(current_user):
    """Returns the total number of active past-due deal alerts for current_user."""
    return get_active_alerts_query(current_user).count()


def dismiss_alert(current_user, deal_id):
    """
    Dismisses the active past-due alert for the deal's current expected_close_date.
    Uses deal_service.get_deal() to enforce deal existence and visibility rules.
    Authorization: Deal primary owner or Sales Manager ONLY.
    Collaborators receive 403 Forbidden.
    """
    deal = deal_service.get_deal(current_user, deal_id)

    # Enforce dismissal permission: Primary Deal Owner or Sales Manager
    if current_user.role != Roles.SALES_MANAGER and deal.owner_id != current_user.id:
        raise AuthorizationError(
            "Only the deal owner or a sales manager can dismiss this alert",
            code=ErrorCodes.NOT_AUTHORIZED
        )

    # Set dismissal date to the current expected close date
    deal.alert_dismissed_for_date = deal.expected_close_date
    db.session.commit()
    return deal
