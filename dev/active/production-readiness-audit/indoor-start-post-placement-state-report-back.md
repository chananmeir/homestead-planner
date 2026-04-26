# Indoor-Start Post-Placement State — Report Back (2026-04-25)

Option 1 shipped. Two commits:

| Commit | Type | Content |
|---|---|---|
| **`af170e3`** | `fix:` | Post-placement confirmation visual + 4 tests |
| `8408440` | `docs:` | decision + fix-report + report-back |

## Report-back

**Exact post-placement copy used:**

| Scenario | Copy |
|---|---|
| `status === 'transplanted'` + bed info | **`✓ Placed in {bedName}`** (e.g., "✓ Placed in Bed Iota") |
| `status === 'transplanted'` + no bed info | **`✓ Placement chosen`** (fallback) |
| Other statuses | confirmation NOT rendered — existing behavior preserved |

Decorative `✓` (U+2713) is in a `<span>` with `aria-hidden="true"`. Verbal text carries meaning for screen readers.

**Exact visual treatment:**

```html
<div class="mt-4 flex items-center gap-2 px-3 py-2
            bg-green-50 border border-green-200
            rounded-lg text-sm font-medium text-green-700">
  <span class="text-base leading-none" aria-hidden="true">✓</span>
  Placed in Bed Iota
</div>
```

Green pill (`bg-green-50` / `border-green-200` / `text-green-700`) — reads as "this is done". Visually heavier than the existing planned-destination row (plain text dotted-underline link at `IndoorSeedStarts.tsx:706-738`); the two are not confusable. Renders in the same vertical slot the now-hidden "Plan Placement" button used to occupy.

**Bed name resolution:** `start.destinationBedDetails[0].name`. No backend change. Single-destination case is correct; multi-destination shows the FIRST planned bed (caveat documented inline for future enhancement).

**Build / test results:**
- `npx tsc --noEmit` → exit 0 (clean)
- `IndoorSeedStarts.placementConfirmation.test.tsx`: **4/4 passing** (transplanted+bed, transplanted+no-bed fallback, growing regression guard, failed-status guard)
- All IndoorSeedStarts test suites: **12/12 passing** across 3 suites
- `code-review` verdict: **APPROVE**. 0 critical / 0 warnings / 1 suggestion (multi-destination copy follow-up — accepted per decision)

Out of scope per decision: auto-return after placement (Option 2), refetch on tab focus (Option 3). Both can be revisited if user-side re-test still reports the gap.
