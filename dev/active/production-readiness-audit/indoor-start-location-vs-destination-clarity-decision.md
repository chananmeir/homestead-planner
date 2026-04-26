Proceed with option A.

Use:
- Card "Location:" → "Current location:"
- Card "Destination:" → "Planned bed:" (or "Planned beds:" when 2+)
- Form label "Location" → "Current location"
- Edit modal label "Destination Beds" → "Planned beds"

Reason:

Option A matches the finding's preferred phrasings verbatim, makes the temporal split
("Current" vs "Planned") obvious, and keeps labels nounlike (consistent with the existing
card style). Smallest scope: 5 string changes across 2 files; backend data shape stays
the same; no tests assert these strings.
