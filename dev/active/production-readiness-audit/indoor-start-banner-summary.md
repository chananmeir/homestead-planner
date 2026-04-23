# Indoor Start Banner Copy — Investigation Summary (2026-04-23)

Decision cut from `indoor-start-banner-investigation.md`. P2 follow-up
to the Transplant-Now fix shipped at `d63f487`.

---

## What the banner is

- **Banner text** (`GardenDesigner.tsx:2653`): hardcoded literal
  `"Transplanting"`.
- **Action button** (`GardenDesigner.tsx:2664`): hardcoded literal
  `"Mark Transplanted"`.
- **Click handler** (`GardenDesigner.tsx:481-501`): writes
  `PUT /api/indoor-seed-starts/:id { status: 'transplanted' }`. That's
  it. **No PlantedItem creation. No `actualTransplantDate` set.** The
  backend PUT handler at `utilities_bp.py:961-971` treats each field
  independently; `actualTransplantDate` is only written if the
  frontend sends it (it doesn't).
- **Cancel path**: exists and is clean — dismisses the banner with no
  write.

---

## Why Option α (copy-only) is not acceptable

The click writes a terminal `status='transplanted'` transition. Softening
the copy without gating the write would mean users who entered via
"Plan Placement" would click "Save placement" / similar wording and
actually execute the transplant silently — exactly the hidden semantic
mismatch we're trying to avoid.

The write isn't a navigation. It's a commit. Copy alone can't fix that.

---

## Recommendation: **Option β — Copy + confirm dialog**

Copy branches by entry status:

| Entry status | Banner text | Button label |
|---|---|---|
| `hardening` | `Transplanting: <name>` (current) | `Mark Transplanted` (current) |
| any other pre-ready status (`planned`, `seeded`, `germinating`, `growing`) | `Planning placement for: <name>` | `Save placement` |

**Click behavior**:
- Hardening entry: unchanged — direct write.
- Pre-hardening entry: confirm dialog fires first. Message:
  `"This start is at status='<current>' — clicking will mark it transplanted anyway. Continue?"`
  Proceed → same write. Cancel → no write, banner dismissed.

This resolves the wording mismatch AND the write-gating concern in one
small change.

---

## Entry-status availability — already there

`IndoorSeedStart.status` is returned by `to_dict()` at `models.py:1265`,
flows into the fetch at `GardenDesigner.tsx:458`, but is currently
dropped before `setTransplantMode` at lines 463-468. Propagating it into
`transplantMode` state is a ~3-line change; no new fetch needed.

---

## Scope

- **Single file**: `frontend/src/components/GardenDesigner.tsx`
- **~30-50 LOC**: status propagation into `transplantMode` state, copy branch in banner + button, confirm dialog in `handleMarkTransplanted`
- **Frontend-only**. No backend change. No migration. No API contract change.
- **Specialist**: `frontend-debugger` — single-file, tight scope.
- **Test gap flagged**: no existing tests assert banner copy or `handleMarkTransplanted` behavior. Coverage addition is a separate `test-engineer` pass candidate.

---

## Open product decisions

**None blocking.** The investigation flagged one correctness check about `actualTransplantDate` — resolved above: no auto-set, non-issue.

One **soft** decision worth noting (pick during implementation; either is fine):

- **Confirm-dialog style**: browser-native `window.confirm(...)` vs the existing `ConfirmDialog` component from `./common/ConfirmDialog`. Prefer the `ConfirmDialog` component for consistency with other modals. Message body text:
  - Minimal: `"This start isn't ready for transplant yet (status: <status>). Continue and mark it transplanted?"`
  - Slightly softer: `"You're planning placement, but clicking Save will also mark <name> as transplanted (status: <status>). Continue?"`

---

## Observation (out of scope, flag-only)

When a user marks an IndoorSeedStart `transplanted` via this flow, the
`actual_transplant_date` remains NULL (frontend doesn't send it; backend
doesn't auto-fill). Other views that show "transplanted on <date>" will
display blank / undefined for these rows. Not a regression (this was true
before the label flip), but worth recording for a future cleanup pass to
either (a) set `actualTransplantDate` to today's value server-side when
status transitions to `transplanted` without an explicit date, or (b)
have the frontend send it in the click payload. **Not this pass.**

---

## Awaiting user

- Greenlight Option β (copy + confirm dialog), or override to a
  different option
- Dispatch frontend-debugger on approval
