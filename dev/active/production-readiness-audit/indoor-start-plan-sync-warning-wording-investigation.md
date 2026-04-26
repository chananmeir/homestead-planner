# Indoor Start Plan-Sync Warning Wording — Investigation (2026-04-25)

Investigation for `indoor-start-plan-sync-warning-wording-finding.md`.
Investigation only — no code changed. Single-source fix; small scope.

---

## TL;DR

The warning text comes from a single backend f-string at
`backend/models.py:1232` (inside `IndoorSeedStart.get_current_garden_plan_count`):

```python
warning = (
    f"Garden plan changed: now {current_count} plants "
    f"(was ~{math.ceil(self.seeds_started / 1.15 * 0.85)} when created)"
)
```

The `was ~N when created` portion is **reverse-inferred** by undoing
the seed-buffer formula (`/1.15 * 0.85` is the inverse of the
`/0.85 * 1.15` recommendation math). The model **does not** persist
a historical snapshot of the original plan quantity — confirmed via
exhaustive grep for `original_plan_quantity`, `original_quantity`,
`created_plan_count`, `plan_snapshot` (zero hits).

So the wording overstates the app's confidence. The user wants safer
phrasing that does not imply exact historical knowledge.

Fix scope: one f-string in `backend/models.py` + one corresponding
test update. Frontend rendering at `IndoorSeedStarts.tsx:617-627`
just displays whatever the backend sends — no frontend logic change
needed.

---

## Evidence

### Banner render call site

`frontend/src/components/IndoorSeedStarts.tsx:617-657`:
```tsx
{start.gardenPlanWarning && !start.gardenPlanInSync && (
  <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mt-2">
    ...
    <p className="text-xs font-medium text-yellow-800">{start.gardenPlanWarning}</p>
    {start.gardenPlanCount !== undefined && start.gardenPlanCount > 0 && (
      <>
        <p className="text-xs text-yellow-700 mt-1">
          Current plan: {start.gardenPlanCount} plants → {start.gardenPlanExpectedSeeds} seeds recommended
        </p>
```

Two lines:
1. The "now {count} plants (was ~{N} when created)" line — comes
   straight from the backend `gardenPlanWarning` field.
2. "Current plan: {count} plants → {expectedSeeds} seeds recommended"
   — constructed in JSX from already-correct fields.

Only the first line carries the questionable "(was ~N when created)"
phrasing.

### "was ~N" math is reverse-inferred

`backend/models.py:1232` formula:
```python
math.ceil(self.seeds_started / 1.15 * 0.85)
```
This is the algebraic inverse of the recommendation formula at
line 1223:
```python
expected_seeds = math.ceil(current_count / 0.85 * 1.15)
```
(0.85 ≈ germination rate, 1.15 ≈ over-seed buffer.)

So "was ~6" is computed from current `seeds_started` by reversing the
buffer math — not read from any stored field. The IndoorSeedStart
model (lines 1053-1103) has no historical snapshot field.

### Other components using the same pattern — none

Repo-wide search for `(was ~` and the inverse formula `/ 1.15 * 0.85`
returns zero other hits. The forward formula `/ 0.85 * 1.15` appears
in `ImportFromGardenModal.tsx:569` and a Playwright test, but those
are forward-recommendations (not "was" claims) and aren't the same
anti-pattern. Fix is local to the one f-string.

### Data the banner already has

Available at render time:
- `start.seedsStarted` — what the user actually planted
- `start.gardenPlanCount` — current sum of matching PlantingEvent quantities
- `start.gardenPlanExpectedSeeds` — recommended seeds for the current plan
- `start.gardenPlanInSync` — buffer-tolerance boolean
- `start.gardenPlanWarning` — the backend-generated string

Everything needed for a safer phrasing is already on the wire.

### Tests likely affected

`frontend/src/components/__tests__/IndoorSeedStarts.banner.test.tsx`
(per the agent search) likely asserts the current `was ~` string and
will need updating to whatever new copy is chosen.

`backend/tests/` may also have a test asserting the warning's exact
shape — needs verification before changing.

---

## Three wording options

All three drop the false-precision "(was ~N when created)" claim and
center on values the app actually knows for certain.

### Option A — Drop the historical claim entirely

```
"Garden plan changed: now 3 plants — your 7 seeds may not match."
```

f-string:
```python
warning = f"Garden plan changed: now {current_count} plants — your {self.seeds_started} seeds may not match."
```

**Pros**: Closest to the existing wording. Minimal disruption.
**Cons**: "may not match" is slightly hedgy; user has to do the
recommendation math themselves (though the second JSX line already
shows it).

### Option B — Lead with the recommendation

```
"Plan updated: 3 plants now scheduled. Recommended: 5 seeds (you started 7)."
```

f-string:
```python
warning = f"Plan updated: {current_count} plants now scheduled. Recommended: {expected_seeds} seeds (you started {self.seeds_started})."
```

**Pros**: Most actionable. Tells the user exactly what's recommended
in the same line. Some duplication with the existing JSX line below.
**Cons**: Replaces both the warning line AND the "Current plan: ..."
line conceptually — may want to consider whether to delete the JSX
line below, or keep it for visual structure.

### Option C — Comparative phrasing without "when created"

```
"Mismatch: 7 seeds started, current plan needs ~5 seeds for 3 plants."
```

f-string:
```python
warning = f"Mismatch: {self.seeds_started} seeds started, current plan needs ~{expected_seeds} seeds for {current_count} plants."
```

**Pros**: One-line comparative summary, no historical inference,
clear actionable mismatch.
**Cons**: "Mismatch" is more technical than "Garden plan changed".

---

## Recommendation

**Option A** — preserves the existing voice ("Garden plan changed")
the user already recognizes from the audit observation, while
dropping the over-confident "was ~N when created" claim. The
existing JSX line below ("Current plan: 3 plants → 5 seeds
recommended") still gives the user the actionable recommendation.

Smallest, surgical change. ~5 lines diff in `models.py` (the
f-string), ~1 line in the matching test, no frontend change.

If you prefer terser one-line communication where everything is in
the warning itself rather than spread across two lines, Option B is
the next-cleanest. Option C is an alternative voice but more
technical.

---

## Open question for the user

Pick one of:

- **(a)** Implement Option A — closest to current voice, drops false-precision
- **(b)** Implement Option B — leading with recommendation, more actionable
- **(c)** Implement Option C — comparative, technical voice
- **(d)** Different copy / wait
