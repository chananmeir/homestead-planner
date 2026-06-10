# Harvest Ready — Needs Attention deep dive

**Date**: 2026-05-11
**Source screenshot**: `C:\Users\march\Downloads\harvestreadcherrybelle.JPG`
**Observed row**: "Harvest ready — Radish (Cherry Belle)" · 22 plants · SFG Bed 1 · 16d past due · `View bed`

---

## 1. Where the data comes from

### 1.1 Backend signal builder

`backend/services/dashboard_service.py::_build_harvest_ready()` (lines 181–284) is the only producer of `harvestReady` rows on the dashboard payload.

#### SQL filter (`gardens_bp.py` → `PlantingEvent.query`):

A `PlantingEvent` is fetched when **all** of the following are true:

| Filter | Source line | Meaning |
|---|---|---|
| `user_id == current_user.id` | 212 | Owner |
| `event_type == 'planting'` | 213 | Excludes mulch / fertilizing / irrigation / maple-tapping events |
| `expected_harvest_date IS NOT NULL` | 214 | Must have a planned harvest date |
| `expected_harvest_date <= end_of_day(target)` | 215 | Harvest date has arrived (target = sim clock / `?date=` / today) |
| `cancelled_at IS NULL` | 216 | Not soft-cancelled |
| `recorded_planting_filter` | 217, 192–198 | `quantity_completed > 0` **OR** (`quantity_completed IS NULL AND completed=True`) |
| `pending_harvest_filter` | 218, 199–205 | `actual_harvest_date IS NULL` **AND** (`harvest_completed=False OR NULL`) |

#### Python-side post-filter (lines 237–247)

After the SQL fetch the builder applies three more guards before grouping:

1. **`_has_recorded_planting(e)` is False** → skipped. Defensive re-check of the SQL filter.
2. **`_is_harvest_recorded(e)` is True** → skipped. Reads `harvest_completed` OR `actual_harvest_date`.
3. **Linked `PlantedItem` already harvested** → skipped. Matches by composite key:
   `(garden_bed_id, plant_id, variety, position_x, position_y, start_date)` where `start_date = transplant_date OR direct_seed_date`.
   `PlantedItem.status == 'harvested'` OR `harvest_date IS NOT NULL` removes the row.
   See `_harvested_planted_item_keys()` (lines 152–174).

#### Grouping (lines 234–247)

Surviving events are collapsed by composite key
`(expected_harvest_date, plant_id, variety_normalized, garden_bed_id)`
into one signal row per group. Variety normalization: empty string → `None`.

#### Row payload (lines 268–281)

```json
{
  "signalKey": "harvest-{representative_event_id}",
  "plantingEventId": <rep id>,
  "plantingEventIds": [<all member ids, sorted>],
  "plantName": <plant_database name>,
  "variety": <event.variety>,
  "bedId": <event.garden_bed_id>,
  "bedName": <looked up via GardenBed.id>,
  "quantity": <sum of quantity_completed across members>,
  "daysPastExpected": <max((target - exp_date).days, 0) across group>,
  "isStale": <True if any member's daysPastExpected > 14>
}
```

#### Hard cap

`SIGNAL_CAP = 20` rows per signal category (line 35). The SQL `.limit(SIGNAL_CAP * 20)` over-fetches before filtering, then the final array is capped at 20.

### 1.2 API endpoint

`backend/blueprints/dashboard_bp.py::dashboard_today()` (lines 24–49) — `GET /api/dashboard/today?date=YYYY-MM-DD`. Calls `build_dashboard_today()`, returns the full payload (signals + missed + meta).

For your screenshot — the URL fired was `GET /api/dashboard/today?date=2026-05-11` (today is `2026-05-11` per the simulation clock shown bottom-right).

### 1.3 Snooze filter (last step)

`build_dashboard_today()` lines 1200–1227 filters out any row whose `signalKey` matches a `DashboardSnooze` row where `snooze_until >= target_date`. This runs over BOTH `signals.*` and `missed.*` so a dismissed item doesn't resurface when it ages out.

---

## 2. How it's displayed

### 2.1 Frontend fetch

`frontend/src/components/Dashboard/NeedsAttentionPanel.tsx` (lines 227–253) fetches `/api/dashboard/today?date=${today}` on mount and on `reloadKey` change. Refresh triggers:
- `window.focus` event
- `pageshow` event
- `visibilitychange` (tab return)
- Internal handlers after snooze / dismiss / cancel (5s debounce)

### 2.2 Row builder

`harvestRow()` (lines 974–1012) maps each `HarvestReadyRow` to a `SignalRow`:

| Property | Value |
|---|---|
| `icon` | 🧺 |
| `tone` | `'gray'` if `isStale === true`, else `'green'` |
| `tab` | `'harvest'` |
| `title` | `Harvest ready — ${plantName} (${variety})${countSuffix}` |
| `subtitle` | `${quantity} plants · ${bedName} · ${daysPastExpected}d past due` (parts filtered if null) |
| `onClick` | `onNavigate({ kind: 'harvest', plantingEventId })` |
| `secondaryAction` | `View bed` → `onNavigate({ kind: 'harvestBed', plantingEventId, bedId })` (only when bedId exists) |

