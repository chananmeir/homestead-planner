# Needs Attention → Broccoli (Waltham) navigates to Broccoli (De Cicco)

**Date:** 2026-05-12
**Reporter:** Chanan
**Status:** Investigation complete — bug reproduced from DB data, no code fix proposed yet

---

## TL;DR

The Dashboard's "Indoor start due — Broccoli (Waltham)" row navigates to a
seed-start card labeled "Broccoli De Cicco" because the user's data contains
an `IndoorSeedStart` whose `variety` does not match the `variety` on its
linked `PlantingEvent`. The deep-link is matching the correct
`PlantingEvent.id`, but the card it lands on has been mislabeled at the
ISS level. This is a **data integrity** bug at the source plus a missing
**invariant check** in the deep-link contract.

---

## Reproduction (from the live SQLite DB, user 59 / chanansiegel)

The Waltham seed-start-due signal the user sees comes from
`PlantingEvent` 5887:

| PE id | variety | seed_start_date | transplant_date | bed |
|------:|---------|------------------|------------------|-----|
| 5887  | **Waltham** | 2026-05-12 | 2026-06-16 | 38 |

The IndoorSeedStart linked to that PE:

| ISS id | variety | planting_event_id | status |
|-------:|---------|-------------------:|--------|
| 154    | **De Cicco** | 5887 | planned |

`PE.variety = 'Waltham'` but `ISS.variety = 'De Cicco'`, yet `ISS.planting_event_id = 5887`.
There is no constraint preventing this divergence.

Other mismatches found for this user (broccoli only):

| ISS id | ISS.variety | PE id | PE.variety | match? |
|-------:|-------------|------:|------------|--------|
| 44     | De Cicco    | 5886  | Waltham    | **no** |
| 45     | Waltham     | 5888  | Calabrese  | **no** |
| 154    | De Cicco    | 5887  | Waltham    | **no** (the visible one) |
| 54, 55, 155, 156, 157, 225, 226 | … | … | … | yes |

So 3 of 10 broccoli ISSes for this user are mislinked.

---

## How the click ends up at the wrong card (code trace)

1. **Backend dashboard signal** — `backend/services/dashboard_service.py::_build_indoor_starts_due` (lines 287–395, PE-path):
   - Groups events by `(seed_start_date, plant_id, variety)` where `variety = e.variety` from the **PlantingEvent**.
   - PE 5887 satisfies `seed_start_date <= today`, `cancelled_at IS NULL`, `event_type='planting'`.
   - PE 5887 is **NOT** in `started_event_ids` because its linked ISS 154 has `status='planned'` (the filter only excludes statuses `!= 'planned'`).
   - Emits row: `{signalKey: 'indoor-5887', plantingEventId: 5887, plantingEventIds: [5887], indoorSeedStartId: null, plantName: 'Broccoli', variety: 'Waltham', …}`.

