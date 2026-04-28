# CLAUDE.md Trim Proposal Response

**Date**: 2026-04-27
**Subject**: Review of `dev/active/claude-md-trim-proposal.md`

## Decision

Proceed with the trim proposal.

Option A / trim-in-place is the right direction, and the proposed target of roughly 430-450 lines looks reasonable.

## Why this direction is correct

The proposal keeps the load-bearing rules that actually protect this repo:

- synchronized file-pairs guidance
- null vs falsy handling
- snake_case to camelCase contract
- canonical backend/frontend date helper rules
- IndoorSeedStart <-> PlantingEvent completion sync
- season-progress `source_plan_item_id` rule
- multi-bed succession `bed_assignments` model

It also cuts the right kinds of weight:

- drop the TOC
- drop Quick Start commands
- drop the large project tree
- merge the duplicate frontend/backend sync section into the core constraints
- prune most of `Common AI Mistakes`
- compress High-Risk Areas instead of removing them

## Requested adjustments before execution

1. Clean up encoding corruption during the same pass.

The proposal and current `CLAUDE.md` still contain mojibake like:
- `â€”`
- `âœ…`
- `â†’`

The trimmed file should come out clean and readable.

2. Keep Mistake 11 dropped.

That content is already covered by the retained IndoorSeedStart sync high-risk section.

3. Keep a very small replacement for Project Structure.

Do not keep the large tree, but add a short load-bearing-files paragraph naming only the key files/modules worth remembering.

4. Drop uncertainty items that are no longer uncertain.

Do not move them to a resolved footnote. Just remove them.

5. Bump `Last Updated` on commit.

Use the actual commit date.

## Answers to the proposal's open questions

1. Risk tolerance on dropping Common AI Mistakes:
Drop 7 of 12 as proposed.

2. Project Structure replacement:
Keep a short 5-line load-bearing-files paragraph.

3. Uncertainty items that are no longer uncertain:
Drop them.

4. Section ordering:
Preserve the current order.

5. Last Updated date:
Bump it on commit.

## Summary

This is a strong proposal and should be executed.

The only important extra requirement is that the actual trim pass should also clean up the remaining encoding corruption so the resulting `CLAUDE.md` is both shorter and more readable.
