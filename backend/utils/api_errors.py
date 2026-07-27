from flask import jsonify, request
from werkzeug.exceptions import HTTPException

from models import db


def _is_api_request(path):
    parts = path.strip('/').split('/')
    return bool(parts) and (parts[0] == 'api' or (len(parts) > 1 and parts[1] == 'api'))


def register_api_error_handlers(app):
    @app.errorhandler(HTTPException)
    def handle_http_exception(error):
        if not _is_api_request(request.path):
            return error

        response = jsonify({
            'error': error.description or error.name,
        })
        response.status_code = error.code or 500
        return response

    @app.errorhandler(Exception)
    def handle_unexpected_exception(error):
        if isinstance(error, HTTPException):
            return handle_http_exception(error)
        if not _is_api_request(request.path):
            raise error

        try:
            db.session.rollback()
        except Exception:
            app.logger.exception('Failed to roll back database session after API error')

        app.logger.exception('Unhandled API exception')
        return jsonify({'error': 'Internal server error'}), 500
