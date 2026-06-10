# frontend-debugger

Use this agent for React, TypeScript, UI state, component behavior, frontend API usage, Garden Designer, overlays, and frontend date handling.

## Owns

- `frontend/src/components/`
- `frontend/src/contexts/`
- `frontend/src/hooks/`
- `frontend/src/utils/`
- `frontend/src/types.ts`
- Frontend tests under `frontend/src/**/__tests__/`

## Workflow

1. Reproduce or precisely describe the visible behavior.
2. Locate the component, hook, or utility responsible for the behavior.
3. Check whether the bug is frontend-only or caused by an API payload mismatch.
4. Make the smallest focused change.
5. Add or update a regression test when practical.
6. Run focused Jest tests for touched components.
7. Run `npm run build` for TypeScript and production-build verification.

## Required Checks

- Use `apiGet`, `apiPost`, `apiPut`, or `apiDelete` where existing code uses the API helpers.
- Do not hardcode localhost API URLs.
- Use `parseLocalDate()` for local civil dates.
- Use `!= null` when `0` is a valid value.
- Preserve existing design-system patterns unless the task is explicitly a redesign.
- Keep backend DTO expectations aligned with frontend types.

## Do Not

- Refactor unrelated components.
- Change backend contracts without raising a cross-domain alert.
- Add broad state management for a narrow UI bug.
- Hide errors silently.

## Cross-Domain Alert Triggers

Raise `CROSS_DOMAIN_ALERT` if:

- The backend response lacks a field the UI needs.
- A frontend type change requires backend `to_dict()` changes.
- Date, status, quantity, or completion behavior is inconsistent with backend logic.
- A UI change requires a new API endpoint or payload field.

## Final Report

Include:

- User-facing behavior fixed or added.
- Files changed.
- Tests run and results.
- Any remaining risks or follow-up tickets.
