Proceed with the push.

Approved commits:
- `9feae3b` fix: backend needs-attention grouping
- `e0d0296` fix: frontend grouped-row rendering + snooze fan-out
- `175ee57` docs: dashboard row-splitting decision / implementation / report-back

Reason:
This closes the fourth surface of the row-splitting issue family and keeps Dashboard aligned with the grouping behavior already established on the calendar surfaces.

After push, I will run a quick user-side re-test to confirm:
- grouped dashboard rows now read as one logical task
- quantities aggregate sensibly
- grouped rows do not feel inflated/noisy
