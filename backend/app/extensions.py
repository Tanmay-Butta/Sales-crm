"""
Flask extensions initialized here and bound to the app in the factory.
This avoids circular imports — models import db from here, app factory binds them.
"""

from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_jwt_extended import JWTManager
from flask_cors import CORS

db = SQLAlchemy()
migrate = Migrate()
jwt = JWTManager()
cors = CORS()
