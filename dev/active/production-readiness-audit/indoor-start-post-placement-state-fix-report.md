# Indoor-Start Post-Placement State — Fix Report (2026-04-25)

Option 1 from `indoor-start-post-placement-state-decision.md` shipped.
Options 2 (auto-return) and 3 (refetch on focus) remain deferred per
decision.

---

## Exact post-placement copy used

| Scenario | Copy |
|---|---|
| `status === 'transplanted'` + `destinationBedDetails[0].name` | **`✓ Placed in {bedName}`** (e.g., "✓ Placed in Bed Iota") |
| `status === 'transplanted'` + no bed info | **`✓ Placement chosen`** |
| Other statuses (`growing`, `seeded`, `germinating`, `planned`, `hardening`/`ready`, `failed`) | confirmation NOT rendered (existing card behavior preserved) |

The decorative `✓` (U+2713) is in a `<span>` with `aria-hidden="true"` so screen readers receive only the meaningful copy.

---

## Exact visual treatment

```html
<div class="mt-4 flex items-center gap-2 px-3 py-2
            bg-green-50 border border-green-200
            rounded-lg text-sm font-medium text-green-700">
  <span class="text-base leading-none" aria-hidden="true">✓</span>
  Placed in Bed Iota
</div>
```

- Green pill (`bg-green-50`) with green border (`border-green-200`) and `text-green-700` text — reads as "this is done".
- Visually heavier than the existing planned-destination row at `IndoorSeedStarts.tsx:706-738` (plain text with dotted-underline link). The two are not confusable.
- Replaces the previously-empty action area when transplanted (the original action row at line 764 already conditionally renders to nothing when `status === 'transplanted'`, so the new block sits in roughly the same vertical slot).
- `text-base leading-none` on the checkmark span keeps the glyph flush with the text.

---

## Bed name resolution path

`start.destinationBedDetails[0].name` — the planned destination's first bed.

**Why this and not the actual placed bed**: The `IndoorSeedStart` API response does not currently expose the linked PlantingEvent's bed name. Investigating that path would have required a backend change. Decision said "do not auto-return / no backend change". For single-destination ISS (the common case), the planned destination IS the actual bed, so this is correct. For multi-destination ISS, this shows the FIRST planned bed which may not match where the user actually placed — documented in an inline comment as a known caveat for future enhancement.

**Edge case fallback**: If `destinationBedDetails` is missing/empty, copy degrades to "✓ Placement chosen" — preserves the positive-confirmation affordance even without bed info.

---

## Files changed

- `frontend/src/components/IndoorSeedStarts.tsx` (+23 / 0) — single conditional block at lines 741-761 just above the existing Actions row at new line 764.
- `frontend/src/components/__tests__/IndoorSeedStarts.placementConfirmation.test.tsx` (NEW, 213 LOC) — 4 tests.

---

## Commits

- **`af170e3`** — `fix: Show "Placed in {bed}" confirmation on transplanted Indoor Starts cards`
- _(this report + decision)_ — `docs:` follow-up

---

## Build / test results

- `npx tsc --noEmit` → exit 0 (clean)
- `IndoorSeedStarts.placementConfirmation.test.tsx`: **4/4 passing**
  - Transplanted + bed → renders "✓ Placed in Bed Iota"
  - Transplanted + no bed → renders "✓ Placement chosen" fallback
  - Growing status → no confirmation; "Plan Placement" button still renders (regression guard)
  - Failed status → no confirmation (red pill is its own affordance)
- All IndoorSeedStarts test suites: **12/12 passing across 3 suites** (existing focus + banner + new placement-confirmation)
- `code-review` verdict: **APPROVE**. 0 critical, 0 warnings, 1 suggestion (multi-destination copy follow-up — accepted per decision)

---

## Out of scope (deferred per decision)

- **Option 2** — auto-navigate back to Indoor Starts after successful placement.
- **Option 3** — refetch on tab focus / visibilitychange listener.

Both can be revisited if the user-side re-test still reports the same gap.

---

## Multi-destination follow-up note

For Indoor Starts that have multiple planned destination beds, the new confirmation row displays the FIRST planned bed. If the user picked a different one of the planned beds during placement, the copy is technically off-by-one. This is documented in an inline comment in the source. Possible future enhancements:
- Backend: include the linked PlantingEvent's `garden_bed_id` + name in the IndoorSeedStart response.
- Frontend: pluralize the copy when `destinationBedDetails.length > 1` (e.g., "Placed in {first} (+{n-1} other planned)").

Neither is in scope for this pass.
