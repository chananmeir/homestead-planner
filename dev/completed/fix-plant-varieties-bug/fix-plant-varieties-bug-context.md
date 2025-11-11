# Context: Fix PLANT_VARIETIES Bug

## Key Files

- `backend/app.py` - Main Flask application with the bug on line 298
- `backend/plant_database.py` - Plant data (does not contain PLANT_VARIETIES)
- `backend/models.py` - PlantingEvent model has `variety` field (line 63)

## Important Decisions

1. **Why remove instead of implement?**
   - The PlantingEvent model already has a `variety` field (string)
   - No structured variety data exists in the codebase
   - The template likely doesn't use this parameter
   - Simplest fix with no side effects

2. **Why this wasn't caught earlier?**
   - The `/planting-calendar` route likely hasn't been tested recently
   - This is a server-side route that only triggers when accessed
   - Python only raises NameError at runtime, not import time

## Current Project State

- Backend: Flask with SQLAlchemy, multiple models for homestead tracking
- Frontend: React/TypeScript with Tailwind CSS
- Database: SQLite with Flask-Migrate
- Recent work: Multi-animal livestock, variety field added to PlantingEvent

## Related Code Patterns

The app follows this pattern for routes:
- Query data from database
- Pass to Jinja2 templates via render_template
- Templates located in `backend/templates/`

## Notes

- This appears to be a leftover from earlier development
- The variety system is implemented via free-text field, not predefined varieties
- Future enhancement: Could create structured variety database

---

**Last Updated**: 2025-11-11
