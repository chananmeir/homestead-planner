# Tier 1 Shipped — Post-Export Indoor-Start Tracking Prompt

**Date:** 2026-06-11 · **Proposal:** `indoor-start-export-bridge-proposal.md` ·
**Evidence:** `tier0-indoor-start-findings.md`

## What was built

After a successful **Export to Calendar**, the Garden Planner now checks whether the
exported plan has transplant crops without indoor-start tracking and, if so, prompts:
"N transplant crops in 'Plan' are scheduled to start indoors but aren't being tracked
yet — track them now?" Accepting opens the existing ImportFromGardenModal (full
selection/quantity/overdue-handling flow) scoped to the just-exported plan. Declining is a
no-op; the Indoor Starts banner remains the fallback bridge. Export semantics are
unchanged — the Apr 2026 A1 decision stands.

## Design deviation from the proposal (improvement)

The proposal suggested an additive `indoorStartCandidates` field on the export response.
During implementation it turned out `GET /api/planting-events/needs-indoor-starts?planId=`
already computes exactly the candidate set (transplant date set, `weeksIndoors > 0`, no
active linked start, plan-scoped via export_key) — so the shipped version is
**frontend-only** and reuses that endpoint as the single source of truth. No backend
change, no contract change, no drift risk between "export candidates" and "banner rows."

## Changes

| File | Change |
|---|---|
| `frontend/src/components/IndoorSeedStarts/ImportFromGardenModal.tsx` | New optional `planIdOverride`/`planNameOverride` props: scope the fetch, header, and plan-attribution badges to a specific plan instead of the active plan. Behavior without the props is unchanged. |
| `frontend/src/components/GardenPlanner.tsx` | `checkIndoorStartCandidates()` runs best-effort after export success (failures are swallowed — export already succeeded); prompt modal (`data-testid="indoor-start-prompt"`, `track-indoor-starts-btn`); renders ImportFromGardenModal scoped to the exported plan. |
| `frontend/src/components/__tests__/ImportFromGardenModal.planOverride.test.tsx` | 3 tests: override wins over active plan in fetch URL; override name shown in header; no-override falls back to active plan (regression). |

## Behavior notes

- The candidate count comes from the same grouped rows the banner shows, scoped to the
  exported plan **plus unattributable events** (null/unresolvable export_key) — slightly
  broader than "this export," which is intentional: everything shown genuinely needs
  tracking.
- Past-due seedings follow the modal's existing overdue flow (skip /
  reschedule_today / import_anyway) — nothing is silently backdated.
- The prompt fires only on a successful export (including conflict-override re-export).

## Verification

- New tests: 3/3 pass.
- Full frontend suite: 34 suites / 307 tests pass.
- `npm run build`: compiles clean (+885 B gzipped).
- Live manual pass (export a plan with transplant crops → prompt → track) not run against
  the real database to avoid mutating real season data; recommend exercising once in
  normal use or under a simulation-clock session.
