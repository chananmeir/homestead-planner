Proceed with the push.

Use this commit structure:
- one bundled `fix:` commit covering both `_auto_create_indoor_seed_start` corrections
  - default `location='windowsill'`
  - persist `destination_bed_ids` from `planting_event.garden_bed_id`
- one `docs:` commit for the paired fix reports + report-back

Do not run the legacy backfill / SQL cleanup in this pass.

Reason:
These two issues are one combined correctness fix on the same helper:
- first the current-location slot was wrong
- then, once corrected, the missing planned-bed persistence became visible

The code fix should ship now.
Legacy bad rows can stay as a separate cleanup decision later.
