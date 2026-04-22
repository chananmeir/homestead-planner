# Phase B Triage Response

Proceed with the next pass using these decisions:

1. Greenlight the three bug fixes now:
- #9 Designer placement creates a duplicate indoor-start record
- #10 Save-for-seed state does not persist
- #5 Export-plan succeeds but shows red nutrition error toast

These can run in parallel.

2. For #6 imported indoor starts being backdated:
Do not fix yet.
First do a short research/proposal pass and return with recommended behavior options.
I want the proposal to compare:
- clamp to today
- prompt user to reschedule
- preserve original planned date but require explicit reschedule
- skip overdue imports with warning

Please recommend one default behavior and explain why.

3. For workflow consistency items:
- #3 Create Plan returns to plan list / Work is unclear
- #7 Lettuce has Transplant Now but tomato does not
- #8 Lettuce shows destination bed but tomato does not
- #11 Duplicate plan naming flow is weak

Do one research/investigation pass first.
Treat these as likely related planner -> indoor starts -> designer lifecycle issues, not isolated UI tweaks.

4. UI/layout items:
- #1 Create Property action below the fold
- #2 Dashboard weather tile state/copy inconsistency

Defer these until after the bug fixes and workflow investigation.

5. Tracking structure:
Use the existing audit docs.
Extend `phase-b-triage.md` and/or `tasks.md` rather than creating many separate finding docs unless a specific issue grows large enough to need its own document.

6. Commit structure:
Prefer commits grouped by actual fix/domain, not by probe.
For the immediate bug-fix pass, one bug per commit is preferred if practical:
- one commit for #9
- one commit for #10
- one commit for #5

If a fix necessarily spans frontend + backend, keep that bug’s cross-stack changes in the same commit.

Please proceed and report back with:
- bug-fix results for #9, #10, #5
- the policy recommendation for #6
- the investigation summary for #3, #7, #8, #11
