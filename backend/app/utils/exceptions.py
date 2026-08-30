"""
Custom exception classes for the Sales CRM application.
Each exception maps to a specific HTTP status code and error code.
"""


class AppError(Exception):
    """Base exception for all application errors."""

    def __init__(self, message, code=None, status_code=500):
        super().__init__(message)
        self.message = message
        self.code = code or 'INTERNAL_ERROR'
        self.status_code = status_code

    def to_dict(self):
        return {
            'error': {
                'code': self.code,
                'message': self.message,
            }
        }


class ValidationError(AppError):
    """422 — Valid JSON but invalid data."""

    def __init__(self, message, code='VALIDATION_ERROR'):
        super().__init__(message, code=code, status_code=422)


class AuthenticationError(AppError):
    """401 — Not authenticated."""

    def __init__(self, message='Authentication required', code='AUTHENTICATION_REQUIRED'):
        super().__init__(message, code=code, status_code=401)


class AuthorizationError(AppError):
    """403 — Authenticated but not authorized."""

    def __init__(self, message='You do not have permission to perform this action', code='NOT_AUTHORIZED'):
        super().__init__(message, code=code, status_code=403)


class NotFoundError(AppError):
    """404 — Resource not found or not accessible."""

    def __init__(self, message='Resource not found', code='NOT_FOUND'):
        super().__init__(message, code=code, status_code=404)


class BusinessRuleError(AppError):
    """409 — Business rule violation."""

    def __init__(self, message, code='BUSINESS_RULE_VIOLATION'):
        super().__init__(message, code=code, status_code=409)


class InternalError(AppError):
    """500 — Server-side invariant violation or critical state corruption."""

    def __init__(self, message='Internal invariant violation', code='INVARIANT_VIOLATION'):
        super().__init__(message, code=code, status_code=500)
