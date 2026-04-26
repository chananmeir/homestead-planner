# Indoor Start Location vs Destination Clarity — Fix Report (2026-04-25)

Option A from `indoor-start-location-vs-destination-clarity-decision.md` shipped.

---

## Exact label changes

| Spot | File:line | Before | After |
|---|---|---|---|
| Card display | `IndoorSeedStarts.tsx:702` | `Location:` | `Current location:` |
| Card display (rich-bed branch) | `IndoorSeedStarts.tsx:708` | `Destination:` | `Planned bed:` (or `Planned beds:` when `length > 1`) |
| Card display (legacy bed-name branch) | `IndoorSeedStarts.tsx:730` | `Destination:` | `Planned bed:` (or `Planned beds:` when `length > 1`) |
| Card display ("not assigned" fallback) | `IndoorSeedStarts.tsx:735` | `Destination:` | `Planned bed:` |
| Form label | `IndoorSeedStarts.tsx:1254` | `Location` | `Current location` |
| Edit modal label | `IndoorSeedStarts/EditSeedStartModal.tsx:352` | `Destination Beds` | `Planned beds` |

The plural-aware conditional in the card display uses `.length > 1` to switch between singular and plural forms:

```tsx
<span className="text-gray-600">
  {start.destinationBedDetails.length > 1 ? 'Planned beds:' : 'Planned bed:'}
</span>
```

Single-bed cases ("Bed Iota") get "Planned bed:" — multi-bed cases ("Bed A, Bed B") get "Planned beds:".

The "not assigned" fallback always shows "Planned bed:" since there's no list to pluralize over.

---

## What did NOT change

- Backend `to_dict()` keys (`location`, `destinationBeds`, `destinationBedDetails`) — unchanged.
- Data flow / state — unchanged.
- The recently-shipped "✓ Placed in {bedName}" confirmation visual (commit `af170e3`) — unchanged. That handles the *committed* placement state. The new "Planned bed[s]" label still describes the *intent*, which stays accurate even after placement has been committed.
- Helper text under the form input ("e.g., Basement grow rack, South window") — unchanged. Still gives concrete examples for the indoor-location field.
- Helper text under the edit modal beds list ("Select which beds these seedlings will be transplanted to") — unchanged. Still describes the planned-destination semantics.

---

## Files changed

- `frontend/src/components/IndoorSeedStarts.tsx` (+8 / −6) — 4 label spots
- `frontend/src/components/IndoorSeedStarts/EditSeedStartModal.tsx` (+2 / −2) — 1 label spot

---

## Commits

- **`c11a365`** — `fix: Indoor Starts cards relabel "Location" → "Current location" and "Destination" → "Planned bed[s]"`
- _(this report + decision)_ — `docs:` follow-up

---

## Build / test results

- `npx tsc --noEmit` → exit 0 (clean)
- IndoorSeedStarts tests: **12/12 passing** across 3 suites (focus + banner + placement-confirmation)
- No tests asserted the old labels verbatim — verified via grep before changing.

---

## Out of scope

- Any further label tightening across other components (HarvestTracker, GardenDesigner, etc.) was not part of this finding.
- The semantic difference between "Planned bed[s]" and "Placed bed" (the post-placement confirmation visual) is intentional and preserved.
