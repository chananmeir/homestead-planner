# Dashboard "Dismiss Permanently" — fix report

**Date**: 2026-05-11
**Bug**: harvest-ready-signal-deep-dive.md §3.11
**Symptom**: Clicking the `×` Dismiss button on a Needs-Attention row silently snoozed for 3 days instead of forever. The frontend sent `{signalKey, forever: true}` to `POST /api/dashboard/snooze`, but the backend dropped the `forever` flag and applied the default `days=3` window.

## Root cause

`backend/blueprints/dashboard_bp.py::snooze_signal()` accepted only the `days` parameter. The frontend's `forever: true` was never wired up server-side, even though the data model already supports it (`DashboardSnooze.snooze_until: db.Date`, and `test_dashboard_staleness.py:474` uses `date(9999, 12, 31)` as the sentinel for forever-dismiss).

## Fix

`backend/blueprints/dashboard_bp.py`:

1. Imported `date` from `datetime` and added a `SNOOZE_FOREVER_DATE = date(9999, 12, 31)` module-level constant with a comment explaining the convention.
2. Reworked `snooze_signal()` to branch on `forever`:
   - `forever=True` → writes the sentinel date, ignores `days`.
   - Else → existing 1-30 day validation, writes `target_date + days`.
3. Hoisted `signalKey` validation above the days check so `forever=true` requests don't trip the 400 path.

No model changes. No migration. No frontend changes (the existing POST payload now does what it always claimed).

## Tests

Added `TestSnoozeEndpoint` to `backend/tests/test_dashboard_endpoint.py` (9 tests):

| Test | Coverage |
|---|---|
| `test_forever_sets_sentinel_date` | `forever: true` writes 9999-12-31 |
| `test_forever_hides_harvest_signal_indefinitely` | Regression: dismissed row stays hidden at TODAY+90d |
| `test_forever_ignores_days_argument` | `forever: true` + invalid `days` still succeeds |
| `test_default_days_is_3` | No `forever`, no `days` → 3-day window |
| `test_days_in_range_is_accepted` | `days: 7` writes target+7 |
| `test_invalid_days_returns_400` | `days` in `{0, -1, 31, "three", None}` all 400 |
| `test_missing_signal_key_returns_400` | Required-field check |
| `test_empty_body_returns_400` | Empty `{}` body rejected |
| `test_upsert_overwrites_existing_snooze` | Documents current upsert behavior (later POST wins) |

## Verification

```
cd backend
python -m pytest tests/test_dashboard_endpoint.py tests/test_dashboard_staleness.py tests/test_dashboard_service_grouping.py -q
# 107 passed
```

## Out of scope — still broken

The Undo button (5-second toast) sends `DELETE /api/dashboard/snooze`, but the route is registered POST-only — returns 405. Net effect *after this fix*: if a user accidentally clicks `×`, the row is hidden permanently and Undo silently fails. Two follow-up options:

1. Add a `DELETE` method to `/api/dashboard/snooze` that removes the row by `signal_key`.
2. Or remove the Undo button until DELETE is supported.

Logged separately for a follow-up pass.
