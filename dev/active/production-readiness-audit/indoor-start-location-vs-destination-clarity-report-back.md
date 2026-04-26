# Indoor Start Location vs Destination Clarity — Report Back (2026-04-25)

Option A shipped per `indoor-start-location-vs-destination-clarity-decision.md`.

| Commit | Type | Content |
|---|---|---|
| **`c11a365`** | `fix:` | 5 label changes across 2 files |

## Exact label changes

| Spot | Before | After |
|---|---|---|
| Card display "Location:" | `Location:` | `Current location:` |
| Card display "Destination:" (×3 branches) | `Destination:` | `Planned bed:` / `Planned beds:` (plural when `length > 1`) |
| Form label "Location" | `Location` | `Current location` |
| Edit modal label "Destination Beds" | `Destination Beds` | `Planned beds` |

Plural-aware conditional in the card display:
```tsx
{start.destinationBedDetails.length > 1 ? 'Planned beds:' : 'Planned bed:'}
```

## What did NOT change

- Backend data shape (`location`, `destinationBeds`, `destinationBedDetails` keys) — unchanged.
- Helper text under inputs — unchanged (still gives concrete examples).
- The "✓ Placed in {bedName}" confirmation visual (commit `af170e3`) — unchanged; it handles the committed-placement state separately, so "Planned bed[s]" still reads correctly post-placement.

## Build / test results

- `npx tsc --noEmit` → exit 0 (clean)
- IndoorSeedStarts tests: **12/12 passing** across 3 suites
- No tests asserted the old labels verbatim — verified via grep
