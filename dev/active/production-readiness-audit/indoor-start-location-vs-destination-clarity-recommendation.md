# Indoor Start Location vs Destination Clarity — Recommendation Summary (2026-04-25)

Concise chat-style summary of the investigation findings + decision options.
Full investigation: `indoor-start-location-vs-destination-clarity-investigation.md`.

## What I found

**Pure label clarity fix** — 5 strings across 2 frontend files. Backend data shape stays the same.

| Spot | File | Current | Source field |
|---|---|---|---|
| Card display | `IndoorSeedStarts.tsx:702` | `Location:` | `start.location` (free-text — "windowsill", "Basement grow rack") |
| Card display | `IndoorSeedStarts.tsx:708/730/735` | `Destination:` (×3 fallback variants) | `destinationBedDetails`/`destinationBeds` (planned beds) |
| Form input | `IndoorSeedStarts.tsx:1254` | `Location` | indoor location text input |
| Edit modal | `EditSeedStartModal.tsx:352` | `Destination Beds` | planned beds multi-select |

The newly-shipped "✓ Placed in {bed}" confirmation visual (commit `af170e3`) already handles the *committed* state separately, so this is purely about disambiguating *current location* (where the seedlings physically are) vs *planned destination* (which garden bed they'll be transplanted to).

## Three wording options

| # | Card "Location:" | Card "Destination:" | Form / Edit modal |
|---|---|---|---|
| **A** | `Current location:` | `Planned bed:` (`Planned beds:` when 2+) | `Current location` / `Planned beds` |
| B | `Indoor location:` | `Garden destination:` | `Indoor location` / `Garden destination` |
| C | `Currently in:` | `Will go in:` | `Currently in` / `Will go in (beds)` |

**Recommendation:** Option A — matches the finding's preferred phrasings verbatim, makes the temporal split obvious (`Current` vs `Planned`), and keeps the labels nounlike (consistent with the existing card style).

Smallest scope: 5 string changes across 2 files, +1 small conditional for `bed`/`beds` plural. No backend changes, no data shape changes, no test updates expected (no tests pin these strings).

## Open question for the user

Pick one of:

- **(a)** Implement Option A
- **(b)** Implement Option B
- **(c)** Implement Option C
- **(d)** Different wording / wait