#### Stale tone caveat (Cherry Belle case)

The screenshot shows Cherry Belle at 16d past due > `HARVEST_DEMOTION_DAYS = 14`, so backend sets `isStale: true` and the row **should** render in gray tone. In the screenshot both harvest rows look similar-green; that's worth a quick visual check (could be JPEG compression or a regression — `frontend/src/components/Dashboard/NeedsAttentionPanel.tsx:984`).

### 2.3 Row chrome (which buttons appear)

For a **harvest** row specifically:

| Button | Shown? | Why |
|---|---|---|
| Row body click → `harvest` deep-link | Yes (when `plantingEventId` present) | `hasId` check at line 976 |
| `View bed` secondary action | Yes (when `bedId` present) | line 1001 |
| `Skip 3d` chip | Yes | `signalKey && !isMissed` — harvests never go to Missed |
| `× Cancel task` (red) | **No** | `getCancellableAction('harvest-...')` returns `null` (line 104). Only `indoor-`, `indoor-iss-`, and `direct-seed-` prefixes are cancellable. |
| `× Dismiss` (small) | Yes | `signalKey && !cancellable` (line 824) |

### 2.4 Deep-link navigation

Clicking the row dispatches `NeedsAttentionTarget` `{ kind: 'harvest', plantingEventId }`. Clicking `View bed` dispatches `{ kind: 'harvestBed', plantingEventId, bedId }`. These are handled in `App.tsx` (~line 410–451) and use the `useFocusHighlight` hook to scroll the destination component into view and highlight the target row.

The HarvestTracker registers refs by `HarvestRecord.id` but the dashboard sends `PlantingEvent.id` — the highlight won't match logged harvests. This is intentional: signals fire **before** a harvest record exists (memory: `needs-attention-deep-link.md`).

---

## 3. All ways the "Harvest ready" row can be removed

A row disappears the next time the dashboard refreshes (focus / re-mount / 1.5s debounced auto-refresh) if **any** of the following becomes true. Each row is a separate edit path through the codebase.

### 3.1 Record a harvest record (the intended path)

POST `/api/harvests` with `plantedItemId` set → `_sync_planted_item_to_harvested()` in `harvests_bp.py:21–50` sets:
- `PlantedItem.status = 'harvested'`
- `PlantedItem.harvest_date = harvest_date`
- Linked `PlantingEvent.completed = True`, `harvest_completed = True`, `actual_harvest_date = harvest_date`, `quantity_completed = quantity`

`_is_harvest_recorded()` returns True → row drops in the next dashboard build.
PlantedItem match key drops it as a secondary safeguard.

**Bulk variant**: POST `/api/harvests/bulk` with `plantedItemIds`. Same sync per item.

### 3.2 Mark the event harvested directly (no HarvestRecord)

PATCH `/api/planting-events/<id>/harvest` (`gardens_bp.py:3133–3160`). Sets `actual_harvest_date`, `harvest_completed=True`, `completed=True`, `quantity_completed=quantity`. Same effect as 3.1 minus the HarvestRecord row.

### 3.3 Toggle harvest fields via PUT

PUT `/api/planting-events/<id>` (`gardens_bp.py:2718–2745`) accepts `harvestCompleted` and `actualHarvestDate`. Setting either to a truthy value satisfies `pending_harvest_filter` exclusion.

### 3.4 Move the PlantedItem status to 'harvested' from the Garden Designer

PUT `/api/planted-items/<id>` with `status='harvested'` (`gardens_bp.py:2092–2102`) triggers the cross-model sync block (lines 2097–2102) that mirrors `_sync_planted_item_to_harvested`: `PlantingEvent.completed`, `harvest_completed`, `quantity_completed` all set.

### 3.5 Cancel the PlantingEvent

POST `/api/planting-events/<id>/cancel` (`gardens_bp.py:2587–2603`) sets `cancelled_at = utcnow()`. SQL filter `cancelled_at IS NULL` drops the row.

> **Note**: The harvest row's UI does NOT expose this. There is no `Cancel task` button on harvest rows (see §2.3). The only ways to trigger this from the UI are (a) navigating to the event in Garden Designer / Calendar and cancelling it there, or (b) calling the endpoint directly.

### 3.6 Delete the PlantingEvent

DELETE `/api/planting-events/<id>` (`gardens_bp.py:2699`). Cascade is per-event; `scope=series` deletes all succession siblings.

### 3.7 Clear `expected_harvest_date`

PUT `/api/planting-events/<id>` with `expectedHarvestDate: null` (`gardens_bp.py:2748–2752`). SQL filter `expected_harvest_date IS NOT NULL` drops the row.

