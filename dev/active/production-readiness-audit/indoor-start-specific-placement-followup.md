# Indoor Start Specific-Placement Follow-up

## Status

- **Priority**: `P1`
- **Status**: `Deferred follow-up`

## Area

- **Feature**: Indoor Seed Starts -> Garden Designer placement workflow

## Core problem

The app still does not clearly let the user take a **specific existing indoor-start record** and place **that exact record** into a precise spot in the destination bed as distinct from creating a new planting from the garden side.

## Why this matters

From the user perspective, there are two different actions that need to stay clearly separated:

1. **Use an existing indoor start**
   - "This basil start already exists in Indoor Starts; now place this exact one into the bed."

2. **Create a new planting from the bed side**
   - "I am adding a new planting directly from Garden Designer."

Right now, that distinction is still not clear enough in the flow.

## What is already improved

- pre-ready indoor-start cards now use **`Plan Placement`** instead of prematurely saying **`Transplant Now`**
- the original misleading CTA issue is therefore partially improved

## What is still unresolved

- after entering the bed-placement flow, it is still not clear enough that the user is placing a **specific existing planned indoor start**
- the workflow can still feel too close to "start a new planting from the bed" rather than "place this exact planned indoor start"
- this is broader than the smaller banner-copy seam tracked in `indoor-start-plan-placement-banner-followup.md`

## Suggested developer framing

Treat this as a workflow-linkage follow-up, not just a copy tweak.

The question to solve is:

> How does a user take one specific indoor-start record and place that exact record into the bed in a way that is clearly distinct from creating a new planting directly in Garden Designer?

## Suggested follow-up directions

- make the entry flow explicitly identify the specific indoor-start record being placed
- make the placement flow clearly read as "placing this planned indoor start" rather than "creating a new planting"
- confirm that the resulting placement updates or advances the existing indoor-start record, not a fresh garden-side record
- keep this follow-up distinct from the smaller banner wording issue
