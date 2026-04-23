# Indoor Start Banner Copy Investigation (2026-04-23)

Read-only investigation. No code modified.

Scope: confirm the designer banner's wording and click behavior after the card-level "Plan Placement" relabel shipped in `d63f487`, and propose a fix shape that resolves the copy mismatch without hiding a semantic mismatch.

---

## 1. Current banner behavior

### Banner text (verified)

`frontend/src/components/GardenDesigner.tsx:2648-2657`:

```tsx
{transplantMode && (
  <div className="bg-green-50 border border-green-300 rounded-lg p-3 mb-2 flex-shrink-0 flex items-center justify-between flex-wrap gap-2">
    <div className="flex items-center gap-2">
      <span className="text-lg">&#127793;</span>
      <span className="font-medium text-green-800 text-sm">
        Transplanting {transplantMode.plantName}
        {transplantMode.variety ? ` (${transplantMode.variety})` : ''}
        {' → '}{transplantMode.bedName}
      </span>
    </div>
```

Rendered example: `Transplanting Basil (Genovese) → Bed A`.

The word "Transplanting" is a hard-coded literal — there is no branch on entry status.

### Action button (verified)

`frontend/src/components/GardenDesigner.tsx:2659-2665`:

```tsx
<button
  onClick={handleMarkTransplanted}
  disabled={markingTransplanted}
  className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
>
  {markingTransplanted ? 'Saving...' : 'Mark Transplanted'}
</button>
```

Button label is a hard-coded literal: `Mark Transplanted` (or `Saving...` mid-request).

### Click handler — what it writes (verified)

`frontend/src/components/GardenDesigner.tsx:481-501`:

```tsx
const handleMarkTransplanted = async () => {
  if (!transplantMode) return;
  setMarkingTransplanted(true);
  try {
    const response = await apiPut(
      `/api/indoor-seed-starts/${transplantMode.seedStartId}`,
      { status: 'transplanted' }
    );
    if (response.ok) {
      showSuccess(`Marked ${transplantMode.plantName}${transplantMode.variety ? ` (${transplantMode.variety})` : ''} as transplanted!`);
      setTransplantMode(null);
      if (onTransplantComplete) onTransplantComplete();
    } else {
      showError('Failed to mark as transplanted');
    }
  } catch {
    showError('Network error marking transplanted');
  } finally {
    setMarkingTransplanted(false);
  }
};
```

What the click actually does (verified against code, not inference):

- **(a) sets `IndoorSeedStart.status = 'transplanted'`** via `PUT /api/indoor-seed-starts/:id` with body `{ status: 'transplanted' }`.
- Does **NOT** create a `PlantedItem`. No call to any `/api/garden-beds/:id/planted-items` endpoint in this handler.
- Does **NOT** advance any other model (no PlantingEvent touched here).

So the answer to the question "which of (a)/(b)/(c)/(d)" is **(a) — only sets `IndoorSeedStart.status = 'transplanted'`**.

Important cross-reference from the prior investigation (`indoor-start-transplant-now-investigation.md` §2, table row for `transplanted`): `status='transplanted'` **can** also be written from two other paths — `gardens_bp.py:39-40,:125` (auto-set when a `PlantedItem` is placed and linked to the seed start) and `harvests_bp.py:60-61` (auto-set when a harvest is logged). Neither of those is invoked by the banner's button. They are independent code paths that a user could hit by separate actions (drag a plant, log a harvest) while in transplant-mode.

### Cancel path (verified)

`frontend/src/components/GardenDesigner.tsx:2666-2672`:

```tsx
<button
  onClick={handleCancelTransplant}
  className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm font-medium rounded-lg transition-colors"
>
  Cancel
</button>
```

Handler at `GardenDesigner.tsx:503-506`:

```tsx
const handleCancelTransplant = () => {
  setTransplantMode(null);
  if (onTransplantComplete) onTransplantComplete();
};
```

Pure UI dismissal — no write, no network call. User can always bail.

---

## 2. Entry-status availability

**The entering `IndoorSeedStart.status` is NOT currently stored in component state**, but it **IS fetched and available at the point where `setTransplantMode` runs**. Making it available to the banner is trivial.

Evidence:

- `transplantMode` state type (`GardenDesigner.tsx:133-138`):
  ```tsx
  const [transplantMode, setTransplantMode] = useState<{
    seedStartId: number;
    plantName: string;
    variety?: string;
    bedName: string;
  } | null>(null);
  ```
  No `status` field — currently dropped on the floor.

- The fetch-and-set effect (`GardenDesigner.tsx:448-479`) calls `GET /api/indoor-seed-starts/:id` at line 456, parses into `data` at 458, then at 463-468 passes only four fields into `setTransplantMode`.

- The API response **does** include `status`. Verified at `backend/models.py:1265`:
  ```python
  'status': self.status,
  ```
  inside `IndoorSeedStart.to_dict()`. So `data.status` is already on the response object at `GardenDesigner.tsx:458` — it's just not propagated into the state object.

Cost to add: one new field on the `transplantMode` state type + one line inside `setTransplantMode({...})`. No new fetch, no prop drilling, no backend change.

The parent passes only `transplantSeedStartId` (the numeric id, see `GardenDesigner.tsx:479` deps and `App.tsx:531-536` where it's populated). Status flows through the existing fetch and is already in hand when the banner first renders.

---

## 3. Semantic-mismatch analysis (why Option α is risky)

Given the verified write behavior in §1, here's what happens under a copy-only relabel:

1. User has basil at `status='planned'` — never sown. Card shows "Plan Placement".
2. Click lands them in designer; banner now reads "Planning placement for Basil → Bed A" with button "Save Placement" (hypothetical Option α copy).
3. User clicks "Save Placement", expecting to reserve a future cell.
4. **Actually executes**: `PUT /api/indoor-seed-starts/:id { status: 'transplanted' }`. The basil is now recorded as transplanted despite never having been seeded.

Severity of the mismatch under Option α: **high**. The new label actively misleads. "Save placement" strongly implies a non-destructive write (like saving a draft), but the handler commits a terminal-ish lifecycle transition (`transplanted` is one of two statuses the Transplant-Now button gate excludes — see `IndoorSeedStarts.tsx:539`). After the write, the card disappears from the "things to do" flow; users have to go back through the Edit modal to correct it.

Downstream blast radius of the incorrect `status='transplanted'` write:
- The card drops out of the Transplant Now gate (§1 of prior investigation).
- Dashboard "start-of-indoor-germination-check" nudge stops firing (indirectly — it only fires for pre-transplant statuses, per `test_dashboard_endpoint.py:242` per prior investigation).
- Any workflow that filters on active indoor starts now excludes this card.
- Recovery requires the user to open the Edit modal and manually revert the status.

So Option α is **not acceptable** on its own. It would be strictly worse than today's explicit "Mark Transplanted" wording, which at least truthfully advertises what the click does.

---

## 4. Fix options

### Option α — Copy-only

**Shape**: branch `transplantMode` banner copy on entry status. Pre-hardening: "Planning placement for {plant} → {bed}" / button "Save placement". Hardening: current copy. Click handler unchanged.

**Scope**: frontend-only. ~15 LOC (1 new field on `transplantMode` type, 1 line in setter, ternary expressions in JSX for banner text + button label).

**Risk**: **High.** Per §3, this actively misleads — the button promises a reservation but commits a terminal status transition. Do not ship this alone.

### Option β — Copy + confirm dialog

**Shape**: branch copy as in Option α, AND gate the pre-hardening click with a confirm step.

- Pre-hardening entry: banner reads "Planning placement for {plant} → {bed}". Button reads something like "Mark Transplanted Now" (kept assertive so the write is never disguised). Click opens a native `window.confirm` or a small `ConfirmDialog` component: "This start is at status='seeded' and hasn't been hardened off. Marking it transplanted will advance its lifecycle to `transplanted`. Continue?" Only on confirm → existing `handleMarkTransplanted` runs.
- Hardening entry: current behavior verbatim — no dialog, single-click commits.

**Scope**: frontend-only. ~30-50 LOC: add `status` to `transplantMode` state (1+1 LOC), branch banner + button copy via ternaries (6-10 LOC), add a guarded wrapper around `handleMarkTransplanted` that triggers `window.confirm` (or a tiny `ConfirmModal`) for pre-hardening statuses (10-20 LOC), optionally a small unit test for the branch (deferred — none exists today).

**Risk**: **Low.** No backend change. The warning is shown at write time, so no semantic mismatch is hidden. Pre-hardening users get one extra click of friction; hardening users see no change. If the user cancels, nothing is written.

**Design call**: `window.confirm` is serviceable and ~3 LOC. A styled `ConfirmDialog` component costs ~20 LOC but matches the rest of the app's UI. Either is acceptable.

### Option γ — Copy + gated action (deferred write / reserved position)

**Shape**: branch copy as in Option α. Pre-hardening click stores intended placement elsewhere (new `reserved_position` field, sessionStorage, or a visual-only pin in `FuturePlantingsOverlay`) but does NOT touch status or create PlantedItem. When status later reaches `hardening`, the stored data is surfaced so the user resumes from where they left off. Hardening click: current behavior.

**Scope**: **cross-stack and large.** This is effectively Option B from the prior investigation (`indoor-start-transplant-now-investigation.md` §5). Estimated 200+ LOC: new model column(s) or JSON blob, migration, backend endpoint for reserve/clear, new designer mode, indicator on grid, conflict-detection integration, tests for all of it. Introduces a new product concept ("reserved spot") with its own lifecycle questions (what if the bed is deleted? what if the plan changes? cross-season handoff?).

**Risk**: **Medium-high scope risk, low correctness risk.** The right long-term answer if placement planning is to become a real feature, but wildly disproportionate to the P2 finding's stated intent ("smaller follow-up item").

### Option δ — Copy-only + inline warning text

**Shape**: keep the assertive copy ("Transplanting {plant}" / "Mark Transplanted") but inject an inline warning inside the banner when entry status is pre-hardening: "⚠ This start is at status='planned' — clicking will mark it transplanted anyway." No interaction change.

**Scope**: frontend-only. ~15-20 LOC (state + conditional warning JSX).

**Risk**: **Medium.** Accurate — no mismatch. But it relies on the user reading the warning; a distracted user clicking through the familiar green button can still commit a bad write. Weaker than Option β because there's no hard stop.

---

## 5. Recommendation

**Recommended: Option β (Copy + confirm dialog).**

### Rationale

The P2 finding explicitly asks for a "smaller follow-up item" and "banner-copy / flow-language follow-up, not a full lifecycle failure". Option β honors that framing while § 3 forces us to reject Option α outright. The confirm step adds ≈ 1 second of friction only on the exact scenario where a user could otherwise commit an unintended terminal write (pre-hardening entry). Hardening-entry users — the flow the current banner was designed for — see zero behavior change.

Option β also keeps the banner honest without needing new product surface. The in-banner copy can soften to "Planning placement for …" so the entry language matches the card's "Plan Placement" affordance (resolving the P2 finding's literal complaint), while the button label stays assertive ("Mark Transplanted Now") so the click never pretends to be something else. The confirm step is where the two framings reconcile: the user enters in "planning" language, gets a clear warning before the write, and only executes with explicit consent.

