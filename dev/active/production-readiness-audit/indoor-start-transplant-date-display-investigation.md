# Indoor Start Transplant Date Display — Investigation

**Date**: 2026-04-27
**Finding source**: [indoor-start-transplant-date-display-finding.md](indoor-start-transplant-date-display-finding.md)
**Status**: Diagnosed (not yet fixed)
**Investigator**: frontend-debugger
**Scope**: Frontend only (UX/display, no backend or data changes)

---

## TL;DR

Replace the relative-days display on the Indoor Starts card with the absolute transplant date. The data is already on the card's data object — no backend, API, or model changes required. Single-file change in `frontend/src/components/IndoorSeedStarts.tsx`, lines 690–699. No tests block it.

---

## Current Rendering

**File**: `frontend/src/components/IndoorSeedStarts.tsx:690–699`
**Current label**: `"Transplant in: <N days | Today | overdue>"`
**Variable used**: `daysToTransplant` (computed on line 568 from `expectedTransplantDate − useNow()`).

The relative duration is derived; it is not the source of truth.

---

## Data Already Available

`start.expectedTransplantDate` is on the data object the card receives — it comes straight from the backend serializer. The card already uses it elsewhere (lines 715, 717, 774) for navigation. So the absolute date is one prop access away; no derivation needed.

---

## Formatting Helper

Use the canonical TZ-safe parser in `frontend/src/utils/dateUtils.ts::parseLocalDate()` (CLAUDE.md requirement — never use `new Date(dateStr + 'T00:00:00')` inline).

Render:
```ts
parseLocalDate(start.expectedTransplantDate)
  .toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
// → "May 21, 2024"
```

---

## Simulation Mode

`daysToTransplant` is computed via `useNow()` from `SimulationContext`, so the card's "today" already respects simulation mode. The absolute date `expectedTransplantDate` comes from the backend (also simulation-aware). **No simulation regression risk.** In fact the finding is *especially* relevant in simulation mode where the user is reasoning against a specific calendar.

---

## Recommended Fix Scope (not yet applied)

**Single file**: `frontend/src/components/IndoorSeedStarts.tsx`
**Lines**: 690–699

Replace the existing block with a version keyed on `start.expectedTransplantDate` that renders the absolute date and parks the relative duration in a hover `title` (so the value isn't lost, but the card stays uncluttered):

```tsx
{start.expectedTransplantDate && start.status !== 'transplanted' && (
  <div className="flex justify-between">
    <span className="text-gray-600">Transplant on:</span>
    <span
      className={`font-medium ${
        daysToTransplant != null && daysToTransplant < 0 ? 'text-red-600' : 'text-blue-600'
      }`}
      title={
        daysToTransplant != null
          ? daysToTransplant > 0
            ? `In ${daysToTransplant} days`
            : daysToTransplant === 0
              ? 'Today'
              : `${Math.abs(daysToTransplant)} days overdue`
          : undefined
      }
    >
      {parseLocalDate(start.expectedTransplantDate).toLocaleDateString('en-US', {
        month: 'long', day: 'numeric', year: 'numeric',
      })}
    </span>
  </div>
)}
```

This satisfies the finding:
- One absolute date on the card (no dual display).
- Overdue red cue preserved.
- Relative duration available on hover for power users.
- TZ-safe via `parseLocalDate` per CLAUDE.md.

`daysToTransplant` (line 568) stays — used for the tooltip and the overdue color cue.

---

## Risks & Regression Points

- **No tests assert the literal `"Transplant in: X days"`.** Two repo matches: the source itself (line 693) and a comment in `p2-indoor-transplant-journey.spec.ts:11` ("Transplant into garden bed" — unrelated). Safe to change.
- `daysToTransplant` is only consumed inside this single rendering block — no other call sites.
- `expectedTransplantDate` is also referenced at lines 715, 717, 774 for navigation — those are unaffected.
- **Edge case**: if `expectedTransplantDate` is null/missing, the row won't render. That mirrors current behavior (today's `daysToTransplant !== null` check).

---

## Out-of-Scope but Flagged

- **Format inconsistency**: `EditSeedStartModal.tsx:423` uses the bare `toLocaleDateString()` (locale default, e.g., `5/21/2024`). After this change, the card will show `May 21, 2024` while the modal still shows `5/21/2024`. A follow-up could add `formatLongDate(date)` to `dateUtils.ts` and unify call sites. Not blocking.
- **Where to relocate the relative duration**: tooltip is the lightest option (proposed above). If product wants more visibility, the EditSeedStartModal already shows the absolute date — adding "(in 42 days)" beside it there is a natural home. Out of scope per the finding's "preserve card simplicity" note.

---

## Files Referenced

- `frontend/src/components/IndoorSeedStarts.tsx:568` — `daysToTransplant` computation
- `frontend/src/components/IndoorSeedStarts.tsx:690–699` — current rendering (fix site)
- `frontend/src/components/IndoorSeedStarts.tsx:715, 717, 774` — other `expectedTransplantDate` usages (unaffected)
- `frontend/src/components/IndoorSeedStarts/EditSeedStartModal.tsx:423` — existing absolute-date pattern; candidate for relative-days follow-up
- `frontend/src/utils/dateUtils.ts` — canonical `parseLocalDate`
- `frontend/src/contexts/SimulationContext.tsx` — `useNow` (confirms simulation-aware)
- `frontend/tests/p2-indoor-transplant-journey.spec.ts:11` — only literal-string match is a code comment, not an assertion

---

## Verification After Fix

1. Indoor Starts page shows cards with `Transplant on: <Month Day, Year>` instead of `Transplant in: X days`.
2. Card with overdue transplant still renders the date in red.
3. Hover the date — tooltip shows `In N days` / `Today` / `N days overdue`.
4. Toggle simulation mode forward/backward — the absolute date is unchanged, the overdue color cue and tooltip still respond to simulated "today."
5. Card with `status === 'transplanted'` does not render this row (unchanged behavior).
