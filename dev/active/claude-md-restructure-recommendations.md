# CLAUDE.md Restructure Recommendations

## Overall Assessment

`CLAUDE.md` has strong repo-specific content, but it is currently too long, partly stale, and mixing too many purposes into one file.

It should be kept, but reorganized so the most important rules are easier to follow consistently.

## Main Problems

### 1. Too long for an instruction file

At its current size, the highest-signal rules compete with:
- historical bug notes
- project reference material
- long command sections
- architecture descriptions

That makes it harder for both humans and coding agents to reliably extract the truly mandatory rules.

### 2. Some workflow guidance is stale

Examples:
- references to `EnterPlanMode`
- old test counts / suite sizes
- some process language that no longer matches the current environment

These should be updated or removed.

### 3. Encoding / formatting quality issues

The file still contains mojibake / bad character rendering in places.

That lowers trust in the document and makes scanning harder.

### 4. Too many different document roles in one file

Right now `CLAUDE.md` is trying to be all of these at once:
- hard rulebook
- architecture guide
- bug-history notebook
- command cheat sheet
- testing checklist
- uncertainty register

Those should be separated by priority and purpose.

## Recommended Structure

## Tier 1: Must-Follow Rules

Keep this section short, sharp, and near the top.
Target length: 1-2 pages max.

This section should include only the highest-value rules such as:

- never change schema directly; use Flask-Migrate
- keep cross-stack calculation pairs in sync
- preserve backend/frontend API contract shape
- use explicit null checks (`is not None`, `!= null`)
- use canonical date parsing helpers
- sync IndoorSeedStart when PlantingEvent completion logic changes
- do not bundle unrelated work into commits

If a rule is not truly repo-breaking when violated, it probably does not belong in Tier 1.

## Tier 2: High-Risk Domain Notes

Move the longer domain-specific guidance here.

Examples:
- space-calculation synchronization
- succession planting logic
- completion-state consistency
- indoor-start / planting-event linkage
- trellis capacity / overlap rules
- seed-saving lifecycle
- planning method vs planting style ambiguity

This section should remain detailed, but each subsection should be written as:
- why it is risky
- what invariant must hold
- where the critical files live

Avoid excessive narrative around old bug history unless it directly reinforces the invariant.

## Tier 3: Operational Reference

Move lower-priority reference material here:
- quick commands
- project structure
- uncertainty notices
- verification command defaults

This material is useful, but it should not crowd the rules people need to see first.

## Suggested Content Changes

### Keep

- synchronized file-pair warnings
- null vs falsy guidance
- date parsing guidance
- IndoorSeedStart / PlantingEvent completion sync rule
- migration discipline
- event-type / polymorphism cautions
- seed-saving lifecycle notes

### Shorten

- the project overview
- the huge project tree
- long examples where one short example is enough
- repetitive “why wrong / fix” sections if the same lesson repeats

### Update

- remove or replace `EnterPlanMode` references
- refresh stale counts of tests / endpoints / suites where practical
- update any workflow language that no longer matches current tools
- normalize wording around current audit/documentation practices

### Clean up

- fix mojibake / bad Unicode rendering
- normalize heading depth
- reduce decorative emphasis where it slows scanning

## Recommended Tone Changes

The file should stay strict, but become more scannable.

Prefer:
- short imperative rules
- small code examples
- exact file references only where necessary

Avoid:
- long prose where a rule bullet would do
- oversized sections that bury the invariant
- too many historical bug references inline

## Specific Improvement Opportunities

### 1. Replace old planning-mode instructions

Any guidance that depends on an older tool or workflow model should be rewritten in tool-agnostic terms, for example:

- “Plan explicitly before multi-file or cross-stack changes”

instead of naming obsolete workflow mechanisms.

### 2. Split “Common AI Mistakes” into critical vs optional

Some items are truly important:
- falsy/null mistakes
- API casing mistakes
- date parsing mistakes
- completion sync mistakes

Others are helpful but lower-priority:
- over-engineering simple UI changes
- some command preferences

The critical ones should be promoted or cross-linked into Tier 1 / Tier 2.

### 3. Reduce brittle test-count references

Exact numbers like:
- “218+ tests”
- “55 tests”
- “220 tests”

go stale quickly.

Prefer:
- naming the authoritative test file / suite
- or using approximate language only where useful

### 4. Keep uncertainty notes, but trim them

The uncertainty section is valuable, especially for:
- planning method vs planting style
- trellis capacity
- event-details schema

But each item should be short and actionable.

## Proposed Editing Strategy

### Pass 1

Mechanical cleanup:
- fix encoding
- remove stale tool references
- tighten headings

### Pass 2

Structural cleanup:
- split into Tier 1 / Tier 2 / Tier 3
- move long reference material downward

### Pass 3

Content cleanup:
- trim repetition
- refresh stale commands/examples
- keep only the strongest bug-derived invariants

## Suggested Outcome

After cleanup, `CLAUDE.md` should become:

- shorter at the top
- easier to scan
- stricter about the few rules that truly matter
- still rich in repo-specific knowledge
- less likely to drift or be ignored

## Bottom Line

Recommendation:
- keep `CLAUDE.md`
- do not throw it away
- refactor it into a layered document

Best target:
- concise rulebook first
- high-risk domain notes second
- reference material last

That preserves the strong content while making the file materially more usable.
