# AUDIT-002 Retest Summary (2026-04-23)

Summary of the read-only investigation dispatched in response to
`audit-002-retest-update.md`. Full technical write-up is at
`audit-002-investigation.md`. This file is the reported-back summary
persisted so future sessions pick up with context even without scrolling
chat.

---

## Findings

### 1. Hardcoded ZIP — confirmed

`'53209'` is hardcoded in **5 frontend locations** as the localStorage
fallback. `WeatherAlerts.tsx:11-14` is the primary offender for the
retest-observed flow. The backend does NOT default to 53209 — it either
uses the provided location, falls back to
`current_user.properties[0].{latitude,longitude}` (for soil-temp +
maple-tapping endpoints only), or errors out (for `/api/weather/*`
primary forecast endpoints).

### 2. Property → weather wiring — captured but not consumed

- `Property` model stores `address`, `latitude`, `longitude`, `zone`
  correctly. User-entered values are saved.
- **No frontend component, hook, or context reads those fields to seed
  weather.** No `PropertyContext`, no `useProperty()`.
- Backend soil-temp + maple property-fallback paths are **effectively
  dead code today** — the frontend always sends `'53209'` before the
  fallback gets a chance.

### 3. Recommended fix — Option C, two stages

- **Stage 1 (Option A) — smallest safe fix**: when no explicit
  `weatherZipCode` is pinned in localStorage, fall back to the primary
  Property's ZIP instead of the `'53209'` constant. Resolves the retest
  finding.
- **Stage 2 (Option C polish, deferred)**: add a "reset to property
  ZIP" affordance so users who pinned an explicit override can snap back
  to their property.

---

## Scope

- **Frontend-only** for the correctness fix (Stage 1). No migration, no
  backend change, no API contract change.
- **~100 lines across 4 existing files** plus an optional new
  `useProperty()` hook (investigator recommends creating one for
  cleanliness since multiple files currently duplicate ZIP-reading
  logic).
- No schema change.

---

## Product decisions — none block Stage 1

Investigator flagged 5 product questions, each with a safe default. The
key one to acknowledge:

> **"Pinned `weatherZipCode` always wins when set; property seeds only
> when the pin is empty."**

This is the assumed default for Stage 1.

---

## Recommended next steps

Two paths forward for the user to pick:

### Option A — Proceed with Stage 1 now

Dispatch `frontend-debugger` to:
1. Add a `useProperty()` hook returning the primary property (or null).
2. Replace the 5 hardcoded `'53209'` fallbacks with
   `property?.zipCode ?? ''` (empty string when no property exists —
   Weather components already handle empty ZIP by showing their
   "no forecast" state).
3. Update tests that check for `53209`.

Ship as one frontend-only commit. Keep Stage 2 deferred.

### Option B — Full review first

Read `audit-002-investigation.md` in full, then greenlight Stage 1,
Stage 2, or a different cut.

---

## Pending before implementation

User greenlight on which path to take. Nothing started yet.
