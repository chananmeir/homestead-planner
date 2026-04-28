# CLAUDE.md trim proposal — Option A, in-place reduction

**Date**: 2026-04-27
**Source direction**: `dev/active/claude-md-size-response.md` (user-approved Option A with priority cuts)
**Current length**: 1140 lines
**Target length**: ~430 lines (≈62% reduction)
**Method**: In-place compression and removal. No file split. No new files. No rule deletion that would lose a load-bearing invariant.

Each section below shows current line range, action, and rationale. **Nothing is edited yet** — this proposal is for review.

---

## Legend

- **KEEP** = unchanged, full text retained
- **COMPRESS** = same content, fewer lines (collapse code blocks to inline; drop redundant prose; consolidate WRONG/CORRECT pairs)
- **DROP** = remove entirely (recoverable from code, README, or another section)
- **MERGE** = fold into a different section

---

## Section-by-section

### 1. Title + Purpose (lines 1–5) — KEEP
Two lines, sets framing. No change.

### 2. Table of Contents (lines 7–23) — COMPRESS to 1 line, or DROP
A 13-item TOC for a doc that fits on one screen after trim is overhead. Either drop entirely or replace with a single-line section list. **Recommend DROP.**
*Lines saved: ~16*

### 3. Project Overview (lines 25–41) — COMPRESS
Keep the four-line stack summary (Backend / Frontend / DB / Architecture). Drop the "Key Features" bullet list — recoverable from README and not load-bearing for code edits.
*Lines saved: ~10*

### 4. Critical Constraints (lines 43–143) — KEEP, lightly compress

This is the single most important section. All five constraints stay, but each has redundant code blocks that can collapse.

- **Constraint 1 (lines 45–61)** — KEEP. Code blocks shown side-by-side; could collapse to 4 lines but minor. Suggest light edit only.
- **Constraint 2 (lines 63–83)** — KEEP. The sync-files table is the most load-bearing thing in the doc. Untouched.
- **Constraint 3 (lines 85–99)** — KEEP. Case-conversion rule is load-bearing.
- **Constraint 4 (lines 101–110)** — KEEP. Already short after the recent edit.
- **Constraint 5 (lines 112–141)** — COMPRESS. Three full code examples (Python WRONG, Python CORRECT, TSX WRONG/CORRECT) for the same rule. Collapse to one Python pair + one-line TSX note. Keep the "Common locations" bullet list — that's load-bearing.

*Lines saved: ~15*

### 5. High-Risk Areas (lines 145–407) — COMPRESS aggressively

Per your direction: each area to 5–8 lines (file paths + one-sentence rule + one-line "why"). No removals — every entry stays, just shorter. Detailed code examples move out (or are inlined as a one-liner).

| Subsection | Current lines | Target |
|---|---|---|
| Space Calc Sync (147–170) | ~24 | ~7 |
| Succession Race (172–197) | ~26 | ~8 |
| Event Type Polymorphism (199–234) | ~36 | ~7 (drop full WRONG/CORRECT block; keep one-line `event_details.get('x', default)` reminder) |
| Completion State (236–259) | ~24 | ~10 (this one is nuanced, keep slightly more) |
| **IndoorSeedStart sync (261–276)** | ~16 | ~10 — **load-bearing per your list, keep tight but complete** |
| Trellis Capacity (278–296) | ~19 | ~7 |
| UUID Linking (298–317) | ~20 | ~7 |
| Planning Method vs Planting Style (319–334) | ~16 | ~7 |
| Seed Saving (336–363) | ~28 | ~10 |
| Multi-Bed Succession (365–386) | ~22 | ~10 |
| **Season Progress (388–405)** | ~18 | ~10 — **load-bearing per your list, keep tight but complete** |

Total subsection: ~263 lines → **~93 lines**.
*Lines saved: ~170*

### 6. Database Schema Rules (lines 409–469) — COMPRESS
- Migration Workflow — keep (one short Flask-Migrate example).
- Schema Change Checklist — keep.
- Model Relationship Rules — drop the cascade code example (one line of prose covers it).
- Field Naming Conventions — keep (3 lines, load-bearing).
- Common Gotchas — keep (4 numbered items, no examples needed).

