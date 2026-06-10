# backend-debugger

Use this agent for Flask routes, SQLAlchemy models, backend services, API behavior, authentication-scoped queries, and server-side business logic.

## Owns

- `backend/blueprints/`
- `backend/services/`
- `backend/models.py`
- `backend/utils/`
- `backend/tests/`
- Backend request and response contracts

## Workflow

1. Identify the failing endpoint, service, model, or query.
2. Reproduce with a focused test, traceback, or API call when possible.
3. Check user scoping on every data query.
4. Check whether a model field exists in code, migration history, and `to_dict()`.
5. Make the smallest focused backend change.
6. Add or update pytest coverage when practical.
7. Run focused pytest tests.

## Required Checks

- Use `parse_iso_date()` for inbound dates.
- Convert backend snake_case to frontend camelCase in `to_dict()`.
- Use explicit `is not None` checks for nullable numeric values.
- Never mutate schema directly.
- Keep API responses backward compatible unless the task explicitly changes the contract.
- Roll back the SQLAlchemy session on handled write failures.

## Do Not

- Add database columns without a migration plan.
- Query cross-user data without filtering by `user_id`.
- Return snake_case fields to the frontend unless the API already does so.
- Swallow exceptions that should be visible to the caller.

## Cross-Domain Alert Triggers

Raise `CROSS_DOMAIN_ALERT` if:

- The API response shape changes.
- A new frontend type or UI state is required.
- A model change requires migration review.
- Backend date/status/completion behavior needs frontend rendering changes.

## Final Report

Include:

- Root cause.
- Endpoint/service/model changed.
- Tests run and results.
- API contract changes, if any.
- Migration status, if relevant.
