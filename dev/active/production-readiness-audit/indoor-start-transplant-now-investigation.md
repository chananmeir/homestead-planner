# Indoor Start Transplant-Now Investigation (2026-04-23)

Read-only investigation. No code modified.

## 1. Current Transplant Now gating

The Transplant Now button is rendered inside the per-card Actions block in `frontend/src/components/IndoorSeedStarts.tsx:538-564`. The gating expression is split across two conditions:

**Outer gate** (`frontend/src/components/IndoorSeedStarts.tsx:539`):
```tsx
{start.status !== 'transplanted' && start.status !== 'failed' && onNavigateToBed && (
```

**Inner branch** (`frontend/src/components/IndoorSeedStarts.tsx:540`):
```tsx
start.destinationBedDetails && start.destinationBedDetails.length > 0 ? (
  <button ... onClick={() => { onNavigateToBed(firstBed.id, start.expectedTransplantDate, start.id) }}>
    Transplant Now
  </button>
) : (
  <button type="button" disabled title="Assign a destination bed first" ...>
    Transplant Now
  </button>
)
```

Exactly as commit `c98b8a0` documented. The button is ENABLED when:
- `status ∈ {planned, seeded, germinating, growing, hardening}` (i.e. anything except `transplanted` or `failed`)
- AND at least one `destinationBedDetails` entry exists
- AND the `onNavigateToBed` callback was provided by the parent

There is no other status consideration — `planned` flows through unchanged, right next to `hardening`. No date gate on `expectedTransplantDate`. No "ready" flag check. The `transplant_ready` boolean column on the backend model (`backend/models.py:1090`) is NEVER consulted by this component.

Verified against current `HEAD` (same text as in commit c98b8a0).

## 2. IndoorSeedStart lifecycle

Canonical status column declaration (`backend/models.py:1088`):
```python
status = db.Column(db.String(20), default='planned')
# comment: planned, seeded, germinating, growing, ready, transplanted
```

Frontend enum (`frontend/src/components/IndoorSeedStarts.tsx:61`):
```ts
status: 'planned' | 'germinating' | 'growing' | 'hardening' | 'transplanted' | 'failed' | 'seeded'
```

**Note the drift**: the model comment lists `ready`; the frontend uses `hardening` + `failed` instead. The EditSeedStartModal (`frontend/src/components/IndoorSeedStarts/EditSeedStartModal.tsx:208-214`) is the canonical enumeration in practice — it exposes exactly: `planned`, `seeded`, `germinating`, `growing`, `hardening`, `transplanted`, `failed`. No `ready` state is actually used anywhere.

There is ALSO an unused boolean `transplant_ready` flag on the model (`backend/models.py:1090`) marked as "User-marked ready flag" — searching shows no writer and no reader of this field in the current codebase.

### Transitions

No state-machine helper methods exist on `IndoorSeedStart`. Status is advanced by:

| State | Entry trigger | Makes sense next |
|-------|--------------|------------------|
| `planned` | Default on creation (see §4). | User seeds → `seeded` |
| `seeded` | Manual: user picks in EditSeedStartModal (`EditSeedStartModal.tsx:208`). | Sprout observed → `germinating` |
| `germinating` | Manual: Edit modal. | Leaves emerge → `growing` |
| `growing` | Manual: Edit modal. | User begins hardening → `hardening` |
| `hardening` | Manual: Edit modal. | Move outside → `transplanted` |
| `transplanted` | Manual (Edit modal) OR the in-designer "Mark Transplanted" button (see §3, `GardenDesigner.tsx:481-501`) OR as a side-effect of placing a PlantedItem that links to the seed start (`gardens_bp.py:39-40`, `gardens_bp.py:125`) OR after a HarvestRecord is logged against the linked event (`harvests_bp.py:60-61`). |
| `failed` | Manual via Edit modal + FailedSeedStartDialog cascade (`frontend/src/components/IndoorSeedStarts/FailedSeedStartDialog.tsx`). | Terminal. |

**There is no date-based auto-rollover.** `expectedGerminationDate` and `expectedTransplantDate` are displayed only. A card can sit in `planned` forever while the calendar moves past the transplant date.

## 3. What clicking Transplant Now actually does

The onClick handler (`frontend/src/components/IndoorSeedStarts.tsx:542-549`):
```tsx
onClick={() => {
  const firstBed = start.destinationBedDetails![0];
  onNavigateToBed(
    firstBed.id,
    start.expectedTransplantDate || undefined,
    start.id
  );
}}
```

`onNavigateToBed` is wired in `frontend/src/App.tsx:531-536`:
```tsx
onNavigateToBed={(bedId, date, seedStartId) => {
  setDesignerBedId(bedId);
  setDesignerDate(date || null);
  setTransplantSeedStartId(seedStartId || null);
  goToTab('designer', 'design');
}}
```

**No network request is issued.** The click is purely navigational — it swaps the active tab to the Garden Designer and stashes the seed start id in parent state.

