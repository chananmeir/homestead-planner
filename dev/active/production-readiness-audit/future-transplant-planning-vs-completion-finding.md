# Future Transplant Planning vs Completion Finding

## Status

- **Priority**: `P1`
- **Status**: `New Wave 2A finding`

## Area

- **Feature**: Garden Designer / Planting Calendar / future-dated transplant planning

## Finding

### Expected

If a user is on a future date in Garden Designer (for example, May 12, 2026) and places a plant into the bed on that future date, the system should understand that as a **planned future transplant**, not as an already-completed transplant.

The system should also distinguish between:

1. **Started from seed**
   - planning a future transplant should back-calculate when seeds need to be started indoors and related pre-transplant steps

2. **Store-bought / nursery transplant**
   - no indoor-start backdating is needed; the plant can simply be planted on that future date

### Actual

When placing a plant on a future date from the bed side, the calendar/system appears to treat it as if the transplant is already done, instead of preserving it as planned future work.

There is also no clear source distinction between:

- transplant grown from seed
- transplant brought in from outside / store-bought

## Why this is a problem

These are materially different planning flows:

- future transplant from seed should generate backward-linked indoor-start timing
- future transplant of a store-bought plant should not

Without that distinction, the calendar and planning flow can become misleading.

## Impact

- future-dated garden actions may be interpreted as completed instead of planned
- indoor-start timing may not be generated when it should be
- users cannot clearly model store-bought transplants versus seed-started transplants
- trust in future planning and calendar logic is reduced

## Suggested developer framing

Treat this as a planning-model / lifecycle issue, not just a UI bug.

Core questions:

1. When a plant is placed on a future date, should it remain a planned future transplant until that date?
2. Does the product need an explicit "plant source" distinction such as:
   - started from seed
   - store-bought transplant
3. If the source is seed-started, should the app back-calculate indoor-start timing automatically from the planned transplant date?
