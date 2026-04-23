# Indoor Start Banner Fix Report (2026-04-23)

Ships Option β per the user's greenlight. P2 follow-up to the
Transplant-Now card-level relabel (`d63f487`).

---

## Commit

```
2d41a02 fix: Branch transplant banner copy + gate write for pre-ready starts
```

Local only. Not yet pushed.

---

## Files changed

- `frontend/src/components/GardenDesigner.tsx` — single file.
  **27 insertions / 3 deletions**, net ~27 LOC (well under the 50
  budget).

No backend, no tests, no other frontend files touched.

---

## Status-to-copy mapping implemented

| Entry status | Banner | Button | Click |
|---|---|---|---|
| `hardening` | `Transplanting: <name>` (unchanged) | `Mark Transplanted` (unchanged) | Direct write (unchanged) |
| `planned` / `seeded` / `germinating` / `growing` | `Planning placement for: <name>` | `Save placement` | Confirm dialog → same write |
| `transplanted` / `failed` | (banner hidden — unchanged) | — | — |

---

## Write-gate behavior (pre-ready paths)

- Pre-ready click opens `ConfirmDialog` with message:
  `"This start isn't ready for transplant yet (status: <current>). Continue and mark it transplanted?"`
- Confirm label: `"Mark Transplanted"`. Proceeds to the same
  `apiPut` the direct path uses.
- Cancel: closes the dialog only; banner stays visible; user can
  still click the banner's own Cancel button to exit entirely.
- Existing `markingTransplanted` loading state flows through the
  dialog's `loading` prop.

---

## Key implementation notes

- `transplantMode` state now has an optional `status?: string`
  field. Fetch site (`fetchSeedStartInfo`) propagates
  `data.status` when building the state object.
- `handleMarkTransplanted` split into:
  - Gate (named `handleMarkTransplanted`) — dispatches to inner fn
    directly for `hardening`, or opens the confirm dialog
    otherwise.
  - Inner fn (named `executeMarkTransplanted`) — runs the same
    `apiPut('/api/indoor-seed-starts/:id', { status: 'transplanted' })`
    the code always has. Payload is byte-identical.
- `ConfirmDialog` reused from `./common/ConfirmDialog` (already
  imported in the file — no new imports).

---

## Verification

- **Build**: `cd frontend && npm run build` → `Compiled successfully.`
  Main bundle +218 B gzipped.
- **Tests**: `npx react-scripts test --testPathPattern="GardenDesigner"`
  → no tests found. Coverage gap matches what the investigation and
  summary docs already flagged — no existing test asserts banner copy
  or `handleMarkTransplanted` behavior.
- **Manual reasoning**: 6 scenarios walked (planned→Save→dialog;
  confirm→write; cancel→no write; hardening→direct; seeded path;
  banner Cancel → unchanged). All behave as designed.

---

## What did NOT change

- Backend endpoint / payload — `{ status: 'transplanted' }` unchanged.
- Banner's existing Cancel button (`handleCancelTransplant`) —
  untouched; still dismisses banner with no write.
- Status semantics, card-level "Plan Placement" labeling (shipped in
  `d63f487`), or any other flow outside the banner site.
- `actual_transplant_date` handling — still NULL after
  `status='transplanted'` via this flow (pre-existing, not a regression
  of this fix).

---

## Deferred (flagged in docs, not this pass)

- **`actual_transplant_date` auto-fill**: either server-side on
  `status='transplanted'` without an explicit date, or frontend-sent.
  Pre-existing gap.
- **AUDIT-013 workflow** — the user explicitly noted this fix does NOT
  replace the broader question of clearly placing a specific existing
  indoor-start record vs starting a new planting flow. Separate track.
- **Coverage backfill** — three tests called out in the investigation:
  planned-entry confirm-cancel, planned-entry confirm-accept,
  hardening direct-write. Candidate for a future `test-engineer` pass.

---

## Awaiting user

Push greenlight for the local commits:

```
2d41a02 fix: Branch transplant banner copy + gate write for pre-ready starts
e9f9e73 docs: Banner-copy report-back
d438c69 docs: Indoor Start banner-copy follow-up investigation + summary
```

Three commits total (this fix + the two earlier docs that were held
awaiting implementation).