2. **Dashboard panel click** — `frontend/src/components/Dashboard/NeedsAttentionPanel.tsx::indoorStartRow` (line 1014):
   - Title rendered = `Indoor start due — Broccoli (Waltham)` (uses signal's `variety` from the PE).
   - `onClick` dispatches `{kind: 'indoorStart', plantingEventId: 5887, plantingEventIds: [5887], indoorSeedStartId: null}`.

3. **App router** — `frontend/src/App.tsx::handleNeedsAttentionNavigate` (line 501):
   - Builds destination URL `?tab=indoor-starts&group=grow&plantingEventIds=5887`.
   - `openAppDestination` opens it in a new tab.

4. **New tab URL parsing** — `App.tsx::parseInitialAppRoute` (lines 261–270):
   - `indoorSeedStartIds = []`, `plantingEventIds = [5887]`.
   - `route.indoorStartFocusTarget = { indoorSeedStartIds: [], plantingEventIds: [5887] }`.

5. **IndoorSeedStarts focus lookup** — `frontend/src/components/IndoorSeedStarts.tsx::focusedSeedStart` (line 223):
   ```ts
   seedStarts.find(s =>
     focusIndoorSeedStartIds.includes(s.id) ||
     (s.plantingEventId != null && focusPlantingEventIds.includes(s.plantingEventId))
   )
   ```
   With `focusPlantingEventIds = [5887]`, this **matches ISS 154** — whose card is rendered with `start.variety = 'De Cicco'`. `useFocusHighlight` scrolls to and ring-highlights that card.

The deep-link did *exactly* what it was supposed to: it found the ISS whose `planting_event_id` matches the dashboard signal's `plantingEventId`. The dashboard's "Waltham" label was correct (it came from the PE). The seed-start card's "De Cicco" label was also internally consistent (it came from the ISS row). The two views simply disagree because the underlying data is inconsistent.

---

## Why the data is inconsistent (best inference)

`PlantingEvent.variety` and `IndoorSeedStart.variety` are **independent
columns** with no FK or trigger keeping them aligned. The relevant write
paths:

- **`POST /api/indoor-seed-starts/from-planting-event`** (`backend/blueprints/utilities_bp.py:1619`):
  ```python
  seed_start = IndoorSeedStart(
      plant_id=data['plantId'],
      variety=data.get('variety'),      # ← from request body, NOT linked_event.variety
      …,
      planting_event_id=planting_event_id,
  )
  # … later:
  if linked_event is not None:
      linked_event.seed_start_date = indoor_start_date
      linked_event.transplant_date = expected_transplant_date
      # No `linked_event.variety = data['variety']` and no consistency check.
  ```
  If the caller posts a `variety` that disagrees with `linked_event.variety`, both rows are saved with no warning.

- **Inverse path — editing a PlantingEvent's `variety`** does not appear to push the new variety down to linked IndoorSeedStarts. Conversely, `_sync_indoor_seed_start_planning_links` in `utilities_bp.py:272` *does* push ISS variety changes to the linked PE (line 303), so the sync is **one-directional**.

PE export_keys vs. plan-item ids strongly suggest these PEs (5886/5887/5888/5889) were exported from plan items that have since been deleted/replaced. The mismatched ISSes were likely created when the PE varieties were different, or were linked to "wrong" PEs by a manual/legacy flow that selected the PE by date/bed without checking variety.

---

## Recommendations

### 1. Fix the user's existing data (one-shot)

These 3 ISS rows for user 59 are wrong. Two options:

**Option A — trust the ISS, fix the PE** (recommended if user has been
managing seed starts and wants those labels preserved):
```sql
UPDATE planting_event SET variety = 'De Cicco'  WHERE id = 5886;  -- match ISS 44
UPDATE planting_event SET variety = 'Waltham'   WHERE id = 5888;  -- match ISS 45
UPDATE planting_event SET variety = 'De Cicco'  WHERE id = 5887;  -- match ISS 154
```

**Option B — trust the PE, fix the ISS** (recommended if the PE comes from
an authoritative plan):
```sql
UPDATE indoor_seed_start SET variety = 'Waltham'   WHERE id = 44;
UPDATE indoor_seed_start SET variety = 'Calabrese' WHERE id = 45;
UPDATE indoor_seed_start SET variety = 'Waltham'   WHERE id = 154;
```

Ask Chanan which view ("the dashboard label" vs "the seed-start card
label") is the *correct* one before running either. I would not pick
unilaterally.

### 2. Make the contract enforceable (code change)

In `backend/blueprints/utilities_bp.py::create_indoor_start_from_planting_event` (line 1619):
- If `data.get('variety')` differs from `linked_event.variety`, either:
  - Reject with 400 ("variety must match the linked planting event"), **or**
  - Overwrite `data['variety']` with `linked_event.variety` and log a warning, **or**
  - Update `linked_event.variety = data['variety']` to mirror the existing edit-path behavior in `_sync_indoor_seed_start_planning_links`.

Likewise, when a PUT to `/api/planting-events/<id>` changes `variety`, walk the linked `IndoorSeedStart`s and update them too — symmetric to the ISS→PE sync that already exists.

### 3. Add a data-integrity check / migration

Run a one-time audit query on production data to surface other users with the same mismatch, then offer a fixup migration:
```sql
SELECT iss.user_id, COUNT(*)
FROM indoor_seed_start iss
JOIN planting_event pe ON iss.planting_event_id = pe.id
WHERE iss.cancelled_at IS NULL
  AND COALESCE(iss.variety, '') <> COALESCE(pe.variety, '')
GROUP BY iss.user_id;
```

### 4. Optional UI hardening (defense-in-depth, lowest priority)

In `IndoorSeedStarts.tsx`, when `focusedSeedStart` is matched by
`plantingEventId` (not by `indoorSeedStartId`), and the matched
`s.variety` differs from a `focusedVariety` hint passed by the dashboard,
log a console warning or show a small inline note ("Variety mismatch with
linked planting event — please verify"). This is a band-aid for whatever
slips past #2. Not needed if #2 is enforced.

---

## What I did NOT do

- I did **not** modify any DB rows. Chanan should pick A vs B above.
- I did **not** change any code. The recommendations are scoped — they need a small plan before implementing.
- I did **not** open a Playwright session against the running app to film the click, because the database evidence is already conclusive and matches the reported symptom exactly.

---

## Files referenced

- `backend/services/dashboard_service.py:287` — `_build_indoor_starts_due` PE-path
- `backend/blueprints/utilities_bp.py:1619` — `create_indoor_start_from_planting_event` (variety not synced from linked PE)
- `backend/blueprints/utilities_bp.py:272` — `_sync_indoor_seed_start_planning_links` (ISS→PE sync exists, no PE→ISS counterpart on bare PE edits)
- `frontend/src/components/Dashboard/NeedsAttentionPanel.tsx:1014` — `indoorStartRow` (title + onClick)
- `frontend/src/App.tsx:485` — `handleNeedsAttentionNavigate`
- `frontend/src/components/IndoorSeedStarts.tsx:223` — `focusedSeedStart` match