Option γ is the correct long-term shape but out of scope for a P2 trust-polish pass. It's worth tracking as a successor task if product wants true placement reservations. Option δ is a viable B-tier alternative if we want to avoid introducing even a confirm dialog, but it's a weaker guardrail.

---

## 6. Scope for Option β

- **LOC**: ~30-50, single file (`frontend/src/components/GardenDesigner.tsx`). No backend changes. No migration. No schema touch.
- **Files touched**:
  - `GardenDesigner.tsx:133-138` — add `status?: string` to `transplantMode` state type.
  - `GardenDesigner.tsx:463-468` — propagate `data.status` into `setTransplantMode`.
  - `GardenDesigner.tsx:481-501` — wrap `handleMarkTransplanted` with a confirm gate for non-hardening statuses; alternatively wire an existing modal component.
  - `GardenDesigner.tsx:2648-2665` — branch banner and button copy on `transplantMode.status === 'hardening'`.
- **Cross-stack?**: Frontend-only. No API contract change (the `status` field is already returned by `/api/indoor-seed-starts/:id`).
- **Specialist assignment**: `frontend-debugger`. Single-file change in a component it already owns context on (prior transplant-mode passes). No sync-validator work required — no paired files in the §2 synchronization matrix.
- **Test coverage plan**:
  - **Current coverage**: per `indoor-start-transplant-now-fix-report.md` § Verification, `IndoorSeedStarts.focus.test.tsx` exercises the card but **no unit test asserts the banner's copy or `handleMarkTransplanted` behavior**. This is a pre-existing coverage gap that the Option C relabel also flagged.
  - **Recommended additions** (blocking for merge vs. nice-to-have is a product call):
    1. React Testing Library test: with a `planned` seed start, banner renders "Planning placement for …"; clicking the action button triggers confirm; declining confirm issues no PUT; accepting issues the PUT.
    2. React Testing Library test: with a `hardening` seed start, banner renders "Transplanting …", click issues PUT with no confirm.
    3. (Optional) Playwright E2E: card "Plan Placement" → designer banner reads "Planning placement" → confirm dialog → cancel keeps status `planned`.
  - **Test coverage gap to flag**: the entire GardenDesigner transplant-mode path is currently exercised only incidentally. Worth a future `test-engineer` pass regardless of which option ships.

