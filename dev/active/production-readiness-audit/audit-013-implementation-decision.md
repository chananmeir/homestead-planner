Proceed with Option α and the recommended defaults.

## Approved decisions

1. Multi-cell footprint:
Use option (a): open `PlantConfigModal` with the clicked cell pre-populated.

2. Confirm-dialog copy:
Use the recommended warning:

`This start is at status='<current>' and isn't ready for transplant. Placing it now will also mark it transplanted. Continue?`

3. Banner button label:
Use `Pick cell in <bedName>`.

4. Replace Path A or coexist:
Replace Path A.
Do not keep both flows active, because that re-introduces the same ambiguity this fix is meant to remove.

5. Destination bed mismatch:
Auto-navigate to the destination bed.

## Reason

This is a real linkage gap, not just a wording problem.

The app needs one clear user action for:

- selecting a specific indoor-start record
- placing that exact record into the bed
- linking the resulting planted item correctly

## Implementation direction

Please proceed:

1. backend first
2. frontend second
3. bundle the implementation as one cross-stack commit per the current audit convention

## Report back with

- exact backend API payload/behavior change
- exact frontend flow change
- whether Path A is fully replaced
- commit hash
- test/build results
