# Future-Transplant Bug — Report Back (2026-04-25)

Layer 1 fix shipped. Three commits on `main`:

| Commit | Type | Content |
|---|---|---|
| **`35cb6fe`** | `fix:` | gardens_bp.py + 6 regression tests |
| `6c2b46a` | `docs:` | finding + investigation + decision |
| `9346ecf` | `docs:` | fix-report |

## Report-back

**Exact behavior change:** PlantingEvent created via drag-and-drop is now born `completed=is_completed, quantity_completed=quantity if is_completed else 0`, where `is_completed = (planted_date <= today)`. Past/today preserves prior behavior; future drops correctly land as `completed=False, quantity_completed=0`. PlantedItem semantics, `_auto_create_indoor_seed_start`, and `_sync_indoor_start_on_completion` are untouched.

**Both paths covered:**
- Single — `gardens_bp.py:402` (compute @ 501–509, applied @ 523–524)
- Batch — `gardens_bp.py:619` (per-request baseline @ 701–706, per-position compute @ 761–767, applied @ 808–809). Per-position `plantedDate` overrides honored, so mixed past/future batches resolve each position independently.

**Test results:**
- `test_planting_event_status.py`: **25 passed** (6 new in `TestFutureDatedPlacementCompletion`)
- `test_succession_export.py`: **36 passed** (no regression)
- Full suite: **1336 passed**, 2 failed (pre-existing geocoding network tests, unrelated), 1 xfailed
- Code-review agent verdict: **APPROVE — ready to commit**

**Note on staging:** Pre-existing cancel/uncancel WIP (cancelled_at filter at line 1746, two new endpoints at 2198+) was in the working tree before this session. I surgically staged only the Layer 1 hunks via `git apply --cached` with a filtered patch; the cancel WIP is untouched and still unstaged.

Layers 2 (nursery escape hatch) and 3 (reservation primitive) remain deferred per decision.
