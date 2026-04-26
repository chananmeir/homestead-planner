# Indoor Start Post-Placement State — Frontend Investigation (read-only)

Date: 2026-04-25
Scope: investigation only, no code changes.

## A) "Plan Placement" render call site

**File**: `frontend/src/components/IndoorSeedStarts.tsx`
**Lines**: 742-769 (label string built at 744, rendered at 757 / 766)

Conditional gating (line 743):
```tsx
{start.status !== 'transplanted' && start.status !== 'failed' && onNavigateToBed && (() => {
  const transplantActionLabel = start.status === 'hardening' ? 'Transplant Now' : 'Plan Placement';
  return start.destinationBedDetails && start.destinationBedDetails.length > 0 ? (
    <button onClick={...}>{transplantActionLabel}</button>   // active
  ) : (
    <button disabled>{transplantActionLabel}</button>         // disabled
  );
})()}
```

Therefore the button renders if and only if status ∉ {`transplanted`, `failed`}. There is no separate "Placed" or "Placement chosen" intermediate label — the gate is binary on `transplanted`. `'hardening'` status flips the label to "Transplant Now"; every other pre-transplant status (`planned`, `seeded`, `germinating`, `growing`) shows "Plan Placement". Status badge at line 600-602 echoes `start.status` literally.

## B) Click handler and placement commit flow

**Click handler** (IndoorSeedStarts.tsx:746-754): `onNavigateToBed(firstBed.id, expectedTransplantDate, start.id)` — pure routing, no API call yet.

**App.tsx routing** (lines 528-538): `setTransplantSeedStartId(seedStartId)` + `goToTab('designer', 'design')`. Indoor Starts is unmounted (ternary render at 528).

**Designer side** (GardenDesigner.tsx):
- Line 453-486: `useEffect` on `transplantSeedStartId` fetches IndoorSeedStart, sets `transplantMode`, switches to detail view.
- Line 2751-2779: green banner with "Pick cell in {bedName}" button → `handleMarkTransplanted` (line 509).
- Line 509-516: if status==`hardening`, enter picker immediately; else show `PreReadyConfirm` modal first.
- Picker active → user clicks grid cell → `PlantConfigModal` opens.
- On confirm, all three POST paths (lines 1635-1651, 1701, 1795-1811) carry `sourceIndoorSeedStartId` in the request body to `/api/planted-items` or `/api/planted-items/batch`.

## C) Post-placement status state

**Backend** (`backend/blueprints/gardens_bp.py:117-142`):
```python
def _link_existing_indoor_seed_start(seed_start, planting_event):
    seed_start.planting_event_id = planting_event.id
    seed_start.status = 'transplanted'                  # line 125 — atomic advance
    if seed_start.actual_transplant_date is None:
        seed_start.actual_transplant_date = ...
```
Called at gardens_bp.py:565 only when `sourceIndoorSeedStartId` is supplied and the record is owned + not already terminal.

**Frontend** (GardenDesigner.tsx:1677-1681, 1848-1852): on success, calls `setTransplantMode(null)` + `setTransplantPickerActive(false)` + `onTransplantComplete()`. App.tsx:508 wires `onTransplantComplete = () => setTransplantSeedStartId(null)`. **The user remains on the GardenDesigner tab — there is no automatic return to Indoor Starts.**

**IndoorSeedStarts data refresh** (IndoorSeedStarts.tsx:146-190): `loadData()` runs once on mount (`useEffect` with `[]` deps). No refresh on tab focus, no refresh on prop change, no global event listener for indoor-start updates.

## D) Verdict

**(ii) — card not refetching after placement, AND ambiguity from user staying on Designer**, with a UX wrinkle making (i) and (iii) effectively impossible while still leaving the user perceiving "nothing happened":

- Status DOES advance on the server (`_link_existing_indoor_seed_start` is unambiguous).
- The card UI for `status === 'transplanted'` does change — both "Plan Placement" button AND the disabled fallback are suppressed (only Update + Delete remain).
- BUT IndoorSeedStarts only fetches on mount. App.tsx:528 conditionally renders `<IndoorSeedStarts />` only when `activeTab === 'indoor-starts'`. After the user lands in the Designer (line 535: `goToTab('designer','design')`), the Indoor Starts component **unmounts**. When they navigate back later, it remounts and `loadData()` re-fires fresh from the server — at which point `status === 'transplanted'` and the button is correctly hidden.

**The most likely user-perceived bug** is therefore one of two scenarios:

1. **Tester never returned to Indoor Starts to verify** — they confirmed placement in Designer, glanced at the green banner, and reported "card still shows Plan Placement" without re-navigating. Reading the source: *if they had returned, the card would have shown status='transplanted' and the button would be gone.*

2. **Tester returned but the card has no positive-confirmation UI** — only the absence of the button. Status badge silently flips from "growing" → "transplanted" with no celebratory "Placed in Bed Iota row 3" subtitle. To a tester expecting a clear "Placement chosen" affordance, this reads as "nothing happened" — exactly matching the bug-report wording.

Possibility (i) is ruled out by gardens_bp.py:125. Possibility (iii) is ruled out by IndoorSeedStarts.tsx:743 — there IS gating on `'transplanted'`. Possibility (iv) is the design gap: there is no UI state for "placement chosen but tester is still on the Designer page" because the IndoorSeedStarts component is not mounted at that moment, and on remount the status is already `'transplanted'`.

## E) Concrete file:line evidence

| Claim | Evidence |
|---|---|
| Button renders for any status ≠ {transplanted, failed} | `IndoorSeedStarts.tsx:743` |
| Label is fixed by status alone (`hardening` ⇒ "Transplant Now", else "Plan Placement") | `IndoorSeedStarts.tsx:744` |
| Click only routes — no API call from the card | `IndoorSeedStarts.tsx:747-754`, `App.tsx:531-537` |
| Indoor Starts unmounts on tab switch | `App.tsx:528` (ternary `&& <IndoorSeedStarts />`) |
| Placement POST carries `sourceIndoorSeedStartId` | `GardenDesigner.tsx:1486-1488, 1649, 1698, 1809` |
| Backend advances status to `'transplanted'` atomically | `gardens_bp.py:125` (inside `_link_existing_indoor_seed_start`) |
| Frontend clears local transplant state but does NOT navigate back to Indoor Starts | `GardenDesigner.tsx:1677-1681, 1848-1852`; `App.tsx:508` |
| `loadData()` only fires on mount; no tab-focus refetch | `IndoorSeedStarts.tsx:146-149` (deps array `[]`) |
| Status badge is the only on-card visual that changes after placement | `IndoorSeedStarts.tsx:600-602` (single span echoing `start.status`) |
| There is no "Placed in {bed}" subtitle gated on `'transplanted'` status | grep of the file finds no such conditional render |

## Notes for the parent agent

- This is a **labeling/affordance gap**, not a state-mutation gap. Model 1 *is* fully wired end-to-end.
- A fix would most plausibly add a positive-confirmation affordance for `status === 'transplanted'` (e.g., a "Placed in {destination bed}" subtitle or a green check on the status badge), rather than touching the placement commit flow.
- The "Destination" row at line 706-738 already shows the bed name regardless of status, but it does not visually shift to indicate the placement has been *committed*.
- A secondary improvement would be a refetch on tab-focus (e.g., `useEffect` wired to a global "indoor-start-updated" event or a `visibilitychange` listener), so a user who has both tabs open in different windows sees the change without a remount.
