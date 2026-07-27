"""
Blueprint Registration Module

This module provides a single function to register all blueprints with the Flask app.
"""
import os

SIMULATION_ENV_VAR = 'HOMESTEAD_ENABLE_SIMULATION'
_TRUTHY = {'1', 'true', 'yes', 'on'}


def simulation_enabled():
    """Whether to expose the time-machine (simulation) HTTP endpoints.

    These endpoints are unauthenticated by design AND mutate a process-global
    clock that every user's date-dependent logic reads. Registered in a
    deployed environment, a single anonymous request would change what "today"
    means for the entire installation — corrupting planting dates, harvest
    windows, frost warnings and the dashboard for every user at once.

    So this fails closed: the endpoints exist only when explicitly switched on
    via the HOMESTEAD_ENABLE_SIMULATION environment variable. `start-backend.bat`
    sets it for local development; production deployments must not.

    Note this gates only the HTTP control surface. `simulation_clock` itself
    stays available to the rest of the app, which reads it for "now".
    """
    return os.environ.get(SIMULATION_ENV_VAR, '').strip().lower() in _TRUTHY


def register_blueprints(app, wrapper_prefix=''):
    """
    Register all blueprints with the Flask application.

    Blueprints are organized by feature area:
    - Authentication & Admin: auth_bp, admin_bp
    - Data & Reference: data_bp, seeds_bp, properties_bp
    - Garden Planning: gardens_bp (beds, planted-items, planting-events)
    - Livestock: livestock_bp
    - Utilities: utilities_bp, weather_bp, photos_bp
    - Tracking: compost_bp, harvests_bp
    - Pages: pages_bp (HTML rendering)

    Args:
        app: Flask application instance
        wrapper_prefix: Optional wrapper prefix for parallel testing (e.g., '/_bp')
                       Empty string '' means no wrapper (production)

    Note:
        Blueprints already have url_prefix='/api/...' defined internally.
        This just adds a wrapper prefix (e.g., '/_bp') before that.

        If wrapper_prefix='/_bp' and blueprint url_prefix='/api/auth'
        Result: /_bp/api/auth

        If wrapper_prefix='' and blueprint url_prefix='/api/auth'
        Result: /api/auth
    """
    # Import all blueprints
    from .auth_bp import auth_bp
    from .admin_bp import admin_bp
    from .data_bp import data_bp
    from .seeds_bp import seeds_bp
    from .properties_bp import properties_bp
    from .trellis_bp import trellis_bp
    from .gardens_bp import gardens_bp
    from .garden_planner_bp import garden_planner_bp
    from .livestock_bp import livestock_bp
    from .utilities_bp import utilities_bp
    from .weather_bp import weather_bp
    from .photos_bp import photos_bp
    from .compost_bp import compost_bp
    from .harvests_bp import harvests_bp
    from .nutrition_bp import nutrition_bp
    from .pages_bp import pages_bp
    from .simulation_bp import simulation_bp
    from .dashboard_bp import dashboard_bp
    from .calendar_feed_bp import calendar_feed_bp
    from .settings_bp import settings_bp
    from .feedback_bp import feedback_bp
    from .ai_assistant_bp import assistant_bp

    # Collect all blueprints in a list
    blueprints_list = [
        pages_bp, auth_bp, admin_bp, data_bp, seeds_bp, properties_bp,
        trellis_bp, gardens_bp, garden_planner_bp, livestock_bp, utilities_bp, weather_bp,
        photos_bp, compost_bp, harvests_bp, nutrition_bp, simulation_bp, dashboard_bp,
        calendar_feed_bp, settings_bp, feedback_bp, assistant_bp
    ]

    # Apply wrapper prefix if specified
    if wrapper_prefix:
        for bp in blueprints_list:
            # Add wrapper prefix BEFORE blueprint's internal prefix
            original_prefix = bp.url_prefix or ''
            bp.url_prefix = wrapper_prefix + original_prefix

    # Register blueprints in logical order
    # 1. Pages (HTML routes) - register first as they use root paths
    app.register_blueprint(pages_bp)

    # 2. Authentication & Admin
    app.register_blueprint(auth_bp)
    app.register_blueprint(admin_bp)

    # 3. Core Data
    app.register_blueprint(data_bp)
    app.register_blueprint(seeds_bp)
    app.register_blueprint(properties_bp)
    app.register_blueprint(trellis_bp)

    # 4. Garden Planning (largest feature area)
    app.register_blueprint(gardens_bp)
    app.register_blueprint(garden_planner_bp)

    # 5. Livestock Management
    app.register_blueprint(livestock_bp)

    # 6. Utilities & Calculations
    app.register_blueprint(utilities_bp)

    # 7. Supporting Features
    app.register_blueprint(weather_bp)
    app.register_blueprint(photos_bp)
    app.register_blueprint(compost_bp)
    app.register_blueprint(harvests_bp)
    app.register_blueprint(nutrition_bp)

    # 8. Dashboard aggregation
    app.register_blueprint(dashboard_bp)

    # 9. Calendar subscription feed (.ics)
    app.register_blueprint(calendar_feed_bp)

    # 10. User settings
    app.register_blueprint(settings_bp)

    # 11. Crop feedback loop
    app.register_blueprint(feedback_bp)

    # 12. Dev Tools — opt-in only, see simulation_enabled() for why.
    if simulation_enabled():
        app.register_blueprint(simulation_bp)
        print(
            '[WARN] Simulation (time-machine) endpoints ENABLED and UNAUTHENTICATED. '
            f'Dev only — unset {SIMULATION_ENV_VAR} in any deployed environment.'
        )

    # 13. AI Garden Assistant (LLM chat, streaming)
    app.register_blueprint(assistant_bp)

    # Log successful registration
    prefix_msg = f" at {wrapper_prefix}/*" if wrapper_prefix else " (no wrapper prefix)"
    print(f"[OK] Registered {len(app.blueprints)} blueprints{prefix_msg}")


# Export the registration function
__all__ = ['register_blueprints', 'simulation_enabled', 'SIMULATION_ENV_VAR']
