# Property Designer Workspace Finding

## Status

- **Tracking ID**: `AUDIT-012`
- **Priority**: `P2`
- **Status**: `Verified closed`

## New user-facing finding

- **Area**: Property Designer
- **Source**: verification re-test / real-user use of the page
- **Repro account / context**: fresh-user verification on 2026-04-23 after property creation and address validation

## Finding

- **Expected**: most of the screen should support actual property-layout work once the user is on the Property Designer page.
- **Actual**: too much vertical space is consumed by the upper Property Designer info area (header/stats/explanatory section), leaving the usable design workspace compressed into the lower portion of the screen.
- **Impact**: the page technically works, but the actual property-design workflow feels cramped and inefficient. The user spends screen space on summary panels instead of on the design canvas.

## Why this matters

This is separate from the earlier empty-state/create-button issue.

- The earlier issue was about reaching the `Create Property` action.
- This issue is about the ongoing usability of the Property Designer **after** a property already exists.

In other words:

- empty-state CTA visibility may be improved
- but the page can still have poor working-layout usability once the user is actually trying to design the property

## Repro steps

1. Create or open a property in **Design -> Property Designer**.
2. View the page on a standard desktop viewport at normal browser zoom.
3. Compare the amount of viewport height consumed by the top summary/info area with the actual usable design canvas below.
4. Attempt to use the page as a working property-layout screen rather than as a status summary screen.

## Acceptance criteria

- [x] Once a property is selected, the design canvas receives the majority of vertical real estate on a standard desktop viewport.
- [x] Summary/stats/explanatory content becomes denser, collapsible, or otherwise less dominant when the user is actively designing.
- [x] The user can work on the property layout without feeling that the actual workspace is compressed into the lower strip of the page.
- [x] This fix remains separate from the already-verified empty-state create-action fix (`AUDIT-001`).

## Suggested developer framing

Treat this as a distinct UX/layout issue, not as a duplicate of the earlier create-action fix.

Possible directions to evaluate:

- compress the top summary/header area once a property is selected
- make summary blocks collapsible or denser
- prioritize canvas height over decorative/status content
- ensure the design canvas gets the majority of vertical real estate on standard desktop viewports

## Recommended scope for next pass

Keep the first pass focused on layout and workspace usability only:

- do not turn this into a full Property Designer redesign
- do not mix it with unrelated weather/property-state fixes
- optimize for a clear before/after improvement in usable canvas height on desktop

## Resolution

User re-test on 2026-04-23 reported that the page now looks materially better and the design canvas gets the majority of the usable viewport as intended. Developer reported local commits `6935fb0` (layout fix) and `6d275c9` (fix report) for this change.