Inside the designer, `transplantSeedStartId` triggers an effect (`frontend/src/components/GardenDesigner.tsx:448-479`) that:
1. Fetches the seed start via `GET /api/indoor-seed-starts/:id` (read only)
2. Sets local `transplantMode` state
3. Switches the designer to detail view

This renders a banner (`GardenDesigner.tsx:2648-2673`) that says "Transplanting {plantName} → {bedName}" with two buttons:
- **Mark Transplanted** → calls `handleMarkTransplanted` (`GardenDesigner.tsx:481-501`) which issues `PUT /api/indoor-seed-starts/:id { status: 'transplanted' }`. This is the only place status is actually advanced in this flow.
- **Cancel** → clears `transplantMode` without any write.

### Key distinction — the click is NAVIGATION, not EXECUTION

The finding description says clicking "feels like execution of a transplant." Code-wise, it is not: no PlantedItem is created, no status advances, nothing is written. The write only happens when the user subsequently clicks **Mark Transplanted** inside the designer's transplant-mode banner — or independently drags a plant onto the grid that is then linked to this seed start by bed-placement endpoints (`gardens_bp.py:39-40`).

This matters for the fix shape: the data model is safe today; the problem is purely **label/affordance semantics**. The button name promises an action its click handler does not perform on its own.

## 4. The user's basil scenario — reproduced in code

User imported basil via `ImportFromGardenModal`, which posts to `POST /api/indoor-seed-starts/from-planting-event` (`backend/blueprints/utilities_bp.py:1308+`). Initial status (`utilities_bp.py:1539-1540`):

```python
# Always start as 'planned' — user explicitly updates status when they seed
initial_status = 'planned'
```

Same default for the manual Add-Seed-Start flow (`POST /api/indoor-seed-starts`, `utilities_bp.py:753`).

**Result**: basil card was at `status='planned'`. Because the gating in §1 only excludes `transplanted` and `failed`, the enabled (green) Transplant Now button was shown alongside a card that had never even had seeds sown. **Finding confirmed.**

## 5. Fix options

### Option A — Strict status gating

**Shape**: Only render Transplant Now when `status ∈ {hardening}` (and optionally `growing` if `expectedTransplantDate <= now + N days`, e.g. 14). For earlier states, hide the button or show a disabled placeholder with copy like "Available once seedlings are hardening off."

**Scope**: Frontend-only, ~15-25 LOC in `IndoorSeedStarts.tsx:538-564`. No backend / no schema. Need to also think about what happens when a user has a mature plant stuck at `planned` because they never updated status — the strict gate is now blocking a legitimate action.

