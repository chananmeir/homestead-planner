Proceed with the small cleanup pass first, but do not do the full CLAUDE.md restructure yet.

Approved next step:
- a scoped mechanical cleanup pass on `CLAUDE.md`

That cleanup pass should include:
- remove or replace stale `EnterPlanMode` references with tool-agnostic planning guidance
- update the `Last Updated` field
- trim or replace brittle exact test-count references where practical
- fix any remaining encoding / mojibake issues if found
- relocate the clearly orphaned mid-document blocks so the document flow is cleaner

Do not do the larger Tier/Tiered-document reorganization in this pass.

Reason:
- the analysis is directionally right
- but the highest-value, lowest-risk work is the small cleanup pass
- `CLAUDE.md` should remain a single file for now so the auto-load / always-read behavior stays intact
- the larger structural rewrite can be proposed separately after the cleanup pass is done

Also:
- verify Item 2 ship status before promoting it into `CLAUDE.md`
- if Item 2 is added later, prefer a tighter bullet-form version without brittle constants or test counts
