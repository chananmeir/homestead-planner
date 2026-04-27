# Indoor Start Transplant Date Display — Fix Report

**Date**: 2026-04-27
**Status**: Implemented + reviewed (not committed)
**Finding**: [indoor-start-transplant-date-display-finding.md](indoor-start-transplant-date-display-finding.md)
**Investigation**: [indoor-start-transplant-date-display-investigation.md](indoor-start-transplant-date-display-investigation.md)

---

## Approved Scope

User-approved fix shape:

- Replace the card's relative-only transplant display with the exact transplant date.
- Preserve the overdue red cue.
- Keep the relative duration only in a hover `title` tooltip.
- Use `parseLocalDate` for the card rendering.
- Do **not** expand into modal/date-format unification (deferred to a separate follow-up).

---

## Change Summary

**File**: `frontend/src/components/IndoorSeedStarts.tsx`
**Lines**: 690–712 (was 690–699)
**Diff**: 19 insertions / 6 deletions, single block

**Before**:
```tsx
{daysToTransplant !== null && start.status !== 'transplanted' && (
  <div className="flex justify-between">
    <span className="text-gray-600">
      {daysToTransplant > 0 ? 'Transplant in:' : 'Transplant:'}
    </span>
    <span className={`font-medium ${daysToTransplant > 0 ? 'text-blue-600' : 'text-red-600'}`}>
      {daysToTransplant > 0
        ? `${daysToTransplant} days`
        : daysToTransplant === 0
          ? 'Today!'
          : `${Math.abs(daysToTransplant)} days overdue`}
    </span>
  </div>
)}
```

**After**:
```tsx
{start.expectedTransplantDate && start.status !== 'transplanted' && (
  <div className="flex justify-between">
    <span className="text-gray-600">Transplant on:</span>
    <span
      className={`font-medium ${
        daysToTransplant != null && daysToTransplant < 0 ? 'text-red-600' : 'text-blue-600'
      }`}
      title={
        daysToTransplant != null
          ? daysToTransplant > 0
            ? `In ${daysToTransplant} days`
            : daysToTransplant === 0
              ? 'Today'
              : `${Math.abs(daysToTransplant)} days overdue`
          : undefined
      }
    >
      {parseLocalDate(start.expectedTransplantDate).toLocaleDateString('en-US', {
        month: 'long', day: 'numeric', year: 'numeric',
      })}
    </span>
  </div>
)}
```

---

## Behavior

- Card now shows e.g. `"Transplant on: May 21, 2024"` instead of `"Transplant in: 42 days"`.
- Overdue cards render the date in red (`daysToTransplant < 0`).
- Hover the date — native tooltip displays one of: `"In N days"` / `"Today"` / `"N days overdue"`.
- Cards with `status === 'transplanted'` continue to skip this row.
- Cards with no `expectedTransplantDate` continue to skip this row (semantically equivalent to the old `daysToTransplant !== null` gate, since `getDaysUntil` returns null iff its argument is falsy).
- Simulation-mode behavior is preserved (the underlying `daysToTransplant` is computed via `useNow()`).

---

## Code Review (post-implementation)

Verdict: **LGTM** (0 critical, 0 warnings, 1 out-of-scope suggestion).

Highlights:
- Date rendering uses canonical `parseLocalDate` per CLAUDE.md "Frontend Date Parsing" rule.
- Nullable-numeric checks use `!= null` per CLAUDE.md "NULL vs Falsy" rule (preserves a real `0`).
- No synchronized file (space calculator, plant DB, SFG/MIGardener/intensive spacing tables) was touched.
- No Playwright spec asserts the old `"Transplant in:"` label — `p2-indoor-transplant-journey.spec.ts` exercises the workflow but not the card label text.
- `tsc --noEmit` clean.

Pre-existing concern flagged but explicitly deferred:
- `getDaysUntil` (line ~214) uses `new Date(dateString)` rather than `parseLocalDate`. This can drift by a day in western TZs on civil dates, which means the tooltip's "In N days" can occasionally disagree with the rendered absolute date by one day at edge cases. Out of scope per the approved fix shape; suitable for a follow-up alongside the `formatLongDate` unification item.

---

## Verification

- [x] TypeScript: `cd frontend && npx tsc --noEmit` → clean
- [x] Code review: LGTM
- [ ] Manual UI: not yet exercised (suggested below)
- [ ] Playwright: existing `p2-indoor-transplant-journey.spec.ts` still passes (not run yet — no label text assertions to break)

### Manual UI smoke (suggested)

1. Open Indoor Starts page.
2. Confirm cards now show `Transplant on: <Month Day, Year>` instead of `Transplant in: X days`.
3. Find a card with an overdue transplant — date should render in red.
4. Hover the date — tooltip shows `In N days` / `Today` / `N days overdue`.
5. Toggle simulation mode forward/backward — date is unchanged; overdue color and tooltip respond to simulated "today."
6. A card with `status === 'transplanted'` does not render this row.

---

## Out of Scope (deferred follow-ups, separate tickets)

1. **Date-format unification**: `EditSeedStartModal.tsx:423` uses bare `toLocaleDateString()` (locale default like `5/21/2024`). The card now shows `May 21, 2024`. Add `formatLongDate(date)` helper in `dateUtils.ts` and unify call sites.
2. **`getDaysUntil` TZ-safety**: switch the helper from `new Date(dateString)` to `parseLocalDate(dateString)` for civil dates. Eliminates the rare 1-day drift between absolute date and tooltip relative-days copy.
3. **Tooltip → richer detail**: if product wants the relative duration more visible than a hover `title`, the EditSeedStartModal is the natural home (already shows the absolute date).

---

## Files Changed

- `frontend/src/components/IndoorSeedStarts.tsx` (lines 690–712)
