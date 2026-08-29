"""
Auth service — handles user registration, login, and JWT token generation.
All password hashing happens here. No raw passwords ever leave this layer.
"""

import bcrypt
from flask_jwt_extended import create_access_token

from app.extensions import db
from app.models.user import User
from app.utils.constants import ErrorCodes
from app.utils.exceptions import ValidationError, AuthenticationError


def hash_password(password: str) -> str:
    """Hash a password using bcrypt."""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def verify_password(password: str, password_hash: str) -> bool:
    """Verify a password against its bcrypt hash."""
    return bcrypt.checkpw(password.encode('utf-8'), password_hash.encode('utf-8'))


def register_user(data: dict) -> tuple[User, str]:
    """Register a new user. Returns (user, access_token).

    Raises:
        ValidationError: If email already exists.
    """
    # Check for existing email
    existing = User.query.filter_by(email=data['email'].lower()).first()
    if existing:
        raise ValidationError(
            f"A user with email '{data['email']}' already exists",
            code=ErrorCodes.EMAIL_ALREADY_EXISTS,
        )

    user = User(
        email=data['email'].lower().strip(),
        password_hash=hash_password(data['password']),
        full_name=data['full_name'].strip(),
        role=data['role'],
    )
    db.session.add(user)
    db.session.commit()

    # Generate JWT
    access_token = create_access_token(
        identity=str(user.id),
        additional_claims={
            'role': user.role,
            'email': user.email,
        },
    )

    return user, access_token


def login_user(data: dict) -> tuple[User, str]:
    """Authenticate a user and return (user, access_token).

    Raises:
        AuthenticationError: If credentials are invalid.
    """
    user = User.query.filter_by(email=data['email'].lower().strip()).first()

    if not user or not verify_password(data['password'], user.password_hash):
        raise AuthenticationError(
            'Invalid email or password',
            code=ErrorCodes.INVALID_CREDENTIALS,
        )

    access_token = create_access_token(
        identity=str(user.id),
        additional_claims={
            'role': user.role,
            'email': user.email,
        },
    )

    return user, access_token


def get_all_reps() -> list[User]:
    """Get all users with SALES_REP role (for dropdowns, assignment, etc.)."""
    return User.query.filter_by(role='SALES_REP').order_by(User.full_name).all()


def get_all_users() -> list[User]:
    """Get all users (for admin views)."""
    return User.query.order_by(User.full_name).all()
