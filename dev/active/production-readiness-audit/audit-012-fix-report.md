# AUDIT-012 Fix Report — Property Designer Workspace Compression (2026-04-23)

Fix for the Property Designer vertical-budget finding raised in
`property-designer-workspace-finding.md`. Distinct from AUDIT-001
(empty-state CTA visibility, commit `26317b7`), addresses the
post-creation ongoing-use case.

---

## Commit

```
6935fb0 fix: Compress Property Designer header so canvas dominates the viewport
```

Not yet pushed at time of writing.

---

## Path chosen: **Path A — compress the populated-case header into an inline strip**

Agent considered A (density compression), B (expand/collapse toggle),
C (hybrid). Picked A because it:

- Adds no new state / interaction code
- Gives the biggest instant vertical win on the populated path
- Requires zero changes to the empty-state branch (AUDIT-001 intact)
- Keeps visual identity (same colors, same structure — just compressed)

---

## What changed

**When `properties.length > 0` (populated / ongoing-use case):**

- Outer card: `p-6 mb-4` → `p-3 mb-3`
- Title: `text-2xl` → `text-lg`
- Dropped: description paragraph, "⭐ NEW FEATURE" badge, trailing
  "Full drag-and-drop functionality coming soon" paragraph
- 4-card `md:grid-cols-4` stats grid with `p-6` + `text-3xl` values →
  inline `text-xs` summary in a single flex row:
  `properties | structures | types | sq ft`
- Property selector moved from its own labeled row into the same strip
- "+ New Property" button placed on the right of the strip

**When `properties.length === 0` (fresh user / empty-state):**

- Original full header card renders byte-for-byte identical. AUDIT-001
  onboarding copy, badges, stats grid, and CTA visibility preserved
  verbatim.

---

## Quantitative outcome

App chrome ≈ 70 px above the card on both viewports.

| Element | Before (populated) | After (populated) |
|---|---|---|
| Outer card padding (+ margin) | ~64 px | ~36 px |
| Title block | ~72 px | folded into single row |
| Description paragraph | ~48 px | 0 |
| 4-card stats grid | ~124 px | folded into single row |
| Property-selector block | ~80 px | folded into single row |
| Trailing footer paragraph | ~20 px | 0 |
| **Header total** | **~408 px** | **~56 px** |

### Canvas share of viewport

| Viewport | Before (canvas share) | After (canvas share) |
|---|---|---|
| 1366×768 | ~36% | **~82%** |
| 1920×1080 | ~54% | **~87%** |

Meets the finding's acceptance criterion of "canvas gets majority of
vertical real estate on standard desktop viewports."

---

## Files touched

- `frontend/src/components/PropertyDesigner.tsx` (only). +71/-64 gross
  lines, ~7 net. Gross count inflated because duplicating the original
  header into the empty-state `else` branch was required to keep
  AUDIT-001's behavior byte-identical.

No other files modified. No new hooks, no new subcomponents, no backend
changes.

---

## Verification

- `npm run build` — compiled successfully. Bundle deltas: +174 B JS,
  +15 B CSS.
- Test run: `CI=true npx react-scripts test --testPathPattern="PropertyDesigner"`
  → **no tests found** across 15 test files. Coverage gap reconfirmed.
- Three scenarios walked:
  - (a) Fresh user, no properties — empty state unchanged
  - (b) Single property selected — compact strip; canvas dominates
  - (c) Multi-property switch — no flicker / layout shift (the
    populated-vs-empty conditional doesn't cross boundaries on property
    switch; stats are aggregate across all properties)

---

## Preserved

- `data-testid="btn-create-property-empty"` (empty-state CTA from AUDIT-001)
- `data-testid="btn-create-property"` (populated-state header CTA)
- `data-testid="property-selector"` (selector dropdown)
- All existing visual identity (colors, shadow, badge styling in
  empty-state)

---

## Coverage gap (still unaddressed)

`PropertyDesigner` component has **zero** Jest / React Testing Library
tests across 15 test files in `frontend/src`. Already flagged by
AUDIT-001. Continues to be a gap. Recommended follow-up:

- Empty-state branch renders title + badge + 4-card grid + CTA
- Populated-state strip renders selector + create button + stat summary
- Property switch updates selector without re-rendering the header tree

Out of scope for this AUDIT-012 fix per the finding's "do not turn this
into a full Property Designer redesign" constraint.

---

## Deferred

- Test coverage (separate `test-engineer` pass candidate)
- Expand/collapse toggle (Path B from the approach guidance — unneeded
  given Path A achieved the canvas-share target; could revisit if
  users want the stats block back as an optional detail view)
- Canvas-internal improvements (bed rendering, interaction affordances)
  — out of scope; this was purely a vertical-budget fix

---

## Awaiting user

- Push greenlight for the local commit (`6935fb0`).
