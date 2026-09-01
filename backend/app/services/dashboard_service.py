"""
Dashboard service — Aggregates pipeline metrics, breakdowns, and weekly won deals.
All calculations respect role-based deal visibility (Spec §8).
"""

from datetime import datetime, timezone, timedelta, date
from decimal import Decimal
from sqlalchemy import func, case
from app.extensions import db
from app.models.deal import Deal
from app.models.deal_history import DealHistory
from app.models.user import User
from app.utils.constants import Stages, WIN_PROBABILITIES
from app.services import visibility_service


def get_dashboard_data(current_user):
    """
    Computes all dashboard metrics in a single service call:
    1. Headline numbers (Open deals count, Weighted pipeline value, Won this month, Lost this month)
    2. Open deals by stage breakdown
    3. Open deals by owner breakdown
    4. Deals won per week over the last 8 weeks (with zero-win weeks preserved)
    """
    # Base query for all deals visible to this user
    visible_deals_query = visibility_service.get_visible_deals_query(current_user)

    # -------------------------------------------------------------
    # 1. Headline Numbers: Open Deals & Weighted Pipeline Value
    # -------------------------------------------------------------
    # Open deals are only those in NEW, QUALIFIED, PROPOSAL, NEGOTIATION
    open_deals_query = visible_deals_query.filter(
        Deal.stage.in_(Stages.OPEN_ORDERED)
    )

    open_deals_count = open_deals_query.count()

    # Calculate weighted value: sum of (deal.value * stage_probability) for open deals
    open_deals = open_deals_query.all()
    weighted_pipeline_value = sum(
        (deal.value * Decimal(str(WIN_PROBABILITIES.get(deal.stage, 0.0))))
        for deal in open_deals
    ) if open_deals else Decimal('0.00')

    # Total unweighted pipeline value (useful context alongside weighted)
    total_pipeline_value = sum(
        deal.value for deal in open_deals
    ) if open_deals else Decimal('0.00')

    # -------------------------------------------------------------
    # 2. Headline Numbers: Won This Month & Lost This Month
    # -------------------------------------------------------------
    # Month calculation based on closed_at datetime (IST/UTC aware)
    now_utc = datetime.now(timezone.utc)
    # Start of current month in UTC
    start_of_current_month = datetime(now_utc.year, now_utc.month, 1, 0, 0, 0, tzinfo=timezone.utc)
    
    # Next month start for clean boundary
    if now_utc.month == 12:
        start_of_next_month = datetime(now_utc.year + 1, 1, 1, 0, 0, 0, tzinfo=timezone.utc)
    else:
        start_of_next_month = datetime(now_utc.year, now_utc.month + 1, 1, 0, 0, 0, tzinfo=timezone.utc)

    # Closed deals query
    won_this_month = visible_deals_query.filter(
        Deal.stage == Stages.WON,
        Deal.closed_at >= start_of_current_month,
        Deal.closed_at < start_of_next_month
    ).count()

    lost_this_month = visible_deals_query.filter(
        Deal.stage == Stages.LOST,
        Deal.closed_at >= start_of_current_month,
        Deal.closed_at < start_of_next_month
    ).count()

    # -------------------------------------------------------------
    # 3. Open Deals by Stage Breakdown
    # -------------------------------------------------------------
    # Fixed order of stages
    stage_counts = {s: 0 for s in Stages.OPEN_ORDERED}
    stage_values = {s: Decimal('0.00') for s in Stages.OPEN_ORDERED}
    stage_weighted_values = {s: Decimal('0.00') for s in Stages.OPEN_ORDERED}

    for deal in open_deals:
        if deal.stage in stage_counts:
            stage_counts[deal.stage] += 1
            stage_values[deal.stage] += deal.value
            stage_weighted_values[deal.stage] += deal.weighted_value

    by_stage = [
        {
            'stage': s,
            'label': s.capitalize(),
            'count': stage_counts[s],
            'total_value': str(stage_values[s]),
            'weighted_value': str(stage_weighted_values[s]),
            'probability': int(WIN_PROBABILITIES.get(s, 0) * 100)
        }
        for s in Stages.OPEN_ORDERED
    ]

    # -------------------------------------------------------------
    # 4. Open Deals by Owner Breakdown
    # -------------------------------------------------------------
    owner_stats = {}
    for deal in open_deals:
        owner_id = deal.owner_id
        owner_name = deal.owner.full_name if deal.owner else f"User #{owner_id}"
        if owner_id not in owner_stats:
            owner_stats[owner_id] = {
                'owner_id': owner_id,
                'full_name': owner_name,
                'count': 0,
                'total_value': Decimal('0.00'),
                'weighted_value': Decimal('0.00')
            }
        owner_stats[owner_id]['count'] += 1
        owner_stats[owner_id]['total_value'] += deal.value
        owner_stats[owner_id]['weighted_value'] += deal.weighted_value

    by_owner = sorted(
        [
            {
                'owner_id': info['owner_id'],
                'full_name': info['full_name'],
                'count': info['count'],
                'total_value': str(info['total_value']),
                'weighted_value': str(info['weighted_value'])
            }
            for info in owner_stats.values()
        ],
        key=lambda x: x['count'],
        reverse=True
    )

    # -------------------------------------------------------------
    # 5. Deals Won Per Week Over the Last 8 Weeks (with zero-win weeks)
    # -------------------------------------------------------------
    # We define 8 weekly buckets ending on the current week's Sunday.
    # Current date
    today = now_utc.date()
    # Monday of current week
    current_week_monday = today - timedelta(days=today.weekday())

    # Build 8 weeks in chronological order (from 7 weeks ago to current week)
    weeks = []
    for i in range(7, -1, -1):
        w_monday = current_week_monday - timedelta(weeks=i)
        w_sunday = w_monday + timedelta(days=6)
        
        # Start and end datetimes in UTC
        w_start_dt = datetime.combine(w_monday, datetime.min.time(), tzinfo=timezone.utc)
        w_end_dt = datetime.combine(w_sunday, datetime.max.time(), tzinfo=timezone.utc)
        
        # Label format: e.g. "Jul 07" or "W1 (Jul 07)"
        label = w_monday.strftime('%b %d')
        full_label = f"{w_monday.strftime('%b %d')} - {w_sunday.strftime('%b %d')}"
        
        weeks.append({
            'week_index': 8 - i,
            'label': label,
            'full_label': full_label,
            'start_date': w_monday.isoformat(),
            'end_date': w_sunday.isoformat(),
            'start_dt': w_start_dt,
            'end_dt': w_end_dt,
            'count': 0,
            'total_value': Decimal('0.00')
        })

    # Earliest start date across 8 weeks
    earliest_start_dt = weeks[0]['start_dt']
    latest_end_dt = weeks[-1]['end_dt']

    # Query won deals in this window
    won_deals_in_window = visible_deals_query.filter(
        Deal.stage == Stages.WON,
        Deal.closed_at >= earliest_start_dt,
        Deal.closed_at <= latest_end_dt
    ).all()

    for deal in won_deals_in_window:
        if not deal.closed_at:
            continue
        deal_closed_at = deal.closed_at
        if deal_closed_at.tzinfo is None:
            deal_closed_at = deal_closed_at.replace(tzinfo=timezone.utc)
        
        for w in weeks:
            if w['start_dt'] <= deal_closed_at <= w['end_dt']:
                w['count'] += 1
                w['total_value'] += deal.value
                break

    # Clean up datetime objects from response dict
    wins_by_week = [
        {
            'week': f"W{w['week_index']}",
            'label': w['label'],
            'full_label': w['full_label'],
            'start_date': w['start_date'],
            'end_date': w['end_date'],
            'count': w['count'],
            'total_value': str(w['total_value'])
        }
        for w in weeks
    ]

    return {
        'headline': {
            'open_deals': open_deals_count,
            'weighted_pipeline': str(weighted_pipeline_value),
            'total_pipeline': str(total_pipeline_value),
            'won_this_month': won_this_month,
            'lost_this_month': lost_this_month
        },
        'by_stage': by_stage,
        'by_owner': by_owner,
        'wins_by_week': wins_by_week
    }