**Risk**:
- Medium. Users who neglect status updates (very realistic — the Edit modal is the only way to advance state today, there's no nudge) will be stuck with a disabled button forever. Tests in `test_dashboard_endpoint.py:242` already acknowledge some users leave seeds at `planned`/`seeded` past their expected date — dashboard has a "start-of-indoor-germination-check" nudge precisely because of this.
- Introduces a hidden workflow dependency: "you must advance status before you can transplant."

### Option B — Separate "Plan Placement" action

**Shape**: Split the button by status:
- Pre-ready (`planned`, `seeded`, `germinating`, `growing`): render **Plan Placement** which opens the designer in a "reserve position" mode that stores intended coordinates on IndoorSeedStart (new columns `reserved_bed_id`, `reserved_position_x`, `reserved_position_y`, or a JSON blob). Does NOT create PlantedItem, does NOT touch status.
- Ready (`hardening`): render **Transplant Now** — current behavior, commits status change.

**Scope**: Cross-stack, medium-large. New migration for reserved-position columns. New backend endpoint (or PUT extension). New designer mode (reserve vs. transplant). Probably 5-8 files, 200+ LOC including tests.

**Risk**:
- High scope creep; introduces a third concept (reserved spot) that then needs its own UI (remove reservation, show reservation indicator on grid, what if bed is deleted, reservations across seasons, etc.).
- Reservations invite new conflict-detection work against `conflict_service.py`.
- The user's finding can be addressed with much less than this.

### Option C — Relabel-only

**Shape**: Compute a label from status:
- `planned`, `seeded`: label "Plan Placement" (or "Preview Placement")
- `germinating`, `growing`, `hardening`: label "Transplant Now" or "Transplant When Ready"
- Optionally a matching `title` tooltip.

onClick behavior unchanged — still opens designer in transplant-mode. The Mark Transplanted button in the banner still requires an explicit click.

**Scope**: Frontend-only. Trivial, ~5-10 LOC.

**Risk**:
- Low. Safe because the underlying data is never written by the click alone (confirmed §3). The button is already a navigation action; a more accurate label just stops promising execution.
- **Caveat**: the in-designer banner currently reads "Transplanting {plant} → {bed}" with a "Mark Transplanted" button. That remains truthful even when entered from `planned` status, because the user must still click Mark Transplanted. But the copy "Transplanting" may feel strong pre-seeding. Minor follow-on polish.

### Option D — Hybrid: status-driven label + copy + behavior without new schema

**Shape**: Relabel per status (like Option C), AND branch the designer's transplant-mode banner:
- When entered from a pre-`hardening` status: the banner says "Planning placement for {plant} → {bed}" and the primary action is "Save Placement Note" (or simply "Close" — no status advance). No Mark Transplanted button.
- When entered from `hardening`: current banner + Mark Transplanted, unchanged.

Optionally: the pre-ready branch lets the user drop a visual pin / highlight a cell that is rendered as a "planned" indicator via existing FuturePlantingsOverlay rather than new schema. If storage is wanted without new schema, piggyback on the linked `PlantingEvent` (which already has optional `position_x/position_y` columns if present) — would need a quick check before committing to this. If no such columns, stay purely visual.

**Scope**: Frontend-only if we stay visual-only. ~40-80 LOC across `IndoorSeedStarts.tsx`, `GardenDesigner.tsx` banner, maybe a small docblock. If we persist position on the linked PlantingEvent, one backend endpoint tweak. No migration.

**Risk**:
- Low-medium. Two branches in the banner + a relabel. No new schema. Addresses all three conflated concepts from the finding without a new product surface.

## 6. Recommendation

**Recommended: Option C (pure relabel)**, with Option D as the follow-up if the user wants more.

### Rationale

The finding is fundamentally about affordance semantics, not data integrity. §3 proves the click does not execute a transplant — it navigates to a mode where an explicit second click is required. That means the cheapest and safest fix is to rename the button so it no longer promises something the click does not deliver.

Option C preserves every existing workflow: users who are ready to transplant still click the button, still land in the same designer transplant-mode banner, still click Mark Transplanted to advance status. Users who are not ready still get the same navigation affordance, but it's now labeled "Plan Placement" — which matches what actually happens. No new state, no new endpoints, no migrations, no new failure modes.

Option D is attractive because the in-designer banner still says "Transplanting …" after the relabel, and adjusting that to match the entry status is a small polish. But it crosses into designer internals, so it's a worthwhile second commit rather than the first cut. Reserve for a follow-up if the user reports the banner feels wrong after C ships.

Option A (strict gating) and Option B (reserved-position schema) are both over-engineered for what the finding actually asks for. Option A risks regressing users who leave status stale; Option B introduces a whole new product concept (reserved spots) for marginal gain.

## 7. Open product decisions

Before implementation, the user should confirm:

1. **Label for pre-ready states**: "Plan Placement" vs. "Preview Placement" vs. "Reserve Spot" vs. "Choose Spot" — all are candidates. "Plan Placement" matches the finding's language but is prescriptive; "Preview Placement" is gentler.
2. **Threshold between "plan" and "transplant" labels**: the natural cut is `hardening` (user has begun hardening off, so transplant is imminent). Alternative: `growing` AND `expectedTransplantDate <= today + 14`. The first is simpler; the second is more helpful for users who never advance past `growing`.
3. **Designer banner copy**: leave "Transplanting …" as-is for now (Option C), or include the banner relabel in the same commit (lean Option D)? My recommendation: defer, ship C first, iterate based on user feedback.
4. **Should Option D persist a reserved position?** If yes, that's likely its own mini-task; if no, visual-only via existing overlay mechanism.

## Appendix: code references

- `frontend/src/components/IndoorSeedStarts.tsx:61` — frontend status enum
- `frontend/src/components/IndoorSeedStarts.tsx:538-564` — Transplant Now button gating + click handler
- `frontend/src/components/IndoorSeedStarts/EditSeedStartModal.tsx:208-214` — canonical status enumeration (UI)
- `frontend/src/components/IndoorSeedStarts/ImportFromGardenModal.tsx` — basil import path (posts to `/from-planting-event`)
- `frontend/src/App.tsx:531-536` — `onNavigateToBed` for Indoor Starts
- `frontend/src/components/GardenDesigner.tsx:448-479` — transplant-mode effect (fetch seed start, switch view)
- `frontend/src/components/GardenDesigner.tsx:481-501` — `handleMarkTransplanted` (only status-advance write in this flow)
- `frontend/src/components/GardenDesigner.tsx:2648-2673` — transplant-mode banner UI
- `backend/models.py:1053-1103` — `IndoorSeedStart` model (status column at :1088, unused `transplant_ready` at :1090)
- `backend/blueprints/utilities_bp.py:753` — manual Add-Seed-Start default `initial_status = 'planned'`
- `backend/blueprints/utilities_bp.py:1539-1540` — import/from-planting-event default `initial_status = 'planned'`
- `backend/blueprints/gardens_bp.py:39-40`, `:125` — bed-placement endpoints auto-advance seed start status to `transplanted`
- `backend/blueprints/harvests_bp.py:60-61` — harvest also advances status to `transplanted`
- Prior commits: `c98b8a0` (added current gating), `2b59107` (link-existing-IndoorSeedStart on placement)
