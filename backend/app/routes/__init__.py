"""
Routes package — import and register all blueprints here.
"""

from app.routes.auth import auth_bp


def register_routes(flask_app):
    """Register all route blueprints on the Flask app."""
    flask_app.register_blueprint(auth_bp)
    # Future blueprints will be registered here:
    # flask_app.register_blueprint(companies_bp)
    # flask_app.register_blueprint(deals_bp)
    # flask_app.register_blueprint(dashboard_bp)
    # flask_app.register_blueprint(alerts_bp)
