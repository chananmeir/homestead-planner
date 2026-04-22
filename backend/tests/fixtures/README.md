# Test Fixtures

## `frontend_parity_snapshot.json`

**What it is**: A frozen, frontend-emitted snapshot of the five cross-stack
synchronized lookup tables and the space-calculator output for every plant
that has a method-specific override. It is the source of truth that
`tests/test_cross_stack_parity.py` asserts the backend against.

**Why it exists**: `CLAUDE.md` documents five synchronized backend/frontend
file pairs as the #1 project risk. Before this snapshot existed, drift could
only be caught by manual audit. Now any divergence fails CI.

### Regenerating the snapshot

Run the emit script from the frontend directory. It requires Node (no other
global dev deps beyond what is already in `frontend/package.json`).

```bash
cd frontend
npm run parity:emit
```

The script:

1. Loads the real frontend TS modules (`sfgSpacing.ts`,
   `migardenerSpacing.ts`, `intensiveSpacing.ts`, `plantDatabase.ts`,
   `gardenPlannerSpaceCalculator.ts`) by transpiling them in-process via
   the installed `typescript` compiler.
2. Projects the data into a JSON shape the Python tests can consume.
3. Writes this file.

**Commit the regenerated snapshot** whenever you intentionally change any
of the frontend lookup tables or the space calculator. That commit makes the
change reviewable and forces the backend counterpart to be updated in the
same PR (or the parity tests fail).

### When a parity test fails

- **Do not edit this JSON by hand.** That silently hides real drift.
- If the backend is the source of truth for the change, update the
  corresponding frontend file, regenerate the snapshot, commit all three
  (backend change, frontend change, updated snapshot).
- If the frontend is the source of truth, regenerate the snapshot and
  update the backend file to match.

### Shape

```jsonc
{
  "_meta": { "generator": "...", "regenerate": "..." },
  "sfgPlantsPerCell": { "tomato-1": 1, "carrot-1": 16, ... },
  "migardenerOverrides": {
    "tomato-1": { "rowSpacing": 24, "plantSpacing": 18 },
    "spinach-1": { "rowSpacing": null, "plantSpacing": 4 },
    ...
  },
  "intensiveOverrides": { "tomato-1": 18, ... },
  "plantDatabase": [
    {
      "id": "tomato-1", "name": "Tomato", "spacing": 24, "rowSpacing": 36,
      "daysToMaturity": 75, "category": "vegetable",
      "migardener": { "plantingStyle": "...", ... }
    },
    ...
  ],
  "spaceCalculator": {
    "gridSize": 12,
    "cases": [
      { "plantId": "tomato-1", "method": "square-foot", "gridSize": 12, "cells": 1 },
      { "plantId": "tomato-1", "method": "row",         "gridSize": 12, "cells": 6 },
      ...
    ],
    "plantsReferencedButMissingFromFrontendDb": ["...", ...]
  }
}
```
