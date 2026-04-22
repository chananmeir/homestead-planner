# Phase B Smoke Findings

Confirmed manual smoke findings

1. Probe 1 - Property Designer create action visibility
Expected: Create Property action should be clearly reachable when no properties exist.
Actual: The action was effectively below the visible page area and required reducing browser zoom to 70% to access.
Type: UI/layout usability issue.

2. Probe 1 - Dashboard weather tile inconsistency
Expected: After property creation and address validation, the dashboard weather tile should reflect available location data or clearly indicate it is using the property location.
Actual: Dashboard says weather must be set up separately, but clicking through shows working weather without additional ZIP entry.
Type: UX/state consistency issue.

3. Probe 2 - Create Plan workflow clarity
Expected: After creating a new plan, user should be taken clearly into the working planner flow.
Actual: App returned to the plan list and required the user to infer that `Work` was the next step.
Type: Usability/workflow issue.

4. Probe 2 - Configure Strategy step missing from live flow
Expected: Docs/user journey describe a separate Configure Strategy step.
Actual: Live planner goes from seed selection directly to Review & Save, with strategy later shown as balanced.
Type: documented-product vs live-product deviation.

5. Probe 2 - Export success with unrelated red error toast
Expected: Successful export should complete without unrelated error toast.
Actual: Export succeeded, but a red toast appeared saying `Failed to load nutritio...`
Type: secondary error during successful export.

6. Probe 3 - Imported indoor starts are backdated
Expected: Importing from a plan on the current date should not silently create already-overdue starts without rescheduling help.
Actual: Imported starts were created with past start/germination dates relative to current date.
Type: scheduling/UX logic issue.

7. Probe 3 - Indoor Starts action inconsistency
Expected: Similar imported starts should present consistent actions or clearly explain differences.
Actual: Lettuce had `Transplant Now`; tomato did not.
Type: UI/workflow consistency issue.

8. Probe 3 - Destination assignment inconsistency
Expected: Imported starts should clearly show whether a destination bed is assigned.
Actual: Lettuce showed a destination bed; tomato did not clearly show one.
Type: planning/import consistency issue.

9. Probe 3 - Designer placement creates duplicate indoor-start record
Expected: Placing a crop with an existing imported indoor-start record should use/advance that existing record.
Actual: Placing lettuce resulted in a new Indoor Start card rather than clearly linking to the existing one.
Type: confirmed workflow/data-link bug.

10. Probe 4 - Save-for-seed state does not persist
Expected: After marking a plant Save for Seed, that state should persist when leaving and returning.
Actual: After leaving and reopening the plant, it was no longer marked for seed saving.
Type: persistence/state-saving bug.

11. Probe 5 - Plan duplicate naming flow is weak
Expected: User should be prompted to name the duplicated plan or see an obvious rename option immediately after duplication.
Actual: Duplicate appears to be created as original name plus `-copy`, with no obvious rename option in the flow.
Type: workflow/usability issue.

12. Retest finding - Indoor Starts import source ambiguity
Area: Indoor Starts -> From Garden Plan
Expected: When importing from a garden plan, the UI should clearly identify the source plan, and the rows shown should match that selected/active plan.
Actual: After creating/activating a different plan with a distinctive quantity signature (42 seeds), the import modal did not clearly reflect that plan, and there was no visible indication of which plan the rows were being pulled from.
Impact: User cannot trust which plan is being imported, making the import flow ambiguous and error-prone.
Type: UI/trust/scoping issue surfaced on retest after the #7/#8 fix.