*Lines saved: ~20*

### 7. API Contract Rules (lines 471–566) — COMPRESS

This contains two of the most load-bearing helpers (`parse_iso_date`, `parseLocalDate`). Keep those rules verbatim. Compress the rest.

- **Case Conversion (474–495)** — COMPRESS. Two full code blocks (`to_dict()` and TS payload) → one short example showing both directions in 6 lines.
- **Date Handling — backend (497–515)** — KEEP. The `parse_iso_date` rule is load-bearing.
- **Frontend Date Parsing (517–534)** — KEEP. The `parseLocalDate` rule is load-bearing.
- **Error Response Format (536–549)** — DROP or compress to one line. This is a normal Flask convention, recoverable from any endpoint.
- **API URL Configuration (551–566)** — COMPRESS to 3 lines. Rule: "Use `API_BASE_URL` from `config`, never hardcode."

*Lines saved: ~40*

### 8. Frontend-Backend Synchronization (lines 568–613) — COMPRESS, then MERGE

This entire section duplicates Critical Constraint #2's sync table with longer prose and code examples. **Merge into Constraint #2** (one extra row in the table or three bullets beneath it). Keep the test pattern as a single 4-line snippet, not two 6-line ones.
*Lines saved: ~30*

### 9. Before Making Changes (lines 615–661) — COMPRESS
The Pre-Change Checklist (5 numbered items, ~30 lines) is good but bullet-heavy. Compress to 5 single-line questions. Drop the "Planning Requirements" sub-list — it restates Constraint #4.
*Lines saved: ~25*

### 10. After Making Changes (lines 663–733) — COMPRESS heavily
Eight checklist items, each with a code block. Most are routine project commands. Keep the **rules** ("if calculation changed, verify sync"), drop the inline bash blocks (move to a `## Verification commands` appendix or just one short block at the end).

Also: the orphaned bullets at lines 730–733 are doc-corruption (escaped from somewhere). Clean those up.

*Lines saved: ~40*

### 11. Common AI Mistakes (lines 735–957) — DROP most

Per your direction: keep only mistakes that add something not already stated above. Of the 12 mistakes (1–11 + X):

| Mistake | Action | Reason |
|---|---|---|
| 1. Space calc one location | DROP | Restates Constraint #2 verbatim. |
| 2. Falsy check for nullable | DROP | Restates Constraint #5 verbatim. |
| 3. Direct schema modification | DROP | Restates Constraint #1. |
| 4. Event Type Discrimination | KEEP-COMPRESS | Has a non-obvious `plant_id is None for non-planting` gotcha. Compress to 6 lines. |
| 5. Hardcoding API URLs | DROP | Restates Section 7 rule. |
| 6. Forgetting Case Conversion | DROP | Restates Constraint #3. |
| 7. JS 'Z' Suffix | DROP | Restates Section 7 `parse_iso_date` rule. |
| 8. Over-Engineering | KEEP | Not stated elsewhere. Compress to 3 lines. |
| 9. Succession Group ID Globally Unique | KEEP | Tied to UUID Linking risk; user_id-filter rule is load-bearing. Compress to 4 lines. |
| 10. Not Testing Edge Cases | KEEP | Specific edge-case list (0/1/8 successions) is useful. Compress to 4 lines. |
| 11. PlantingEvent Completion w/o IndoorSeedStart Sync | DROP | Restates High-Risk "IndoorSeedStart sync" section. |
| X. @dnd-kit pointermove | KEEP | Highly specific gotcha not anywhere else. Compress to 5 lines. |

Five mistakes survive at ~5 lines each = ~25 lines, plus a small section header.
*Lines saved: ~190*

### 12. Quick Start Commands (lines 959–1019) — DROP

Per your direction. Recoverable from `package.json`, `start-backend.bat`, `start-frontend.bat`, and `flask db --help`. **Replace with one line** in Default Verification Command pointing to those.
*Lines saved: ~60*

### 13. Project Structure Reference (lines 1021–1086) — DROP