### 3.8 Push `expected_harvest_date` into the future

Same PUT, with a date `> target_date`. Filter `expected_harvest_date <= end_of_day(target)` drops it.

### 3.9 Reset planting completion to zero

PUT `/api/planting-events/<id>` with `quantityCompleted: 0` and `completed: false` (`gardens_bp.py:2719–2734`). `recorded_planting_filter` requires `quantity_completed > 0` OR (`quantity_completed IS NULL AND completed=True`). Failing both drops the row. Logically this is "I didn't actually plant it" — rare.

### 3.10 Snooze (3-day)

POST `/api/dashboard/snooze` `{signalKey: "harvest-<id>", days: 3}`. Adds a `DashboardSnooze` row with `snooze_until = target + 3d`. Filter in `build_dashboard_today` at lines 1210–1216 drops it from `signals.harvestReady`.
Triggered by the **Skip 3d** chip in the UI.

For a **grouped** row (multiple PlantingEvents collapsed), the frontend fans out one POST per member key (`buildGroupSignalKeys('harvest', plantingEventIds, …)`). All members must be snoozed for the group to disappear.

### 3.11 "Dismiss permanently" (× button)

The × button on harvest rows posts `{signalKey, forever: true}`. **⚠ Frontend/backend divergence**: backend `dashboard_bp.py:60–66` ignores `forever` and defaults `days=3`. Net effect: identical to Skip 3d (3-day snooze, not permanent). Worth a follow-up.

Related: the Undo button on the 5-second "Dismissed" strip sends `DELETE /api/dashboard/snooze`. Backend route is registered POST-only — DELETE returns 405. The frontend always sets `reloadKey` regardless, so the row visually reappears for ~5 seconds and then the next refresh hides it again because the snooze record still exists. Net: **Undo doesn't actually undo.**

### Edit-path summary

| Removal path | Persists across refresh? | UI exposure |
|---|---|---|
| Record harvest (HarvestRecord) | Yes | HarvestTracker, GardenDesigner harvest modal |
| PATCH /harvest on event | Yes | Some calendar / event modals |
| PUT event w/ harvestCompleted | Yes | Calendar event editor |
| PlantedItem.status='harvested' | Yes | GardenDesigner plant context menu |
| Cancel PlantingEvent | Yes | Calendar / Designer event actions (NOT dashboard row) |
| Delete PlantingEvent | Yes | Calendar / Designer event actions |
| Clear expected_harvest_date | Yes | Calendar event editor |
| Future expected_harvest_date | Yes | Calendar event editor |
| Reset completed planting | Yes | Manual API call only — no UI |
| Snooze 3d (`Skip 3d`) | 3 days | Dashboard row hover chip |
| Dismiss "permanently" | 3 days (bug, see §3.11) | Dashboard row × |

---

## 4. Edge cases worth flagging

1. **`isStale` does NOT hide the row.** Harvests never move to `missed`. The display layer demotes tone only (memory: `dashboard-needs-attention-staleness.md`). For Cherry Belle at 16d past due, the row should render gray, not green.
2. **Group collapse means snooze fan-out.** Multiple events collapsed by `(date, plant_id, variety, bed_id)` produce a single row but require N snooze POSTs to fully hide. `Promise.all` is used; partial success still reloads.
3. **Snooze key range collision.** `signalKey` for harvest is `harvest-{rep_event_id}`. Snooze is keyed by the representative ID. If a future refresh produces a different representative (e.g. the rep event was deleted but siblings remain), the snooze won't match. In practice the sort key is `(date, min(member.id))`, so deletions can shift the rep.
4. **PlantedItem match guard requires position.** `_harvested_item_match_key()` returns `None` if `position_x` or `position_y` is missing (e.g. row-planted with sparse positions). Such events ignore the PlantedItem guard and rely solely on PlantingEvent fields to clear.
5. **Bulk harvest uses HarvestGroup.** POST `/api/harvests/bulk` splits `totalQuantity` evenly across `plantedItemIds` and assigns the same `harvest_group_id`. Each item runs `_sync_planted_item_to_harvested` so all matching dashboard rows clear together.

---

## 5. Suggested follow-ups (not in scope for this dive)

- **Bug**: `forever: true` on `POST /api/dashboard/snooze` is silently dropped — dismiss is really a 3-day snooze.
- **Bug**: `DELETE /api/dashboard/snooze` returns 405 — Undo doesn't restore.
- **UX**: Cherry Belle's 16-day-past row should render gray (stale tone) but visually appears similar to the 6-day Collard Greens row. Verify CSS / `toneClasses['gray']` is actually being applied when `isStale===true`.
- **UX**: Cancel-task is missing for harvest rows. A user with a stale harvest they don't intend to record has only Skip 3d / Dismiss-as-3d-snooze and no way to clear it without navigating to the event. Consider adding cancel support for the `harvest-` prefix in `getCancellableAction`.
