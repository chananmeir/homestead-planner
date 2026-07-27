from flask import Flask, abort
from flask_cors import CORS

from models import db
from utils.api_errors import register_api_error_handlers


def _make_error_app():
    app = Flask(__name__)
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['TESTING'] = False
    db.init_app(app)
    CORS(app, resources={
        r"/api/*": {
            "origins": ["http://localhost:3000"],
            "methods": ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
            "allow_headers": ["Content-Type", "Authorization"],
            "supports_credentials": True,
        }
    })
    register_api_error_handlers(app)

    @app.route('/api/probe-error')
    def probe_error():
        raise RuntimeError('database detail should not leak')

    @app.route('/api/probe-missing')
    def probe_missing():
        abort(404, description='Probe not found')

    return app


def test_api_500_returns_json_with_cors_header():
    client = _make_error_app().test_client()

    response = client.get('/api/probe-error', headers={'Origin': 'http://localhost:3000'})

    assert response.status_code == 500
    assert response.headers.get('Access-Control-Allow-Origin') == 'http://localhost:3000'
    assert response.get_json() == {'error': 'Internal server error'}


def test_api_http_exception_returns_json_with_cors_header():
    client = _make_error_app().test_client()

    response = client.get('/api/probe-missing', headers={'Origin': 'http://localhost:3000'})

    assert response.status_code == 404
    assert response.headers.get('Access-Control-Allow-Origin') == 'http://localhost:3000'
    assert response.get_json() == {'error': 'Probe not found'}
