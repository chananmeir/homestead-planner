---
name: IndoorSeedStart Completion Sync Pattern
description: PlantingEvent completion must sync linked IndoorSeedStart to transplanted status — 6 code paths across gardens_bp.py and harvests_bp.py
type: project
---

When a PlantingEvent is marked `completed = True`, the linked IndoorSeedStart must be updated to `status='transplanted'` with an `actual_transplant_date`.

**Why:** Without this sync, indoor starts appear "overdue" on the indoor-starts page even when the plant is already in the ground and completed. This was a real bug discovered 2026-04-01.

**How to apply:** Any new code path that sets `event.completed = True` on a PlantingEvent MUST also call `_sync_indoor_start_on_completion(event)` (defined in `gardens_bp.py` line 23). For code in other blueprints (e.g., `harvests_bp.py`), use an inline equivalent to avoid circular imports. Audit by grepping `\.completed = True` across all blueprint files.

**Call sites as of 2026-04-01 (6 total)**:
1. gardens_bp.py ~573 — batch plant placement
2. gardens_bp.py ~1015 — PlantedItem harvest cross-model sync
3. gardens_bp.py ~1661 — PUT /planting-events/:id
4. gardens_bp.py ~1815 — POST /planting-events/:id/harvest
5. gardens_bp.py ~1934 — PATCH /planting-events/bulk-update
6. harvests_bp.py ~56 — POST /harvests (harvest log creation)

**Related earlier bug**: IndoorSeedStarts were also orphaned when PlantingEvents were deleted (fixed 2026-01-28, extended 2026-02-06). See `dev/active/indoor-seed-starts-reset-bug/context.md`.
