# Next Developer Decisions

Proceed with these decisions:

1. Push:
Yes, push the 4 new commits now if they contain only the scoped fixes/docs you summarized:
- 40a0c10 docs: Phase B smoke findings, triage, research, and investigation
- 90c09a3 fix: Keep saving-seed plants visible on the designer grid (#10)
- 2b59107 fix: Link existing IndoorSeedStart on placement instead of duplicating (#9)
- e748842 fix: Stop plan-nutrition toast from firing on unrelated operations (#5)

Do not include any of the unrelated pre-existing working-tree modifications in this push.

2. #6 backdated indoor starts:
Greenlit.
Proceed with the proposal’s Option 2 + Option 4 combination:
- prompt on import
- skip overdue imports as the backend default behavior

Please implement it in a way that is explicit to the user and avoids silently creating stale/backdated starts.

3. Workflow consistency items:
Prioritize them in this order:
- first: #7 + #8 together (shared root cause)
- second: #3
- third: #11 only if it is truly small once you are already in that area

So yes, greenlight #7 + #8 next.
Also greenlight #3 after that.
Defer #11 unless it remains a very small follow-on.

4. UI/layout items:
Keep #1 and #2 deferred for now.
Do not add them into the current pass yet.

5. Reporting back:
After pushing the 4 commits and after the next fix pass, report back with:
- the pushed commit hashes / confirmation
- the implementation result for #6
- the implementation result for #7 + #8
- whether #3 was completed in the same pass
- whether #11 was deferred or included
