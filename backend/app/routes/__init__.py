"""
Register all blueprints.
"""

from app.routes.auth import auth_bp
from app.routes.companies import companies_bp
from app.routes.deals import deals_bp
from app.routes.dashboard import dashboard_bp
from app.routes.alerts import alerts_bp

def register_routes(flask_app):
    """Register all route blueprints on the Flask app."""
    flask_app.register_blueprint(auth_bp)
    flask_app.register_blueprint(companies_bp)
    flask_app.register_blueprint(deals_bp)
    flask_app.register_blueprint(dashboard_bp)
    flask_app.register_blueprint(alerts_bp)
