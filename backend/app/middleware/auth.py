"""
Auth middleware — JWT verification and role-based access decorators.
These decorators enforce server-side authorization on every protected route.
"""

from functools import wraps
from flask_jwt_extended import get_jwt_identity, verify_jwt_in_request
from app.models.user import User
from app.utils.constants import Roles, ErrorCodes
from app.utils.exceptions import AuthorizationError, AuthenticationError


def get_current_user():
    """Get the current authenticated user from the JWT.
    Must be called within a request context after JWT verification.
    """
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user:
        raise AuthenticationError('User not found', code=ErrorCodes.TOKEN_INVALID)
    return user


def manager_required(fn):
    """Decorator: only SALES_MANAGER role can access this route."""
    @wraps(fn)
    def wrapper(*args, **kwargs):
        verify_jwt_in_request()
        user = get_current_user()
        if user.role != Roles.SALES_MANAGER:
            raise AuthorizationError(
                'Only sales managers can perform this action',
                code=ErrorCodes.MANAGER_REQUIRED,
            )
        return fn(user, *args, **kwargs)
    return wrapper


def auth_required(fn):
    """Decorator: any authenticated user (rep or manager) can access this route.
    Passes the current user as the first argument to the decorated function.
    """
    @wraps(fn)
    def wrapper(*args, **kwargs):
        verify_jwt_in_request()
        user = get_current_user()
        return fn(user, *args, **kwargs)
    return wrapper
