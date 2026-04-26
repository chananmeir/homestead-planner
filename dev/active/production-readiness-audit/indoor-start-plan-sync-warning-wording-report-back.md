# Indoor Start Plan-Sync Warning Wording — Report Back (2026-04-25)

Option B shipped. Two commits:

| Commit | Type | Content |
|---|---|---|
| **`b8e05b4`** | `fix:` | Wording change at `backend/models.py:1232` |
| `e2bbc17` | `docs:` | decision + fix-report + report-back |

## Report-back

**Exact wording change:**

Before: `"Garden plan changed: now 3 plants (was ~6 when created)"`
After: `"Plan updated: 3 plants now scheduled. Recommended: 5 seeds (you started 7)."`

f-string:
```python
warning = (
    f"Plan updated: {current_count} plants now scheduled. "
    f"Recommended: {expected_seeds} seeds "
    f"(you started {self.seeds_started})."
)
```

Removes the false historical implication. States only what the app actually knows: current plan count, current recommendation, current seeds-started value. An inline comment explains the reasoning so future contributors don't reintroduce the back-inference pattern.

**What did NOT change:**
- Gate condition (`abs(expected_seeds - self.seeds_started) <= 1`) — unchanged
- `expected_seeds` recommendation math — unchanged
- Frontend rendering at `IndoorSeedStarts.tsx:617-657` — unchanged (it displays the opaque string)
- The second JSX line "Current plan: 3 plants → 5 seeds recommended" — unchanged

**Build / test results:**
- Backend: 26 tests passing under `indoor_seed_start or garden_sync` keyword filter
- No tests asserted the old warning string verbatim — verified via grep across both backend and frontend test suites
- `npx tsc --noEmit` → exit 0
- Frontend: 12 IndoorSeedStarts tests passing across 3 suites

**Staging note:** `backend/models.py` had pre-existing unstaged WIP (cancel/uncancel-related schema changes). Surgically staged only the wording-fix hunk via `git apply --cached` with a filtered patch. Cancel WIP remains unstaged in the working tree, untouched.
