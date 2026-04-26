# Calendar Day-Detail Row-Splitting — Investigation (2026-04-25)

Investigation for `calendar-day-detail-row-splitting-finding.md`. The
finding is a natural follow-up to the Options A + C fix shipped in
commits `47a0e4a` (ListView grouping) and `290ecae` (Transplant
guardrail). Same root behavior surfacing in a third UI: the
calendar's day-detail modal.

---

## TL;DR

`DayDetailModal` (`CalendarGrid/DayDetailModal.tsx`) reads raw
`PlantingEvent[]` and renders one row per event under a phase-label
header. Same-key events (`date_type_plantId_variety_bedId`) are NOT
collapsed — exactly the gap ListView and CalendarGrid had before
Option A. The fix is a third application of the same composite key
already used in:

- `frontend/src/components/PlantingCalendar/CalendarGrid/utils.ts:137-167` (CalendarGrid pills)
- `frontend/src/components/PlantingCalendar/ListView/index.tsx:156` (ListView cards)

Single-file change, ~30–60 LOC, identical pattern, identical key.
Existing test file extends rather than replaces.

---

## Current behavior

`frontend/src/components/PlantingCalendar/CalendarGrid/DayDetailModal.tsx`:

- Receives raw `events: PlantingEvent[]` from `PlantingCalendar/index.tsx:746-763`.
- Filters by date locally (lines 52-62).
- Buckets by phase label only (lines 65-72) — produces sections like
  `"Direct Seed"`, `"Transplant"`, `"Start Seeds (Indoor)"`.
- Inside each phase bucket, renders one row per event (line 209).

Per row: PlantIcon + plant name + variety, `event.quantity` "plants",
bed name, Tracked/Plan-only pills (seed-start phase), checkmark when
complete, Start-tracking button (plan-only seed-starts), Trash icon.

**The phase-only bucketing does not collapse same-plant/variety/bed
rows.** A row of 4 beans events shows as 4 rows under one "Direct Seed"
header.

## What's missing vs ListView/CalendarGrid

DayDetailModal does NOT import `createDateMarkers`,
`GroupedDateMarker`, or `isGroupedMarker` from `CalendarGrid/utils.ts`.
It builds its own phase-bucket inline. ListView's reference pattern
(`ListView/index.tsx:115-201`) shows the canonical approach:

1. Group raw events with the composite key.
2. For each group, expose `count`, `events: PlantingEvent[]`,
   `totalQuantity`.
3. Render one row per group: singleton → existing per-event UX;
   grouped → aggregate row with `(N)` badge that opens
   `GroupedEventsModal` on click.

That same pattern fits DayDetailModal cleanly.

## Recommended fix shape

**Inline grouping with the canonical key** (option (b) per the
backend-debugger investigation).

Reasons not to pipe pre-grouped markers (option (a)):
- Parent (`PlantingCalendar/index.tsx:746-763`) passes raw events.
- Reshaping the prop contract touches multiple files for marginal
  gain.
- Inline grouping is one self-contained change.

Inside DayDetailModal, after the date filter:

1. Group `dayEvents` by
   `${dateKey}_${markerType}_${plantId}_${variety || 'none'}_${gardenBedId || 'none'}`.
2. Replace the phase-only bucket with a marker-type bucket that
   contains `Group[]` rather than `Event[]`.
3. Render one row per group:
   - **Singleton** (`count === 1`): existing per-event row UX.
     Trash, Start-tracking, checkmark all behave as before.
   - **Grouped** (`count > 1`): aggregate row with plant name
     + `(N)` badge + total quantity; click opens
     `GroupedEventsModal`. Trash hidden (or "Delete all"); Start
     tracking hidden (singleton-only API).

`markerType` derivation needs care: today the modal infers phase
from which date column matches. Switch to returning a stable
`EventMarkerType` so the key matches across views.

## Click behavior

| Scenario | Current | Proposed |
|---|---|---|
| Singleton click | Opens `EventDetailModal` via `onEventClick` | unchanged |
| Grouped click | n/a (no group concept) | opens `GroupedEventsModal` |
| Singleton trash | deletes event | unchanged |
| Grouped trash | n/a | hidden in v1; revisit if users want bulk-delete |
| Plan-only Start-tracking | per-event POST | unchanged for singletons; hidden for grouped (server endpoint takes one eventId) |

## Tests

`frontend/src/components/PlantingCalendar/CalendarGrid/__tests__/DayDetailModal.test.tsx`
exists. Covers Plan-only vs Tracked pills + Start-tracking POST. Need
to extend — not replace — with at least:

- 4 same-key events render as 1 grouped row with `(4)` badge.
- Singleton case renders unchanged (regression guard).
- Grouped row click opens `GroupedEventsModal`.

## Out-of-scope risks

- DayDetailModal is consumed only by `PlantingCalendar/index.tsx:20`
  and its own test (no Dashboard / Indoor Starts coupling). Safe to
  refactor.
- `getEventTypeInfo` returns label-based discrimination today;
  consolidating to `EventMarkerType` may have minor downstream effects
  (verify with a quick grep).

## Verdict

**Medium fix, single file, identical pattern to ListView.**
~30–60 LOC plus tests. Consistent UX across CalendarGrid pills,
ListView cards, and DayDetailModal rows once shipped.

## Options

1. **Implement now** — extend the canonical grouping pattern to
   DayDetailModal, mirroring ListView's UX exactly. Trash and Start
   tracking hidden on grouped rows; click on grouped row opens
   `GroupedEventsModal`. Tests extended, not replaced.
2. **Defer** — accept the per-cell list in DayDetailModal as a known
   limitation. Not recommended given how clean the fix is and that
   the inconsistency between three calendar views (CalendarGrid,
   ListView, DayDetailModal) actively confuses users.
3. **Variant** — implement grouping but expand inline within
   DayDetailModal on row click (no separate modal). Heavier UI lift,
   inconsistent with ListView.

## Recommendation

Option 1. Same pattern, same key, same modal target as ListView.
Smallest risk path that fully closes the third surface.
