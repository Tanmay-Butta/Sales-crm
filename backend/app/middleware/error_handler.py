"""
Global error handlers for consistent API error responses.
Every error — whether from our code or Flask/SQLAlchemy — returns the same JSON shape.
"""

from flask import jsonify
from marshmallow import ValidationError as MarshmallowValidationError
from sqlalchemy.exc import IntegrityError

from app.utils.exceptions import AppError


def register_error_handlers(flask_app):
    """Register all error handlers on the Flask app."""

    @flask_app.errorhandler(AppError)
    def handle_app_error(error):
        """Handle our custom application errors."""
        return jsonify(error.to_dict()), error.status_code

    @flask_app.errorhandler(MarshmallowValidationError)
    def handle_marshmallow_validation(error):
        """Handle Marshmallow validation errors."""
        return jsonify({
            'error': {
                'code': 'VALIDATION_ERROR',
                'message': 'Invalid input data',
                'details': error.messages,
            }
        }), 422

    @flask_app.errorhandler(IntegrityError)
    def handle_integrity_error(error):
        """Handle database integrity constraint violations."""
        from app.extensions import db
        db.session.rollback()
        return jsonify({
            'error': {
                'code': 'INTEGRITY_ERROR',
                'message': 'A database constraint was violated. The record may already exist.',
            }
        }), 409

    @flask_app.errorhandler(400)
    def handle_bad_request(error):
        return jsonify({
            'error': {
                'code': 'BAD_REQUEST',
                'message': str(error.description) if error.description else 'Bad request',
            }
        }), 400

    @flask_app.errorhandler(404)
    def handle_not_found(error):
        return jsonify({
            'error': {
                'code': 'NOT_FOUND',
                'message': 'The requested resource was not found',
            }
        }), 404

    @flask_app.errorhandler(405)
    def handle_method_not_allowed(error):
        return jsonify({
            'error': {
                'code': 'METHOD_NOT_ALLOWED',
                'message': 'This HTTP method is not allowed for this endpoint',
            }
        }), 405

    @flask_app.errorhandler(500)
    def handle_internal_error(error):
        from app.extensions import db
        db.session.rollback()
        return jsonify({
            'error': {
                'code': 'INTERNAL_ERROR',
                'message': 'An unexpected error occurred',
            }
        }), 500
