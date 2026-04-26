# Future-Transplant Event-Splitting — Report Back (2026-04-25)

Options A + C shipped per `future-transplant-event-splitting-decision-v2.md`.

| Commit | Type | Content |
|---|---|---|
| **`47a0e4a`** | `fix:` | Option A — ListView grouping (3 files) |
| **`290ecae`** | `fix:` | Option C — PlantConfigModal Transplant guardrail (1 file) |

## Exact ListView grouping rule

Composite key (identical to CalendarGrid):
```ts
`${dateKey}_${primary.type}_${event.plantId}_${event.variety || 'none'}_${event.gardenBedId || 'none'}`
```

`count === 1` → legacy card unchanged (checkbox + Remove preserved).
`count > 1` → single card with `(N)` badge + "Click to manage →" → opens existing `GroupedEventsModal` (bulk complete + per-event edit).

## Exact Transplant guardrail behavior

Condition: `transplantDisabled = !representativePlant?.weeksIndoors` (covers `undefined` / `null` / `0` / falsy).

When disabled:
- Transplant radio + label both render with `disabled` and `opacity-50 cursor-not-allowed`.
- Helper text becomes: *"This crop is typically direct-seeded. Transplant requires indoor seed starting (weeks indoors)."*

Plants with `weeksIndoors > 0` (tomato, pepper, etc.): unchanged — both radios remain enabled.

## Build / test results

- `npx tsc --noEmit` → exit 0, zero TypeScript errors.
- 3/3 ListView tests passing (1 updated, 2 new).
- `code-review` agent verdict: **APPROVE — Ready to commit**. 0 critical / 0 warnings / 0 suggestions.

## Out of scope

- **Option B** (`row_group_id` auto-population) deferred per decision.
- **Layer 2** (nursery escape hatch) remains separately tracked under the parent finding.
