# Indoor Start — Current Location + Planned Bed — Push Confirmation (2026-04-27)

Chat-reply cut of the push session. Companion to:
- `indoor-start-current-location-planned-bed-push-response.md` — user authorization to push
- `indoor-start-current-location-planned-bed-report-back.md` — pre-push session summary
- `indoor-start-current-location-set-to-bed-fix-report.md` — fix #1 detail
- `indoor-start-auto-create-missing-planned-bed-fix-report.md` — fix #2 detail

Persisted per the always-write-findings-to-md rule.

---

## Commits landed on `origin/main`

```
b3d4dc7 docs: Indoor-start auto-create — paired findings, fix reports, report-back, push approval
c4eb9b5 fix: Indoor-start auto-create — default location to windowsill + persist destination_bed_ids
```

Push range: `33a49a6..b3d4dc7  main -> main`. The 5 user-authored commits that were sitting locally ahead of `origin/main` (the location/destination clarity workstream — `2fb9ac4`, `b9a42c8`, `c11a365`, `6ae99d1`, `0def548`) went up in the same push as expected.

---

## Selective staging (the non-trivial part)

`backend/blueprints/gardens_bp.py` had three distinct hunks in the working tree before commit:

| Hunk | Lines (HEAD-relative) | Origin | Action |
|---|---|---|---|
| `_auto_create_indoor_seed_start` — `location` + `destination_bed_ids` | ~207–221 | This session | **Staged** into `c4eb9b5` |
| `planting_events()` — add `cancelled_at IS NULL` filter | ~1754–1757 | Pre-existing (cancel/uncancel feature, not mine) | Left in working tree |
| New `cancel_planting_event` + `uncancel_planting_event` routes | ~2206–2249 | Pre-existing (cancel/uncancel feature, not mine) | Left in working tree |

Approach used:
1. Wrote the auto-create hunk to a temp `.tmp_auto_create_fix.patch` file.
2. `git apply --cached --check` to verify clean apply, then `git apply --cached` to stage that hunk only into the index.
3. Verified `git diff --cached` matched expected, and `git diff` showed exactly the two pre-existing hunks remaining unstaged.
4. Removed the temp patch file.
5. `git add backend/tests/test_placement_indoor_start_dedup.py` (whole file is mine — was untracked at session start, no contamination risk).
6. Committed.

This avoided bundling unrelated work (the cancel/uncancel feature) into the fix commit — they belong in a separate cancel-flow workstream and stay in the working tree for that author/session to handle.

---

## Docs commit contents (`b3d4dc7`)

Six markdown files, all untracked at session start:

```
dev/active/production-readiness-audit/
  indoor-start-current-location-set-to-bed-finding.md             (with FIXED banner)
  indoor-start-current-location-set-to-bed-fix-report.md
  indoor-start-auto-create-missing-planned-bed-finding.md         (with FIXED banner)
  indoor-start-auto-create-missing-planned-bed-fix-report.md
  indoor-start-current-location-planned-bed-report-back.md
  indoor-start-current-location-planned-bed-push-response.md
```

Other untracked indoor-start docs in that folder (`indoor-start-plan-placement-banner-followup.md`, `indoor-start-save-placement-confirm-retest.md`) belong to other workstreams and were intentionally NOT staged.

---

## Working-tree state after push

Files still modified (all pre-existing, none from this session):

```
backend/app.py
backend/blueprints/dashboard_bp.py
backend/blueprints/gardens_bp.py            (the two cancel/uncancel hunks remain)
backend/blueprints/pages_bp.py
backend/blueprints/trellis_bp.py
backend/blueprints/utilities_bp.py
backend/models.py
backend/services/conflict_service.py
backend/services/garden_bed_service.py
backend/services/garden_planner_service.py
backend/services/geocoding_service.py
backend/services/rotation_checker.py
backend/services/trellis_validation.py
backend/structures_database.py
```

Plus the existing untracked files (`.claude/`, `.github/`, various other in-flight docs, etc.). Nothing from those was touched.

---

## Explicitly deferred per push approval

Legacy `IndoorSeedStart` rows created before the fix still have:
- `location` set to a bed name like `'replica'`
- `destination_bed_ids = NULL`

These will keep showing the wrong values on the Indoor Starts card until edited or transplanted. Suggested one-shot SQL backfills are documented in each fix report. Skipped this pass per `push-response.md`: *"Do not run the legacy backfill / SQL cleanup in this pass."*

---

## Verification

- `git log origin/main --oneline -3` confirms both new commits are on the remote tip.
- `git status` confirms my workstream files are all committed; no leftovers from this session.
- Targeted backend tests still 21/21 (re-run not needed post-commit; nothing changed between staging and commit).
