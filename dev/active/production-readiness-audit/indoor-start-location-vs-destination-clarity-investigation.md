# Indoor Start Location vs Destination Clarity — Investigation (2026-04-25)

Investigation for `indoor-start-location-vs-destination-clarity-finding.md`.
Investigation only — no code changed. Single concern: relabel two
generic UI strings ("Location", "Destination") so the meaning is
unmistakable. Frontend-only.

---

## TL;DR

The card has two place-fields with generic labels that look
interchangeable:

| Current label | Source | What it actually means |
|---|---|---|
| `Location: windowsill` | `start.location` (free-text user input — placeholder "e.g., Basement grow rack, South window") | Where the seedlings physically are right now (indoor growing area) |
| `Destination: firstbed` / `not assigned` | `start.destinationBedDetails[]` / `start.destinationBeds[]` | Which garden bed(s) the seedlings will be transplanted to LATER |

The user wants the labels to make the temporal split obvious:
*current* vs *planned*. Plus, the recently shipped "✓ Placed in
{bed}" confirmation visual (commit `af170e3`) already shows
*committed* placement separately, so this label fix is purely about
disambiguating *current location* vs *planned destination*.

---

## Evidence — every spot that needs the fix

### Card display

`frontend/src/components/IndoorSeedStarts.tsx`:

- **Line 702**: `<span className="text-gray-600">Location:</span>` (rendered when `start.location` is non-empty)
- **Line 708**: `<span className="text-gray-600">Destination:</span>` (when `destinationBedDetails` has entries)
- **Line 730**: `<span className="text-gray-600">Destination:</span>` (fallback when `destinationBeds` legacy field has entries)
- **Line 735**: `<span className="text-gray-600">Destination:</span>` (final fallback, "not assigned")

All three "Destination" variants need the same new label for consistency.

### Form input (Add/Edit New Indoor Start)

`frontend/src/components/IndoorSeedStarts.tsx`:

- **Line 1254**: `<label className="block text-sm font-medium text-gray-700 mb-1">Location</label>` — input with placeholder "e.g., Basement grow rack, South window".

### Edit modal

`frontend/src/components/IndoorSeedStarts/EditSeedStartModal.tsx`:

- **Line 352**: `<label>Destination Beds</label>` — multi-select for planned destination beds. Helper text below at line 379 already says "Select which beds these seedlings will be transplanted to" — confirms the semantic.

### Other places that use the same word

- `IndoorSeedStarts/ImportFromGardenModal.tsx:200` uses `location: 'windowsill'` as a default value when importing — internal data, not a user-facing label. Don't touch.

---

## Three wording options

All three preserve the current data shape and behavior. Frontend-only;
backend `to_dict()` keys (`location`, `destinationBeds`,
`destinationBedDetails`) stay unchanged.

### Option A — "Current location" / "Planned bed"

**Most aligned with the finding's suggested directions.**

| Spot | Before | After |
|---|---|---|
| Card display (line 702) | `Location:` | `Current location:` |
| Card display (lines 708/730/735) | `Destination:` | `Planned bed:` (use plural `Planned beds:` when 2+ beds in list) |
| Form label (line 1254) | `Location` | `Current location` |
| Edit modal label (`EditSeedStartModal.tsx:352`) | `Destination Beds` | `Planned beds` |

**Pros**: Matches the finding's preferred phrasings verbatim. "Current" + "Planned" makes the temporal split obvious.
**Cons**: Slight wording asymmetry between singular ("Planned bed") and plural ("Planned beds") if pluralizing dynamically. Easy to handle in JSX.

### Option B — "Indoor location" / "Garden destination"

| Spot | Before | After |
|---|---|---|
| Card display (line 702) | `Location:` | `Indoor location:` |
| Card display (lines 708/730/735) | `Destination:` | `Garden destination:` |
| Form label (line 1254) | `Location` | `Indoor location` |
| Edit modal label | `Destination Beds` | `Garden destination` |

**Pros**: Symmetric, both labels keyed off "indoor" vs "garden" which is a domain-natural axis. Avoids the singular/plural wrinkle.
**Cons**: "Garden destination" is still abstract — "Planned bed" is more concrete since it's literally a bed.

### Option C — Verb phrasing ("Currently in" / "Will go in")

| Spot | Before | After |
|---|---|---|
| Card display (line 702) | `Location:` | `Currently in:` |
| Card display (lines 708/730/735) | `Destination:` | `Will go in:` |
| Form label (line 1254) | `Location` | `Currently in` |
| Edit modal label | `Destination Beds` | `Will go in (beds)` |

**Pros**: Most plain-English; reads like a sentence.
**Cons**: Noun labels (`Current location`, `Planned bed`) are more conventional for form inputs and table-style cards. Verb phrasing is unusual in a form label.

---

## Recommendation

**Option A** — `Current location` / `Planned bed(s)`. Matches the finding's preferred direction verbatim, makes the temporal split clear, and keeps the labels nounlike (consistent with the existing card style).

The "✓ Placed in {bedName}" confirmation visual (already shipped in commit `af170e3`) handles the *committed* state separately, so the label "Planned bed" stays accurate even when a placement has been made — the planned destination doesn't change just because placement was committed.

Smallest scope: 5 string changes across 2 files (`IndoorSeedStarts.tsx` ×4, `EditSeedStartModal.tsx` ×1). Plural-aware handling for "Planned bed(s)" needs ~1 conditional in the card display. No backend changes, no data shape changes, no test updates expected (no tests assert these label strings — verifiable with a grep before commit).

---

## Open question for the user

Pick one of:

- **(a)** Implement Option A (`Current location` / `Planned bed[s]`) — recommended
- **(b)** Implement Option B (`Indoor location` / `Garden destination`) — symmetric noun pair
- **(c)** Implement Option C (`Currently in` / `Will go in`) — verb phrasing
- **(d)** Different wording / wait