Per your direction. Recoverable from `ls`/`tree` and the surrounding code. Replace with **one short paragraph** naming the load-bearing files: `models.py`, `services/space_calculator.py`, `services/garden_planner_service.py`, `frontend/src/components/GardenDesigner.tsx`, `frontend/src/utils/gardenPlannerSpaceCalculator.ts`, `frontend/src/data/plantDatabase.ts`. Anything else is discoverable.
*Lines saved: ~60*

### 14. Uncertainty Notices (lines 1088–1106) — KEEP, lightly compress
Seven uncertainty items, each ~2–3 lines. Already concise. Compress items where the resolution is now clear (e.g. #6 "Export Idempotency: Fully implemented" no longer belongs in *Uncertainty* — promote or drop). #1, #4 still genuinely uncertain. Net: ~12 lines instead of ~18.
*Lines saved: ~6*

### 15. Default Verification Command (lines 1108–1115) — KEEP
Already 8 lines. Useful default. Add a one-liner pointing to `start-backend.bat` / `start-frontend.bat` for dev servers (replaces dropped Quick Start).

### 16. Final Notes (lines 1117–1140) — COMPRESS
Three sub-sections with 3–4 bullets each. Keep "Conservative Approach" (4 bullets). Drop "Verification is Mandatory" (restates checklist). Drop "This Document is Living" (meta, not a rule). Keep `Last Updated` line.
*Lines saved: ~12*

---

## Projected total

| Bucket | Saved |
|---|---|
| TOC drop | 16 |
| Project Overview compress | 10 |
| Constraint 5 compress | 15 |
| High-Risk Areas compress | 170 |
| Database Schema compress | 20 |
| API Contract compress | 40 |
| Frontend-Backend Sync merge | 30 |
| Before Making Changes compress | 25 |
| After Making Changes compress | 40 |
| Common AI Mistakes prune | 190 |
| Quick Start drop | 60 |
| Project Structure drop | 60 |
| Uncertainty Notices compress | 6 |
| Final Notes compress | 12 |
| **Total saved** | **~694** |

1140 − 694 = **~446 lines** (target was ~430).

---

## What's preserved (load-bearing per your list)

All retained verbatim or compressed-but-complete:

- ✅ Synchronized file-pairs table (Constraint #2)
- ✅ NULL vs falsy handling (Constraint #5 + adoption locations)
- ✅ snake_case ↔ camelCase contract (Constraint #3 + API Contract section)
- ✅ `parse_iso_date` (backend) canonical helper rule
- ✅ `parseLocalDate` (frontend) canonical helper rule
- ✅ IndoorSeedStart ↔ PlantingEvent completion sync (high-risk + Mistake 11 either kept OR section retained)
- ✅ Season-progress `source_plan_item_id` rule
- ✅ Multi-Bed Succession `bed_assignments` data model

## What's lost

- The visual "look and feel" of the doc (emoji-heavy, code-block-heavy). Replaced with denser rule statements.
- WRONG/CORRECT teaching pairs that already restate constraints. The constraint version remains; the teaching pair goes.
- Project tree diagram (recoverable from filesystem).
- Quick Start commands (recoverable from `package.json` / batch files).

---

## Open questions before execution

1. **Risk tolerance on dropping Common AI Mistakes**: I propose dropping 7 of 12. If you want a more conservative pass, I can keep all 12 and just compress them (saves ~80 lines instead of ~190). Effect on final length: ~530 lines instead of ~446.

2. **Project Structure paragraph replacement**: Should I write a 5-line "load-bearing files" paragraph as a replacement, or drop the section entirely with no replacement?

3. **Uncertainty #6 (Export Idempotency) and #7 (Completion State)**: Both say "Fully implemented" / "Well-normalized". Strictly, these are no longer uncertain. **Drop them, keep them, or move to a "Resolved Concerns" footnote?**

4. **Section ordering**: I propose preserving the current order. If you want a re-order (e.g. promote Sync section to right after Constraints), say so and I'll reflect it in the final pass.

5. **Last Updated date**: Bump to today (2026-04-27) on commit, or leave it?

---

## Next step

Once you answer the open questions (or say "execute as-proposed, defaults"), I'll do the trim in a single edit pass and show you the diff. No commit until you approve the diff.
