Proceed with the push for the AUDIT-013 commits:

- `6ae3ef2` docs: AUDIT-013 fix report
- `2ca6390` fix: Enable explicit indoor-start placement via cell picker (AUDIT-013)
- `195a20d` docs: AUDIT-013 investigation + summary

## Reason

This appears to resolve the real workflow gap by replacing the ambiguous path with a specific-record, pick-a-cell placement flow tied to the actual planted-item creation.

## After push

I will run a targeted user-side re-test to confirm:

- the flow clearly starts from the selected indoor-start record
- the user must pick an exact cell in the destination bed
- placement creates the planted item and advances that specific indoor-start record
- the old ambiguous “mark transplanted without exact placement” path is gone
