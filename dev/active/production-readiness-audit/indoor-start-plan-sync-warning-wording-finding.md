# Indoor Start Plan-Sync Warning Wording Finding

## Area

Indoor Starts -> garden-plan sync warning banner

## Expected

If the app warns that an indoor seed start is out of sync with the current garden plan, the message should clearly distinguish:

- current known plan values
- current indoor-start seed quantity
- recommended sync target

The wording should not imply exact historical knowledge that the app did not actually persist.

## Actual

The warning uses phrasing like:

`Garden plan changed: now 3 plants (was ~6 when created)`

while also showing:

`Current plan: 3 plants → 5 seeds recommended`

The `was ~6 when created` portion appears to be inferred from the current `seedsStarted` value using reverse seed-buffer math, not read from a stored original historical plan snapshot.

## Impact

The warning is directionally useful, but the wording overstates confidence and can make the app sound more certain about historical plan state than it really is.

That weakens trust in the message, especially when the user wants to understand:
- where the recommendation came from
- whether the plan truly changed
- whether the app is showing exact history or a calculated estimate

## Notes

- The recommendation math itself appears intentional:
  - current plant count is converted to recommended seeds using the app's germination/buffer rule
- The likely issue is wording/trust, not the basic existence of the sync warning
- A safer phrasing would center on:
  - current plan count
  - current seeds started
  - recommended seeds now
  rather than inferred "when created" language
