# AUDIT-011 Retest Summary (2026-04-23)

Decision cut from the read-only investigation in
`audit-011-retest-investigation.md`. Current implementation keeps
returning rows cross-plan (by-design of the earlier Option B ship);
user's retest expects the rows to match the active plan (Option A).

---

## Root cause — confirmed

Two things are happening, BOTH need fixing:

1. **Primary (by design)**: `GET /api/planting-events/needs-indoor-starts` filters by `user_id` only. Per-row `planId` / `planName` are present but the rows themselves are not filtered by active plan. This matches what was shipped in commit `5d713b9` per Option B (labeling, not scoping). Matches the user's suspect #1.
2. **Secondary latent bug**: `ImportFromGardenModal.tsx:60-65` — the fetch `useEffect` is not gated on `activePlan?.id`. Even if backend scoping lands (Option A), the frontend won't re-fetch when the user switches active plan mid-modal. User's suspect #2 is real.

Suspects #3 (stale client state) and #4 (backend attribution wrong) are **not** happening. Client state resets per-open; backend attribution is correct.

---

## Proposed fix: **Option A**

### Backend

- Accept optional `?planId=<int>` query param on `/api/planting-events/needs-indoor-starts`.
- When provided and valid (int, owned by `current_user`): filter events by `_parse_plan_item_id_from_export_key(export_key)` matching a `GardenPlanItem.id` that resolves to the given `planId`.
- When omitted: preserve current cross-plan behavior (backward compat for any other caller; no breakage).
- null-`export_key` handling: **include with `Unknown plan` label** (see decision below).

### Frontend

- `ImportFromGardenModal` appends `?planId=<activePlan.id>` to the fetch URL when active plan is set.
- useEffect gets `activePlan?.id` in its dep array so it re-fires on plan switch.
- Badge rendering can stay (defensive) — post-fix, cross-plan rows won't appear when a planId is scoped, but keeping the existing branches guards against the no-active-plan case and any future caller.

---

## null-`export_key` decision

**Recommended default: option (ii) — include null-`export_key` rows with the existing `Unknown plan` label** even when filtering.

**Rationale (agent-sourced, codebase evidence)**: drag-and-drop placements at `gardens_bp.py:472-485` and direct POSTs at `planting_service.py:93-104` never set `export_key`. Those are legitimate planting events the user might want to import as indoor starts. Option (i) ("exclude entirely") would silently hide real work.

**User override check**: if product preference is strict hard-scoping (option (i) — exclude null-export_key from the scoped view), that's a different decision and would require additional empty-state copy + a "show all" affordance. Not in scope unless you override.

---

## Index / performance

**Defer** adding an index on `GardenPlanItem.export_key`. Proposed filter reuses the existing `GardenPlanItem.id.in_(...)` batch lookup (PK-indexed, free). No new hot path against `export_key`. Matches the prior greenlight in `finding-12-implementation-decision.md` item 3 (do not add index in this pass).

---

## Scope

~20 LOC production + ~6 new backend regression tests:

- Filter returns only matching-plan rows
- Invalid `planId` → 400
- User-isolation preserved (can't pass another user's planId)
- null-`export_key` rows included per option (ii)
- Omitted `planId` preserves cross-plan behavior (backward compat)

No migration, no index, no sync-validator needed.

---

## Cross-stack split

- Backend: `backend-debugger` — endpoint filter + tests
- Frontend: `frontend-debugger` — modal fetch param + dep array
- Ship as **one commit** per the audit's "one bug, one commit" directive

---

## Blocking decision

- **Confirm the null-`export_key` handling default is option (ii)** — or override to option (i) if you want hard-scoping with empty-state UX.
- Everything else is greenlit by prior approvals.

---

## Awaiting

User confirmation of the null-handling default, then dispatch backend + frontend agents to ship Option A in one commit.
