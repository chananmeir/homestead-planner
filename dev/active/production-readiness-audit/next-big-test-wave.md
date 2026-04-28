# Next Big Test Wave

## Purpose

The short verification lane is effectively complete.

This next wave moves back to the broader product audit against:

- `APPLICATION_FEATURES.md`
- `USER_JOURNEY.md`

The goal is not to re-open small fixed issues.
The goal is to verify the next highest-value feature domains and user journeys that still have little or no direct user-side proof recorded.

## Important framing

This app should be treated as a **multi-user application**.

But the next testing should still proceed in this order:

1. **Single-user correctness first**
2. **Multi-user isolation and permissions second**

Reason:

- if a feature is still wrong for one user, multi-user testing adds noise
- first prove that the workflow works correctly at all
- then prove that it stays isolated and permission-safe across users

## Wave 2A priorities - Single-user breadth first

### 1. Dashboard + Calendar + Snapshot

Why first:

- these are central user-facing surfaces
- they are where date-aware logic, alerts, and cross-module consistency show up
- they are likely to reveal integration drift quickly

Verify:

- Dashboard cards reflect actual active plan, counts, and date state
- Needs Attention signals are believable and deep-link correctly
- Planting Calendar list/grid/timeline are consistent
- Garden Snapshot matches the same date/state shown elsewhere
- date-driven behavior stays coherent across dashboard, calendar, and snapshot

### 2. Harvest + Nutrition + Weather / Alerts

Why second:

- these are high-value user outcomes
- they depend on cross-module aggregation and can look correct while being wrong underneath

Verify:

- Harvest logging and totals
- Nutrition roll-up from garden + other sources
- year / season views
- weather alert behavior
- frost / heat / rain logic
- soil temperature and readiness context

### 3. Seed Inventory + CSV + Homegrown lifecycle

Why third:

- inventory drives planning trust
- CSV import and homegrown lifecycle are easy places for subtle drift or dead ends

Verify:

- My Inventory fields and badge behavior
- CSV import flow and preview/error handling
- import from catalog / sync from catalog
- homegrown seeds remain visible through later planning flows
- variety overrides actually affect downstream behavior

### 4. Property Designer structures + map behavior

Why fourth:

- core property creation is now in better shape
- but the real property-layout feature set is much larger than what we have directly tested

Verify:

- structure placement
- structure properties
- map layers / snapping / coordinates
- acreage / frost / zone / soil / slope persistence
- tree-related property outputs where applicable

### 5. Livestock + Compost + Photos

Why fifth:

- these are meaningful product claims but have had much less direct audit attention
- they are likely to contain unfinished or lightly traveled workflows

Verify:

- livestock record flows
- egg / hive / health logging
- compost lifecycle and dashboard surfacing
- photo upload / association / filtering / lightbox behavior

## Wave 2B priorities - Multi-user and admin isolation

Only start this after Wave 2A has established that the core single-user flows behave correctly.

### 1. Auth / Admin / Multi-user isolation

Why first in Wave 2B:

- this is critical platform behavior
- it should be tested explicitly, not assumed
- but it is easiest to interpret after single-user correctness is already known

Verify:

- multiple users do not see each other's plans, seeds, photos, compost, livestock, or dashboard signals
- admin-only behavior is protected
- regular users cannot access admin capabilities
- last-admin protections work
- cross-user destructive actions are blocked

## Multi-user requirement

Yes: this should be treated as a multi-user application.

Evidence already in scope/docs:

- `APPLICATION_FEATURES.md` includes authentication and user management
- `tasks.md` already contains:
  - "Verify multi-user isolation across gardens, seeds, livestock, photos, and admin-visible data."
  - "Verify admin role behavior and protections."
  - "Verify snooze state does not affect other users."

So the broader audit should explicitly include:

- at least two regular users
- ideally one admin user
- side-by-side checks that data and actions stay isolated

But not in the very next step.

First complete Wave 2A single-user breadth.
Then run Wave 2B for multi-user/admin isolation.

## Recommended execution order

### Wave 2A - Single-user breadth

1. Dashboard + Calendar + Snapshot
2. Harvest + Nutrition + Weather / Alerts
3. Seed Inventory + CSV + Homegrown lifecycle
4. Property Designer structures + map behavior
5. Livestock + Compost + Photos

### Wave 2B - Multi-user / admin isolation

1. Auth / Admin / Multi-user isolation
2. Per-user dashboard / alerts / snooze state
3. Per-user plans / seeds / photos / livestock / compost separation

## Recommended test style

- keep using focused user-side verification first
- log concrete findings immediately into `developer-issue-log.md` when they are actionable
- update `tasks.md` with Verified / Partial / Missing / Deferred / Docs need correction as evidence accumulates
- for multi-user checks, use named test accounts and record exactly which user saw what

## Suggested immediate next step

Start **Wave 2A** with:

- Dashboard
- Planting Calendar
- Garden Snapshot

Those three together are the best next integration cluster and should expose both user-journey gaps and cross-module consistency problems quickly.
