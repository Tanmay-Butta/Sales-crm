"""
Database Seeding Script for Sales CRM.
Seeds realistic companies, users, deals across various stages, values, close dates, collaborators, and history.
"""
import os
import sys
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from wsgi import app
from app.extensions import db
from app.models.user import User
from app.models.company import Company
from app.models.deal import Deal
from app.models.deal_collaborator import DealCollaborator
from app.models.deal_history import DealHistory
from app.services.auth_service import hash_password
from app.utils.constants import Roles, Stages, EventTypes


def seed_database():
    with app.app_context():
        print("[SEED] Seeding database with rich data...")

        # 1. Seed Users if not present
        users_data = [
            {'email': 'manager@test.com', 'full_name': 'Sarah Manager', 'role': Roles.SALES_MANAGER},
            {'email': 'alice@test.com', 'full_name': 'Alice Rep', 'role': Roles.SALES_REP},
            {'email': 'bob@test.com', 'full_name': 'Bob Rep', 'role': Roles.SALES_REP},
            {'email': 'charlie@test.com', 'full_name': 'Charlie Rep', 'role': Roles.SALES_REP},
            {'email': 'diana@test.com', 'full_name': 'Diana Rep', 'role': Roles.SALES_REP},
        ]

        users_by_email = {}
        for ud in users_data:
            user = User.query.filter_by(email=ud['email']).first()
            if not user:
                user = User(
                    email=ud['email'],
                    full_name=ud['full_name'],
                    role=ud['role'],
                    password_hash=hash_password('password123')
                )
                db.session.add(user)
                db.session.flush()
                print(f"  + Created user: {user.full_name} ({user.email})")
            users_by_email[ud['email']] = user

        db.session.commit()

        alice = users_by_email['alice@test.com']
        bob = users_by_email['bob@test.com']
        charlie = users_by_email['charlie@test.com']
        diana = users_by_email['diana@test.com']
        manager = users_by_email['manager@test.com']

        # 2. Seed Companies
        companies_data = [
            {'name': 'Acme Corp', 'industry': 'Manufacturing', 'website': 'https://acme.com', 'owner': alice},
            {'name': 'Beta LLC', 'industry': 'FinTech', 'website': 'https://betallc.io', 'owner': bob},
            {'name': 'Google Cloud', 'industry': 'Cloud Infrastructure', 'website': 'https://cloud.google.com', 'owner': alice},
            {'name': 'Stripe', 'industry': 'FinTech / Payments', 'website': 'https://stripe.com', 'owner': bob},
            {'name': 'OpenAI', 'industry': 'Artificial Intelligence', 'website': 'https://openai.com', 'owner': charlie},
            {'name': 'Datadog', 'industry': 'DevOps & Monitoring', 'website': 'https://datadoghq.com', 'owner': diana},
            {'name': 'Snowflake', 'industry': 'Data & Analytics', 'website': 'https://snowflake.com', 'owner': alice},
            {'name': 'Spotify', 'industry': 'Media & Audio', 'website': 'https://spotify.com', 'owner': bob},
            {'name': 'Shopify', 'industry': 'E-Commerce Platforms', 'website': 'https://shopify.com', 'owner': charlie},
            {'name': 'Notion Labs', 'industry': 'Productivity & SaaS', 'website': 'https://notion.so', 'owner': diana},
            {'name': 'Figma', 'industry': 'Design & Collaboration', 'website': 'https://figma.com', 'owner': alice},
            {'name': 'Vercel', 'industry': 'Frontend Cloud', 'website': 'https://vercel.com', 'owner': bob},
            {'name': 'Supabase', 'industry': 'Backend Infrastructure', 'website': 'https://supabase.com', 'owner': charlie},
            {'name': 'Airbnb', 'industry': 'Hospitality & Travel', 'website': 'https://airbnb.com', 'owner': diana},
            {'name': 'Slack Tech', 'industry': 'Enterprise Messaging', 'website': 'https://slack.com', 'owner': alice},
            {'name': 'HubSpot', 'industry': 'Marketing & CRM', 'website': 'https://hubspot.com', 'owner': bob},
            {'name': 'Linear Orbit', 'industry': 'Issue Tracking & Dev', 'website': 'https://linear.app', 'owner': charlie},
            {'name': 'Twilio', 'industry': 'Communications API', 'website': 'https://twilio.com', 'owner': diana},
        ]

        companies_by_name = {}
        for cd in companies_data:
            comp = Company.query.filter_by(name=cd['name']).first()
            if not comp:
                comp = Company(
                    name=cd['name'],
                    industry=cd['industry'],
                    website=cd['website'],
                    owner_id=cd['owner'].id
                )
                db.session.add(comp)
                db.session.flush()
                print(f"  + Created company: {comp.name} (Owned by {cd['owner'].full_name})")
            companies_by_name[cd['name']] = comp

        db.session.commit()

        # 3. Seed Realistic Deals (40+ deals across various stages, owners, companies, values)
        today = date.today()

        deals_catalog = [
            # High-Value Enterprise Deals
            {'title': 'Global Enterprise Infrastructure Rollout', 'company': 'Google Cloud', 'value': 285000.00, 'stage': Stages.NEGOTIATION, 'owner': alice, 'days_offset': 25, 'collabs': [bob, charlie]},
            {'title': 'Payment Processing Migration & Gateway API', 'company': 'Stripe', 'value': 175000.00, 'stage': Stages.PROPOSAL, 'owner': bob, 'days_offset': 40, 'collabs': [alice]},
            {'title': 'Enterprise AI Copilot Expansion Tier 3', 'company': 'OpenAI', 'value': 420000.00, 'stage': Stages.QUALIFIED, 'owner': charlie, 'days_offset': 60, 'collabs': [diana]},
            {'title': 'Full-Stack APM & Infrastructure Observability', 'company': 'Datadog', 'value': 95000.00, 'stage': Stages.NEW, 'owner': diana, 'days_offset': 90, 'collabs': []},
            {'title': 'Multi-Region Data Lakehouse Warehouse', 'company': 'Snowflake', 'value': 310000.00, 'stage': Stages.NEGOTIATION, 'owner': alice, 'days_offset': 15, 'collabs': [charlie]},
            
            # Mid-Market SaaS Deals
            {'title': 'Global Audio Streaming Analytics Pipeline', 'company': 'Spotify', 'value': 68000.00, 'stage': Stages.PROPOSAL, 'owner': bob, 'days_offset': 30, 'collabs': []},
            {'title': 'Enterprise E-Commerce Merchant Checkout API', 'company': 'Shopify', 'value': 140000.00, 'stage': Stages.QUALIFIED, 'owner': charlie, 'days_offset': 45, 'collabs': [bob]},
            {'title': 'Organization-Wide Knowledge Base Workspace', 'company': 'Notion Labs', 'value': 52000.00, 'stage': Stages.NEW, 'owner': diana, 'days_offset': 75, 'collabs': []},
            {'title': 'Design Systems & Enterprise FigJam License Pack', 'company': 'Figma', 'value': 88000.00, 'stage': Stages.NEGOTIATION, 'owner': alice, 'days_offset': 10, 'collabs': [diana]},
            {'title': 'Next.js Edge Deployment & Preview Workflow', 'company': 'Vercel', 'value': 45000.00, 'stage': Stages.PROPOSAL, 'owner': bob, 'days_offset': 35, 'collabs': []},
            
            # Additional Diverse Deals
            {'title': 'Managed PostgreSQL Cloud Clusters Tier 2', 'company': 'Supabase', 'value': 76000.00, 'stage': Stages.QUALIFIED, 'owner': charlie, 'days_offset': 50, 'collabs': [alice]},
            {'title': 'Travel Partner API & Dynamic Pricing Engine', 'company': 'Airbnb', 'value': 195000.00, 'stage': Stages.NEW, 'owner': diana, 'days_offset': 80, 'collabs': []},
            {'title': 'Enterprise Grid Messaging & Huddles Security', 'company': 'Slack Tech', 'value': 115000.00, 'stage': Stages.NEGOTIATION, 'owner': alice, 'days_offset': 18, 'collabs': [bob]},
            {'title': 'Marketing Automation & Inbound Lead Router', 'company': 'HubSpot', 'value': 62000.00, 'stage': Stages.PROPOSAL, 'owner': bob, 'days_offset': 28, 'collabs': []},
            {'title': 'Engineering Issue Tracking & Cycle Planner', 'company': 'Linear Orbit', 'value': 38000.00, 'stage': Stages.QUALIFIED, 'owner': charlie, 'days_offset': 65, 'collabs': []},
            {'title': 'Global SMS OTP & Voice Verification Relay', 'company': 'Twilio', 'value': 82000.00, 'stage': Stages.NEW, 'owner': diana, 'days_offset': 95, 'collabs': [charlie]},
            {'title': 'Heavy Machinery IoT Telemetry Dashboard', 'company': 'Acme Corp', 'value': 54000.00, 'stage': Stages.PROPOSAL, 'owner': alice, 'days_offset': 20, 'collabs': []},
            {'title': 'Core Banking Real-time Settlement Connector', 'company': 'Beta LLC', 'value': 125000.00, 'stage': Stages.NEGOTIATION, 'owner': bob, 'days_offset': 8, 'collabs': [alice]},

            # Overdue Deals (Past expected close dates for Goal 10 alerts!)
            {'title': 'Legacy ERP Cloud Migration Consultation', 'company': 'Acme Corp', 'value': 72000.00, 'stage': Stages.NEGOTIATION, 'owner': alice, 'days_offset': -12, 'collabs': [bob]},
            {'title': 'Security Compliance Audit & SOC2 Certification', 'company': 'Beta LLC', 'value': 48000.00, 'stage': Stages.PROPOSAL, 'owner': bob, 'days_offset': -5, 'collabs': []},
            {'title': 'Multi-Cloud Backup & Disaster Recovery Sync', 'company': 'Google Cloud', 'value': 110000.00, 'stage': Stages.QUALIFIED, 'owner': alice, 'days_offset': -20, 'collabs': []},
            {'title': 'Customer Success Onboarding Workflow Portal', 'company': 'Notion Labs', 'value': 35000.00, 'stage': Stages.NEW, 'owner': diana, 'days_offset': -8, 'collabs': []},

            # Won Deals (Closed)
            {'title': 'Annual Dedicated Server Hosting Contract', 'company': 'Datadog', 'value': 160000.00, 'stage': Stages.WON, 'owner': diana, 'days_offset': -30, 'collabs': [alice], 'is_closed': True},
            {'title': 'Global CDN & Web Application Firewall 2026', 'company': 'Vercel', 'value': 92000.00, 'stage': Stages.WON, 'owner': bob, 'days_offset': -45, 'collabs': [], 'is_closed': True},
            {'title': 'Enterprise License Seat Pack (500 Users)', 'company': 'Figma', 'value': 180000.00, 'stage': Stages.WON, 'owner': alice, 'days_offset': -15, 'collabs': [charlie], 'is_closed': True},

            # Lost Deals (Closed)
            {'title': 'Custom In-House LLM Fine-Tuning Sandbox', 'company': 'OpenAI', 'value': 250000.00, 'stage': Stages.LOST, 'owner': charlie, 'days_offset': -25, 'collabs': [], 'is_closed': True},
            {'title': 'Third-Party SMS Gateway Integration', 'company': 'Twilio', 'value': 40000.00, 'stage': Stages.LOST, 'owner': diana, 'days_offset': -40, 'collabs': [bob], 'is_closed': True},

            # More Pipeline Fillers across all stages
            {'title': 'Big Query ETL Pipeline Automation', 'company': 'Google Cloud', 'value': 135000.00, 'stage': Stages.NEW, 'owner': alice, 'days_offset': 110, 'collabs': []},
            {'title': 'Big Data Warehouse Optimization Package', 'company': 'Snowflake', 'value': 225000.00, 'stage': Stages.QUALIFIED, 'owner': alice, 'days_offset': 85, 'collabs': []},
            {'title': 'Big Scale Merchant Tokenization Vault', 'company': 'Stripe', 'value': 190000.00, 'stage': Stages.PROPOSAL, 'owner': bob, 'days_offset': 55, 'collabs': []},
            {'title': 'Big Commerce Multi-Store Sync Suite', 'company': 'Shopify', 'value': 115000.00, 'stage': Stages.NEGOTIATION, 'owner': charlie, 'days_offset': 14, 'collabs': [alice]},
            {'title': 'Kubernetes Cluster Monitoring Expansion', 'company': 'Datadog', 'value': 78000.00, 'stage': Stages.NEW, 'owner': diana, 'days_offset': 120, 'collabs': []},
            {'title': 'Vector Database Indexing Service', 'company': 'Supabase', 'value': 64000.00, 'stage': Stages.PROPOSAL, 'owner': charlie, 'days_offset': 42, 'collabs': []},
            {'title': 'Interactive Audio Ads Monetization SDK', 'company': 'Spotify', 'value': 85000.00, 'stage': Stages.NEW, 'owner': bob, 'days_offset': 90, 'collabs': []},
            {'title': 'Design Tokens Automation Plugin', 'company': 'Figma', 'value': 32000.00, 'stage': Stages.QUALIFIED, 'owner': alice, 'days_offset': 70, 'collabs': []},
            {'title': 'Sprint Velocity Analytics Dashboard', 'company': 'Linear Orbit', 'value': 46000.00, 'stage': Stages.PROPOSAL, 'owner': charlie, 'days_offset': 38, 'collabs': []},
            {'title': 'Automated Sales Sequence Emailer', 'company': 'HubSpot', 'value': 58000.00, 'stage': Stages.NEW, 'owner': bob, 'days_offset': 100, 'collabs': []},
            {'title': 'Corporate Identity SSO Integration', 'company': 'Slack Tech', 'value': 89000.00, 'stage': Stages.NEGOTIATION, 'owner': alice, 'days_offset': 12, 'collabs': [diana]},
            {'title': 'Emergency Alert Broadcasting Network', 'company': 'Twilio', 'value': 71000.00, 'stage': Stages.QUALIFIED, 'owner': diana, 'days_offset': 62, 'collabs': []},
            {'title': 'Internal Wiki Knowledge Graph Plugin', 'company': 'Notion Labs', 'value': 41000.00, 'stage': Stages.NEW, 'owner': diana, 'days_offset': 105, 'collabs': []},
            {'title': 'Dynamic Currency Converter for Booking', 'company': 'Airbnb', 'value': 105000.00, 'stage': Stages.PROPOSAL, 'owner': diana, 'days_offset': 48, 'collabs': [alice]},
        ]

        created_count = 0
        for dd in deals_catalog:
            comp = companies_by_name.get(dd['company'])
            if not comp:
                continue

            existing = Deal.query.filter_by(title=dd['title'], company_id=comp.id).first()
            if existing:
                continue

            close_date = today + timedelta(days=dd['days_offset'])
            is_closed = dd.get('is_closed', False)
            closed_at = datetime.now(timezone.utc) - timedelta(days=abs(dd['days_offset'])) if is_closed else None
            prev_stage = 'NEGOTIATION' if is_closed else None

            deal = Deal(
                title=dd['title'],
                value=Decimal(str(dd['value'])),
                expected_close_date=close_date,
                stage=dd['stage'],
                previous_stage=prev_stage,
                closed_at=closed_at,
                company_id=comp.id,
                owner_id=dd['owner'].id,
                created_at=datetime.now(timezone.utc) - timedelta(days=60),
                updated_at=datetime.now(timezone.utc) - timedelta(days=max(0, 30 - abs(dd['days_offset'])))
            )
            db.session.add(deal)
            db.session.flush()

            # Add creation history
            h_created = DealHistory(
                deal_id=deal.id,
                event_type=EventTypes.DEAL_CREATED,
                old_value=None,
                new_value={
                    'title': deal.title,
                    'value': str(deal.value),
                    'stage': 'NEW',
                    'owner_id': deal.owner_id,
                    'owner_name': dd['owner'].full_name,
                },
                actor_id=dd['owner'].id,
                created_at=deal.created_at
            )
            db.session.add(h_created)

            # If stage moved beyond NEW, add STAGE_CHANGED event
            if deal.stage != 'NEW':
                h_stage = DealHistory(
                    deal_id=deal.id,
                    event_type=EventTypes.DEAL_CLOSED if is_closed else EventTypes.STAGE_CHANGED,
                    old_value={'stage': 'NEW' if not is_closed else 'NEGOTIATION'},
                    new_value={'stage': deal.stage},
                    actor_id=dd['owner'].id,
                    created_at=deal.updated_at
                )
                db.session.add(h_stage)

            # Add collaborators
            for collab_user in dd.get('collabs', []):
                collab = DealCollaborator(
                    deal_id=deal.id,
                    user_id=collab_user.id,
                    added_by=manager.id,
                    created_at=datetime.now(timezone.utc) - timedelta(days=20)
                )
                db.session.add(collab)

                h_collab = DealHistory(
                    deal_id=deal.id,
                    event_type=EventTypes.COLLABORATOR_ADDED,
                    old_value=None,
                    new_value={
                        'user_id': collab_user.id,
                        'user_name': collab_user.full_name,
                        'email': collab_user.email,
                        'note': 'Added for joint enterprise pursuit'
                    },
                    actor_id=manager.id,
                    created_at=collab.created_at
                )
                db.session.add(h_collab)

            created_count += 1

        db.session.commit()
        total_deals = Deal.query.filter_by(deleted_at=None).count()
        print(f"[SUCCESS] Seeding complete! Added {created_count} new deals. Total active deals in database: {total_deals}")


if __name__ == '__main__':
    seed_database()
