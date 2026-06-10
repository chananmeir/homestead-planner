# Dashboard "Undo" snooze — fix report

**Date**: 2026-05-11
**Bug**: harvest-ready-signal-deep-dive.md §3.11 (follow-up — flagged "out of scope" in `harvest-ready-dismiss-fix-report.md`)
**Symptom**: The 5-second "Dismissed · Undo" toast that appears after the user clicks the `×` button on a Needs-Attention row visually let the row reappear, but the snooze record was never removed. On the next dashboard refresh the row re-hid. Net effect: Undo did nothing.

## Root cause

`backend/blueprints/dashboard_bp.py::snooze_signal()` was registered with `methods=['POST']` only. The frontend's Undo handler (`NeedsAttentionPanel.tsx::handleUndo`) sends `DELETE /api/dashboard/snooze` with `{signalKey}` in the body — that hit a 405 Method Not Allowed. The frontend swallows the error and always reloads (`finally: setReloadKey`), so the user never saw a failure indicator; the row simply re-hid after the toast expired.

## Fix

`backend/blueprints/dashboard_bp.py`:

1. Added a new `unsnooze_signal()` handler on the same `/snooze` path with `methods=['DELETE']`.
2. Behavior: looks up `DashboardSnooze` by `(user_id, signal_key)`, deletes if present, returns `{signalKey, deleted: bool}` either way.
3. **Idempotent on purpose** — Undo must never error. Two clicks in a row, a stale toast firing late, or the parent re-render firing the handler twice all behave identically. The `deleted` flag exposes which case occurred for observability.
4. User-scoped query — DELETE filters by `current_user.id`, so user A cannot remove user B's snooze.

No model changes, no migration, no frontend changes.

## Tests

Added `TestUnsnoozeEndpoint` to `backend/tests/test_dashboard_endpoint.py` (5 tests):

| Test | Coverage |
|---|---|
| `test_removes_existing_snooze` | Happy path — row deleted, response `deleted=true` |
| `test_idempotent_when_no_snooze_exists` | 200 + `deleted=false` when nothing to remove |
| `test_missing_signal_key_returns_400` | Required-field validation |
| `test_user_isolation` | User A's DELETE must not touch user B's snooze (asserts user B's row survives) |
| `test_dismiss_then_undo_restores_harvest_signal` | **End-to-end regression**: forever-dismiss a harvest, Undo, confirm the row is back on `GET /api/dashboard/today` |

The end-to-end test would have failed under the pre-fix 405 behavior — the snooze record would survive the failed DELETE and `harvestReady` would still be empty.

## Verification

```
cd backend
python -m pytest tests/test_dashboard_endpoint.py tests/test_dashboard_staleness.py tests/test_dashboard_service_grouping.py -q
# 112 passed (was 107 after the dismiss-permanently fix; +5 from this pass)
```

## Side-note (not a fix)

While writing `test_user_isolation` I hit an oddity: requesting both `auth_client_a` and `auth_client_b` as fixtures in one test caused `current_user` inside the endpoint to resolve to the wrong user. Removing the unused `auth_client_b` (just keeping `user_b` for the id) fixed it. Other tests in the file use the `auth_client_a + user_a + user_b` pattern for the same reason — it's an established workaround. Worth a separate look at the conftest if anyone wants to actually exercise two authenticated clients in one test, but unrelated to this fix.

## Combined status of harvest-ready dismiss flow

- `Skip 3d` → 3-day snooze ✓ (was already working)
- `× Dismiss` → permanent dismiss ✓ (fixed in `harvest-ready-dismiss-fix-report.md`)
- `Undo` (5-second toast) → restores the row ✓ (fixed here)

All three buttons on harvest-ready rows now behave as advertised.
