                    what  aboutt he  large size of claude.md                                                                                                                                                                                                  
● The size problem is real

  CLAUDE.md is ~1140 lines / ~45KB. Every Claude Code session loads the whole thing into the system prompt on every turn. That has concrete costs:
                                                                                                                                                                                                                                               1. Token budget tax on every conversation.
  ~10–12K tokens consumed before the user types a word. On a long session that compounds — every compaction round re-pays it. On Opus that's real money; on smaller context budgets it crowds out actual work.                               
  2. Diminishing returns on attention.
  Models attend better to short, salient instructions than to long ones. A 1140-line wall of rules competes with itself: the "NEVER modify space calc in only one location" rule sits next to 30 other "NEVER" rules, and they dilute each
  other. The most important constraints get the same visual weight as moderate ones.

  3. Drift and contradiction.
  Long docs accumulate stale claims. This file already had two examples in one cleanup round — EnterPlanMode reference, and the "planning mode" phrase you just fixed. The longer the doc, the more places drift can hide. Test counts ((36
  tests), ~220 tests) were already removed for the same reason.

  4. Onboarding cost for humans too.
  A new contributor (or a non-Claude agent) reading this top-to-bottom is doing 30+ minutes of reading before writing a line. Most of them won't, which means the rules silently fail their job.

  What's actually load-bearing vs. what's filler

  Reading the file with that lens, roughly:

  - Load-bearing (~30%): the synchronized-files table (Constraint #2), the NULL-vs-falsy rule, the case-conversion rule, parse_iso_date / parseLocalDate, the indoor-start sync helper, the season-progress source_plan_item_id rule. These
  are non-obvious, repo-specific, and prevent real bugs.
  - Useful but verbose (~30%): the High-Risk Areas section. Each one is right, but each is also 15–25 lines where 5 would do.
  - Recoverable from the codebase (~25%): Project Structure Reference (tree-style diagram), Quick Start Commands, the verification command list. All of this is in package.json, README, or trivially discoverable. Burning tokens on it on
  every turn is wasteful.
  - Pedagogical filler (~15%): "Common AI Mistakes 1–11" duplicates content already covered in Critical Constraints with longer code examples. Most are wrong/right pairs of the same rule stated above.

  The realistic options

  A. Trim in place (low risk, high payoff).
  Drop Project Structure, Quick Start, and most of "Common AI Mistakes" (keep only the 2–3 that aren't restated elsewhere). Compress High-Risk Areas to 5–8 lines each: file paths + one-sentence rule + one-line "why". Target ~400 lines.
  Probably cuts 50–60% with zero loss of load-bearing content.

  B. Split into a router + topic files.
  Keep CLAUDE.md to ~150 lines: project summary, the 5 critical constraints, and a pointer index ("for succession planting see docs/CLAUDE/succession.md"). Move the rest into docs/CLAUDE/*.md. Claude Code can pull those on demand via
  Read. Tradeoff: rules are no longer guaranteed-loaded, so anything truly critical must stay in the router.

  C. Leave it alone.
  Defensible position: this doc has demonstrably prevented regressions, and the cost of an LLM mistake on this codebase (silent space-calc desync, succession race) is much higher than the token tax. If sessions are short and the budget
  isn't tight, the bloat is paying for itself.

  My recommendation

  A, then maybe B later.

  Do the in-place trim first. It's low-risk — no rules are deleted, just compressed and de-duplicated — and you'll know within a week whether the shorter version still catches the same mistakes. If it does, B becomes attractive. If you
  find yourself re-adding deleted text, you've learned the doc was actually load-bearing at the long length, and you stop.

  The feedback file you read earlier explicitly said "Do not jump into a larger structural rewrite yet" — that's wise. Trim before restructure. Restructure before split.                                                                                                                                                                1123 +- Always plan explicitly for multi-file changes