---

## 7. Open product decisions

1. **Confirm UX**: `window.confirm` (cheap, accessible, ugly) vs. a small styled `ConfirmDialog` component to match app aesthetics. Recommend the styled component if there's already a reusable one in the codebase — worth a 5-min check before writing one.
2. **Exact pre-hardening banner copy**: candidates include "Planning placement for {plant} → {bed}", "Reserving placement for …", "Placing {plant} → {bed}". My lean: "Planning placement for …" because it mirrors the card-level "Plan Placement" label that just shipped.
3. **Exact pre-hardening button copy**: keeping "Mark Transplanted" (assertive, matches the action) vs. softening to "Mark Transplanted Now" (emphasizes immediacy) vs. "Commit placement". Recommend staying assertive — the confirm dialog is where the softening happens, the button should never whisper about a write.
4. **Confirm copy**: should it name the current status (`status='planned'`) explicitly, or describe it ("this start hasn't been sown yet")? The former is precise but technical; the latter is friendlier. Lean friendly, with the raw status in a smaller caption for power users.
5. **Should this pass also set `actualTransplantDate`?** Today's handler only writes `status`. The backend PUT endpoint may independently set `actualTransplantDate` when status flips to `transplanted` — worth a quick check in `utilities_bp.py` before shipping, since a pre-hardening confirm-then-commit would record a transplant date that doesn't match reality. Not a blocker but a correctness edge to verify.

None of the above blocks a first pass; defaults above are safe. Item 5 is the only one worth checking code for before merge.

---

## Appendix: code references

- `frontend/src/components/GardenDesigner.tsx:133-138` — `transplantMode` state type (no `status` field today)
- `frontend/src/components/GardenDesigner.tsx:448-479` — fetch effect; `data.status` is available at line 458 but dropped at 463-468
- `frontend/src/components/GardenDesigner.tsx:481-501` — `handleMarkTransplanted`; sole endpoint: `PUT /api/indoor-seed-starts/:id { status: 'transplanted' }`
- `frontend/src/components/GardenDesigner.tsx:503-506` — `handleCancelTransplant` (pure UI dismissal)
- `frontend/src/components/GardenDesigner.tsx:2648-2673` — banner JSX (hard-coded "Transplanting" / "Mark Transplanted")
- `frontend/src/components/IndoorSeedStarts.tsx:538-564` — entry point (card "Plan Placement" / "Transplant Now" button)
- `frontend/src/App.tsx:531-536` — `onNavigateToBed` wiring; only the id is passed to the designer
- `backend/models.py:1088` — `IndoorSeedStart.status` column
- `backend/models.py:1244-1281` — `IndoorSeedStart.to_dict()`; `'status'` included at :1265
- Prior docs:
  - `dev/active/production-readiness-audit/indoor-start-plan-placement-banner-followup.md` (P2 finding)
  - `dev/active/production-readiness-audit/indoor-start-transplant-now-investigation.md` (location + write confirmation, § 3)
  - `dev/active/production-readiness-audit/indoor-start-transplant-now-fix-report.md` (what shipped in `d63f487`)

