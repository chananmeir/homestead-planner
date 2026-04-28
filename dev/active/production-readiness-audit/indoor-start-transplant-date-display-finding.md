# Indoor Start Transplant Date Display Finding

## Area

Indoor Starts -> card field display

## Expected

The Indoor Starts card should show the **exact transplant date** in a simple, low-noise way that helps the user plan against the calendar.

Preferred card style:
- `Transplant on: May 21, 2024`

## Actual

The card currently shows only a relative duration, such as:

- `Transplant in: 42 days`

## Impact

Relative days alone are less useful for planning than the actual date.

At the same time, adding both the exact date and the relative countdown on the card may make the card too busy.

So the current card is under-informative, but the answer should still preserve card simplicity.

## Recommendation

On the card:
- replace the relative-days-only value with the **exact transplant date**

Avoid showing both on the card unless design intentionally makes room for it elsewhere.

If relative timing remains useful, it can live in:
- a modal
- tooltip
- or another more detailed view

## Notes

- This is a UX clarity / card-density issue, not a backend-state issue.
- It is especially relevant in simulation mode, where users are often reasoning against specific calendar dates.
