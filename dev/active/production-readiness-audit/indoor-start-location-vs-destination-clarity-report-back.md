# Indoor Start Location vs Destination Clarity — Report Back (2026-04-25)

Option A shipped. Two commits:

| Commit | Type | Content |
|---|---|---|
| **`c11a365`** | `fix:` | 5 label changes across 2 files |
| `6ae99d1` | `docs:` | decision + fix-report + report-back |

## Report-back

**Exact label changes:**

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

**What did NOT change:**
- Backend data shape (`location`, `destinationBeds`, `destinationBedDetails` keys) — unchanged
- Helper text under inputs — unchanged (still gives concrete examples like "Basement grow rack, South window")
- The "✓ Placed in {bedName}" confirmation visual (commit `af170e3`) — unchanged; it handles the committed-placement state separately, so "Planned bed[s]" still reads correctly post-placement

**Build / test results:**
- `npx tsc --noEmit` → exit 0 (clean)
- IndoorSeedStarts tests: **12/12 passing** across 3 suites (focus + banner + placement-confirmation)
- No tests asserted the old labels verbatim — verified via grep before changing

Card now reads with an obvious temporal split:
- **Current location:** windowsill (where seedlings physically are)
- **Planned bed:** Bed Iota (where they'll be transplanted)
- **✓ Placed in Bed Iota** (when committed placement has happened — separate confirmation visual)
