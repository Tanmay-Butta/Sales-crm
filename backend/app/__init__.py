"""
Flask application factory.
Creates and configures the Flask app with all extensions, middleware, and routes.
"""

import os
from flask import Flask, request
import time
import logging

from app.config import config_by_name
from app.extensions import db, migrate, jwt, cors
from app.middleware.error_handler import register_error_handlers
from app.routes import register_routes


def create_app(config_name=None):
    """Create and configure the Flask application.

    Args:
        config_name: One of 'development', 'production', 'testing'.
                     Defaults to FLASK_ENV environment variable.
    """
    if config_name is None:
        config_name = os.environ.get('FLASK_ENV', 'development')

    flask_app = Flask(__name__)
    flask_app.config.from_object(config_by_name[config_name])

    # Configure structured server logging
    logging.basicConfig(
        level=logging.INFO,
        format='[%(asctime)s] %(levelname)s: %(message)s'
    )
    logger = logging.getLogger('sales_crm')

    @flask_app.before_request
    def log_incoming_request():
        request._start_time = time.time()
        logger.info(f" [REQ] {request.method} {request.path}")

    @flask_app.after_request
    def log_outgoing_response(response):
        duration_ms = 0
        if hasattr(request, '_start_time'):
            duration_ms = (time.time() - request._start_time) * 1000
        logger.info(f" [RES {response.status_code}] {request.method} {request.path} ({duration_ms:.1f}ms)")
        return response

    # Initialize extensions
    db.init_app(flask_app)
    migrate.init_app(flask_app, db)
    jwt.init_app(flask_app)
    cors.init_app(flask_app, resources={
        r"/api/*": {
            "origins": flask_app.config.get('FRONTEND_URL', '*'),
            "methods": ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
            "allow_headers": ["Content-Type", "Authorization"],
        }
    })

    # Import models so Alembic can see them
    with flask_app.app_context():
        from app import models  # noqa: F401

    # Register error handlers
    register_error_handlers(flask_app)

    # Register route blueprints
    register_routes(flask_app)

    # JWT error handlers for consistent error format
    @jwt.expired_token_loader
    def expired_token_callback(jwt_header, jwt_payload):
        return {
            'error': {
                'code': 'TOKEN_EXPIRED',
                'message': 'Your session has expired. Please log in again.',
            }
        }, 401

    @jwt.invalid_token_loader
    def invalid_token_callback(error_string):
        return {
            'error': {
                'code': 'TOKEN_INVALID',
                'message': f'Invalid authentication token: {error_string}',
            }
        }, 401

    @jwt.unauthorized_loader
    def missing_token_callback(error_string):
        return {
            'error': {
                'code': 'AUTHENTICATION_REQUIRED',
                'message': 'Authentication is required to access this resource.',
            }
        }, 401

    # Health check endpoint
    @flask_app.route('/api/health')
    def health():
        return {'status': 'healthy'}, 200

    return flask_app

