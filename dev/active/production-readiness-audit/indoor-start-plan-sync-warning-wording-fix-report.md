# Indoor Start Plan-Sync Warning Wording — Fix Report (2026-04-25)

Option B from `indoor-start-plan-sync-warning-wording-decision.md`
shipped.

---

## Exact wording change

**Before** (`backend/models.py:1232`):
```python
warning = f"Garden plan changed: now {current_count} plants (was ~{math.ceil(self.seeds_started / 1.15 * 0.85)} when created)"
```
Example output: `"Garden plan changed: now 3 plants (was ~6 when created)"`

**After** (`backend/models.py:1232-1244`):
```python
# Wording deliberately avoids any "(was ~N when created)"
# back-inference from current seeds_started — the model
# does not persist a historical plan-quantity snapshot,
# so claiming an exact original count overstates the
# app's confidence. State only what is actually known:
# current plan count, current recommendation, and what
# the user actually started.
warning = (
    f"Plan updated: {current_count} plants now scheduled. "
    f"Recommended: {expected_seeds} seeds "
    f"(you started {self.seeds_started})."
)
```
Example output: `"Plan updated: 3 plants now scheduled. Recommended: 5 seeds (you started 7)."`

The new wording removes the false historical implication and clearly states three things the app actually knows:
- what the plan says now (`current_count` plants)
- what the app recommends now (`expected_seeds` seeds — already computed at line 1223 from current count)
- what the user actually has in the indoor-start record (`self.seeds_started`)

---

## What did NOT change

- The gate condition (`abs(expected_seeds - self.seeds_started) <= 1`) — unchanged.
- The `expected_seeds` recommendation math — unchanged.
- The frontend rendering at `IndoorSeedStarts.tsx:617-657` — unchanged. The frontend just displays the opaque string from `start.gardenPlanWarning`.
- The second JSX line `"Current plan: 3 plants → 5 seeds recommended"` (line 626) — unchanged. There is now slight overlap with the new warning copy (both mention current plant count and recommended seeds), but the warning is the actionable summary and the second line stays as a visual breakdown. Could be revisited for a UI cleanup pass if desired; not part of this scope.

---

## Files changed

- `backend/models.py` — single block at lines 1232-1244 (warning f-string + explanatory comment)

---

## Commits

- **`b8e05b4`** — `fix: Plan-sync warning drops false-precision "(was ~N when created)" claim`
- _(this report + decision)_ — `docs:` follow-up

---

## Build / test results

**Backend**:
- 26 tests passing under `indoor_seed_start or garden_sync or seed_start_to_dict` keyword filter
- No tests asserted the old warning string verbatim — verified via grep across `backend/tests/` and `frontend/src/components/__tests__/`

**Frontend**:
- `npx tsc --noEmit` → exit 0
- 12 IndoorSeedStarts tests passing across 3 suites (focus + banner + placement-confirmation)

---

## Out-of-scope WIP staging

`backend/models.py` had pre-existing unstaged WIP modifications (cancel/uncancel-related schema changes — `PlantingEvent.cancelled_at`, `IndoorSeedStart.cancelled_at`, and a related query filter). Surgically staged ONLY the wording-fix hunk via `git apply --cached` with a filtered patch. The cancel WIP remains unstaged in the working tree, untouched.
