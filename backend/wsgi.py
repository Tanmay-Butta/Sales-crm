"""
WSGI entry point for production (Gunicorn) and development (flask run).
"""

import os
from dotenv import load_dotenv

# Load .env file for local development
load_dotenv()

from app import create_app

app = create_app()

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
