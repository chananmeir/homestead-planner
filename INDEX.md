# Documentation Index

> Complete index of all documentation files in the Homestead Planner project.
> Last updated: 2026-02-07

---

## Table of Contents

1. [Root / Project Configuration](#root--project-configuration)
2. [Claude Code Configuration (.claude/)](#claude-code-configuration-claude)
3. [Backend Documentation](#backend-documentation)
4. [Frontend Documentation](#frontend-documentation)
5. [General Documentation (docs/)](#general-documentation-docs)
6. [Development Tasks - Active (dev/active/)](#development-tasks---active-devactive)
7. [Development Tasks - Completed (dev/completed/)](#development-tasks---completed-devcompleted)
8. [Development - Future Enhancements](#development---future-enhancements)
9. [Development - Templates & Meta](#development---templates--meta)
10. [Scripts & Tests](#scripts--tests)

---

## Root / Project Configuration

| File | Summary |
|------|---------|
| `README.md` | Project overview and setup instructions for the full-stack app (Flask backend port 5000, React/TypeScript frontend port 3000), including environment configuration and tech stack. |
| `CLAUDE.md` | Comprehensive Claude Code guardrails: non-negotiable constraints (database migrations, space calculation sync, API contracts, NULL handling), high-risk areas, common AI mistakes, and verification checklists. |
| `AGENTS.md` | Auto-generated repository guidelines for AI agents covering project structure, build/test commands, coding style, testing, commit/PR expectations, and security tips. |

---

## Claude Code Configuration (.claude/)

### Agents

| File | Summary |
|------|---------|
| `.claude/agents/README.md` | Overview of 4 available Claude Code agents (project-manager, auto-error-resolver, code-architecture-reviewer, documentation-architect) with usage instructions. |
| `.claude/agents/auto-error-resolver.md` | Agent for systematically identifying, prioritizing, and fixing TypeScript and Python compilation errors with common error patterns and fix strategies. |
| `.claude/agents/code-architecture-reviewer.md` | Agent for deep architectural reviews covering layer separation, pattern consistency, design quality, and security with structured scoring. |
| `.claude/agents/documentation-architect.md` | Agent for creating comprehensive documentation (API endpoints, features, system architecture) with templates and quality standards. |
| `.claude/agents/project-manager.md` | Orchestrator agent that analyzes requests, determines scope, selects skills/agents, creates execution plans, and coordinates end-to-end feature implementation. |

### Slash Commands

| File | Summary |
|------|---------|
| `.claude/commands/README.md` | Master reference for 7 available slash commands with usage patterns, workflow sequences, and custom command creation guidance. |
| `.claude/commands/build-check.md` | Runs Python syntax checks (backend) and TypeScript compilation (frontend), categorizes errors by severity, and offers to fix issues. |
| `.claude/commands/code-review.md` | Architectural code review against comprehensive checklist (routes, models, components, state, security, testing) for recently changed files. |
| `.claude/commands/dev-docs.md` | Researches codebase, creates strategic implementation plan, and generates three dev docs files (plan, context, tasks) in `dev/active/`. |
| `.claude/commands/dev-docs-continue.md` | Reads all three dev docs files for an active task, verifies file locations, presents state summary with progress percentage, and proposes next action. |
| `.claude/commands/dev-docs-start.md` | Initializes new dev docs directory from templates, then enters interactive planning mode for implementation plan creation. |
| `.claude/commands/dev-docs-update.md` | Updates all three dev docs files before context compaction, preserving current state, decisions, discoveries, and next steps. |
| `.claude/commands/project-manager.md` | Launches a manager agent orchestrating 4-8 parallel sub-agents for complex multi-area tasks with comprehensive final reporting. |

### Skills

| File | Summary |
|------|---------|
| `.claude/skills/README.md` | Overview of 3 available skills (backend-dev, frontend-dev, database guidelines) with auto-activation via hooks and manual activation syntax. |
| `.claude/skills/OPTIMIZATION_GUIDE.md` | Guide for splitting skills into main + resource files when exceeding 500 lines for 40-60% token efficiency improvement. |
| `.claude/skills/backend-dev-guidelines/SKILL.md` | Flask/Python best practices: SQLAlchemy patterns, RESTful handlers, migration workflows, ISO date parsing, input validation, and testing. |
| `.claude/skills/database-guidelines/SKILL.md` | Database operations guide: migration workflow, SQLAlchemy relationships (one-to-many, many-to-many, cascade), query patterns, and transaction management. |
| `.claude/skills/frontend-dev-guidelines/SKILL.md` | React/TypeScript best practices: functional components, type definitions, API integration, Tailwind CSS, state management, form handling, and date formatting. |
| `.claude/skills/skill-developer/SKILL.md` | Meta-skill for creating new Claude Code skills with SKILL.md template, skill-rules.json config, and domain-specific examples. |

### Other .claude/ Files

| File | Summary |
|------|---------|
| `.claude/GITHUB_REPO_ANALYSIS.md` | Comparison of project infrastructure against the claude-code-infrastructure-showcase repo; concludes 95%+ feature parity. |
| `.claude/hooks/README.md` | Documentation for 3 TypeScript hooks (user-prompt-submit, stop, post-tool-use) with configuration via skill-rules.json. |
| `.claude/REDDIT_POST_COMPARISON.md` | Feature comparison against Reddit recommendations for Claude Code setup; concludes 95% parity with better documentation. |
| `.claude/SETUP_COMPLETE.md` | Setup completion summary with quick-start instructions, testing prompts, expected benefits, and customization guidance. |

---

## Backend Documentation

### Core

| File | Summary |
|------|---------|
| `backend/README.md` | Project overview and quick-start for the Flask/SQLite app covering features, API endpoints, database models, and SaaS deployment roadmap. |
| `backend/SETUP_MIGRATIONS.md` | Beginner-friendly guide to Flask-Migrate setup, daily pull workflow, production deployment, troubleshooting, and command reference. |
| `backend/MIGRATIONS.md` | Documents the 3 migration systems (Flask-Migrate/Alembic, custom scripts, AST-based plant DB updates) with recent changelog entries. |
| `backend/MIGRATION_GUIDE.md` | When to use custom migration scripts vs AST-based updates vs Flask-Migrate; full API reference for `PlantDatabaseUpdater`. |
| `backend/REFACTORING_SUMMARY.md` | Architectural overview of the blueprint refactoring: before/after structure, service layer, import dependency rules, and 13-blueprint breakdown. |

### Blueprints

| File | Summary |
|------|---------|
| `backend/BLUEPRINT_INTEGRATION_SUCCESS.md` | Completion report for Flask blueprint refactoring: 6 phases, 13 active blueprints, test results (14/16 passed), rollback procedures. |
| `backend/BLUEPRINT_MIGRATION_GUIDE.md` | Step-by-step plan for transitioning from monolithic 4,809-line `app.py` to 13 Flask blueprints across 6 phases. |
| `backend/BLUEPRINT_QUICK_REFERENCE.md` | Developer reference card for blueprint architecture: request routing, file locations, adding/modifying routes, troubleshooting. |
| `backend/blueprints/EXTRACTION_SUMMARY.md` | Documents extraction of 14 garden routes from `app.py` into `gardens_bp.py` with route listing, dependencies, and auth requirements. |
| `backend/blueprints/INTEGRATION_GUIDE.md` | Step-by-step instructions for integrating `gardens_bp` with specific route functions to remove from `app.py` (with line numbers). |

### Data & Features

| File | Summary |
|------|---------|
| `backend/FAMILY_FIELD_ADDITION_SUMMARY.md` | Addition of `family` (botanical family) field to all 111 plants, listing distribution across 29 botanical families. |
| `backend/ORPHANED_SEEDS_TOOLS_README.md` | Guide for diagnosing/fixing orphaned SeedInventory records with diagnostic scripts and prevention mechanisms. |
| `backend/data/BREED_DATA_SOURCES.md` | Sourcing documentation for all livestock breed production data (24 chicken, 14 duck, 12 goat breeds) with verified hatchery citations. |
| `backend/data/varieties/README.md` | CSV import format for bulk-importing plant varieties: required/optional columns, crop type mappings, validation rules. |

### Migrations

| File | Summary |
|------|---------|
| `backend/migrations/custom/INDEX.md` | Quick-reference index of all 51 custom migration scripts (29 schema, 22 data) organized by target table. |
| `backend/migrations/custom/README.md` | Custom migration directory structure (`schema/` and `data/`), path-injection import pattern, and running instructions. |

---

## Frontend Documentation

| File | Summary |
|------|---------|
| `frontend/README.md` | Features overview (garden planner, planting calendar, weather alerts, compost tracker), tech stack, setup instructions, and plant database overview. |
| `frontend/DRAG_DROP_TEST_REPORT.md` | Playwright E2E test report for drag-drop; found one critical issue where original plant opacity stays at 1 during drag. |
| `frontend/public/plant-icons/README.md` | Naming convention (`{plant-id}.png`), image specs (40x40 PNG transparent), and emoji fallback behavior for custom plant icons. |
| `frontend/public/plant-icons/PLANT_IDS_CHECKLIST.md` | Checklist of all 111 plant IDs needing custom PNG icons; currently 0/111 created with instructions for adding new icons. |

---

## General Documentation (docs/)

### Getting Started

| File | Summary |
|------|---------|
| `docs/README.md` | Table of contents for the docs directory listing feature plans, setup guides, session summaries, and analysis output. |
| `docs/START_HERE.md` | Onboarding guide for Claude Code users: how to use agents, skills, and copy-paste prompts as alternatives to slash commands. |
| `docs/STARTUP.md` | Guide for Windows batch scripts (start-app.bat, start-backend.bat, start-frontend.bat) with troubleshooting tips. |
| `docs/QUICK_START.md` | Step-by-step workflows for building features using Claude Code: planning with /dev-docs, error checking, and code review. |
| `docs/HOW_TO_USE_SLASH_COMMANDS.md` | Reference for 4 custom slash commands with usage examples and a complete workflow walkthrough. |
| `docs/ALTERNATIVE_WORKFLOWS.md` | Copy-paste prompt alternatives for each slash command when slash commands are not working. |
| `docs/DIRECTORY_ORGANIZATION.md` | Project directory structure explaining the purpose of each top-level folder and organization rules. |

### Feature Documentation

| File | Summary |
|------|---------|
| `docs/AUTHENTICATION_PROTECTION_PLAN.md` | 5-phase plan (all complete) for multi-user authentication: database migration, backend API protection, frontend guards, and testing. |
| `docs/GARDEN_SNAPSHOT_FEATURE.md` | Point-in-time inventory view showing active plants across all beds on a chosen date, with summary cards and expandable per-bed breakdown. |
| `docs/CLICKABLE_DATE_FEATURE.md` | Feature making "waiting X more days" text in cold danger warnings clickable to auto-advance planting date. |
| `docs/COLLISION_DETECTION_TEST_PLAN.md` | Manual test plan with 8 scenarios for structure collision detection in Property Designer. |
| `docs/COMMERCIALIZATION_ROADMAP.md` | 5-phase roadmap for SaaS conversion: authentication, PostgreSQL, infrastructure, Stripe payments, legal, marketing, costs. |
| `docs/GRID_LABEL_FIX.md` | Fix for grid labels displaying garbled characters beyond column Z in large beds; uses coordinateToGridLabel() utility. |
| `docs/MULTI_SQUARE_PLANT_PLACEMENT_IMPLEMENTATION.md` | Auto multi-square plant placement logic calculating grid cells from spacing and quantity, creating compact PlantedItem patterns. |
| `docs/MULTI_USER_SEED_INVENTORY_PLAN.md` | 6-phase plan for multi-user seed system with global admin catalog and per-user personal inventories. |
| `docs/PLANT_DRAG_DROP_FIX_REPORT.md` | Root cause analysis for plants not sticking on drag: silent validation failures fixed by adding toast error notifications. |
| `docs/PLANT_ICONS_GUIDE.md` | Custom plant icon system loading PNGs from `/plant-icons/` with automatic emoji fallback, specs, and troubleshooting. |

### Session Summaries

| File | Summary |
|------|---------|
| `docs/SESSION_SUMMARY_2025-11-17.md` | 5 UX improvements: quantity badge repositioning, contrast, code refactoring, badge background removal, variety dropdown bug fix. |
| `docs/SESSION_SUMMARY_2025-11-17_PLANT_EXPANSION.md` | Plant database expansion from 52 to 67 plants (+29%) and CSV types from 25 to 40 (+60%); added herbs, vegetables, berries. |
| `docs/SESSION_SUMMARY_2025-11-18_TIMELINE_INTEGRATION.md` | Year-based crop filtering fixes, auto-creation of PlantingEvents on drop, and season/weather warning validation. |

### Guides

| File | Summary |
|------|---------|
| `docs/guides/BREED_SELECTION_GUIDE.md` | User-facing guide for livestock breed dropdown with production rates and age-based adjustment calculations. |
| `docs/guides/MIGARDENER_TESTING.md` | Manual testing plan with 10 scenarios for MIGardener row-based seed density feature verification. |
| `docs/guides/STRUCTURE_ICONS_NEEDED.md` | Prioritized list of 70 PNG icons needed for Property Designer structures in 3 priority tiers with specs. |
| `docs/guides/USDA_API_QUICKSTART.md` | 5-minute setup guide for USDA FoodData Central API: key signup, .env config, testing, and bulk import. |

### Competitive Analysis

| File | Summary |
|------|---------|
| `docs/analysis-output/COMPLETE_SEEDTIME_ANALYSIS.md` | Full competitive analysis of SeedTime vs Homestead Planner: 10 feature modules, gap analysis, strategic roadmap. |
| `docs/analysis-output/SEEDTIME_ANALYSIS.md` | Brief initial analysis of SeedTime's public landing page with potential enhancement ideas. |
| `docs/analysis-output/authenticated/SEEDTIME_AUTHENTICATED_ANALYSIS.md` | Raw data capture from authenticated SeedTime session showing navigation structure and features. |
| `docs/analysis-output/smartgardener/COMPARISON_WITH_HOMESTEAD.md` | Feature comparison noting Homestead Planner advantages in drag-drop, collision detection, and property planning. |
| `docs/analysis-output/smartgardener/SMARTGARDENER_ANALYSIS.md` | Automated analysis of SmartGardener.com capturing 8 pages with layout tool observations. |

### References

| File | Summary |
|------|---------|
| `docs/references/COMPATIBILITY_LOGIC_DOCUMENTATION.md` | Authoritative docs for bed-plant sun compatibility logic: matrix (full/partial/shade), single-source-of-truth function, and permissive unknown handling. |
| `docs/references/MIGARDENER_REFERENCE.md` | Complete reference for 50+ MIGardener planting configurations by style (broadcast, row, plant-spacing) with spacing params and seed densities. |

### Implementation Summaries

| File | Summary |
|------|---------|
| `docs/implementation-summaries/BREED_DROPDOWN_UPDATE.md` | Changed from free-text breed input to dropdown with production rates for chickens, ducks, and goats. |
| `docs/implementation-summaries/BREED_PRODUCTION_IMPLEMENTATION_SUMMARY.md` | Breed-specific production rates and age-based adjustments for livestock nutrition, replacing hardcoded values with 50-breed JSON DB. |
| `docs/implementation-summaries/BREED_PRODUCTION_UPDATE_SUMMARY.md` | Updated chicken breed production data from mixed sources to verified hatchery data using midpoint methodology. |
| `docs/implementation-summaries/COMPATIBILITY_LOGIC_FIX_SUMMARY.md` | Fixed duplicated sun compatibility logic; all checks now go through single `checkBedSunCompatibility()` function. |
| `docs/implementation-summaries/COMPLETE_BREED_UPDATE_SUMMARY.md` | Complete livestock breed database update: 24 chickens, 16 ducks, 10 goats (50 total), 10 new breeds added. |
| `docs/implementation-summaries/CROP_YIELD_UPDATES_2026-01-26.md` | Corrected 20/30 baseline crop yields; fixed root vegetables using multi-plant values instead of per-plant. |
| `docs/implementation-summaries/DEBUG_TOGGLE_IMPLEMENTATION.md` | localStorage-based DEBUG_SEASON_PLANNER toggle for runtime diagnostics without rebuild. |
| `docs/implementation-summaries/DIAGNOSTIC_IMPLEMENTATION_SUMMARY.md` | Diagnostic work for "No Compatible Beds" error: orphaned seeds prevention and Season Planner debug logging. |
| `docs/implementation-summaries/FINAL_COMPATIBILITY_FIX.md` | Removed all duplicate bed filtering logic; single source of truth via `checkBedSunCompatibility()`. |
| `docs/implementation-summaries/LIVESTOCK_NUTRITION_FIX_SUMMARY.md` | Fixed livestock calorie calculations 4.5x too high due to inconsistent units (per-100g vs per-unit). |
| `docs/implementation-summaries/MIGARDENER_IMPLEMENTATION_SUMMARY.md` | Implemented all 30 MIGardener reference crops with frontend plantDatabase.ts and backend migardener_spacing.py entries. |
| `docs/implementation-summaries/MIGARDENER_LETTUCE_FIX_SUMMARY.md` | Fixed MIGardener lettuce space calculation treating seeds as individual plants instead of seed density (36/sqft). |
| `docs/implementation-summaries/NAVIGATION_BUG_FIX_VERIFICATION.md` | Plant icon navigation bug fix: key prop additions and PlantIconSVG state tracking improvements. |
| `docs/implementation-summaries/NUTRITION_DASHBOARD_FIX_SUMMARY.md` | Fixed NutritionalDashboard runtime error from incorrect `by_source` field structure in API response. |
| `docs/implementation-summaries/NUTRITION_DISPLAY_IMPLEMENTATION.md` | Expected nutritional output display in Garden Season Planner with new backend endpoint and frontend panel. |
| `docs/implementation-summaries/NUTRITION_FIX_SUMMARY.md` | Fixed "Nutrition estimates unavailable" caused by mismatched plant IDs (variety-suffixed vs base) in lookups. |
| `docs/implementation-summaries/ORPHANED_SEEDS_PREVENTION_IMPLEMENTATION.md` | Investigation and prevention of seeds with invalid plant_ids; validation added at all seed creation entry points. |
| `docs/implementation-summaries/PER_BED_ALLOCATION_IMPLEMENTATION.md` | Per-bed selection and space tracking in Garden Season Planner with real-time usage and rotation warnings. |
| `docs/implementation-summaries/PHASE1_NUTRITION_IMPLEMENTATION_SUMMARY.md` | Phase 1 MVP nutritional tracking: nutritional_data table, NutritionalService, admin UI with 30 baseline crops. |
| `docs/implementation-summaries/PHASE2_USDA_INTEGRATION_SUMMARY.md` | Phase 2 USDA API integration: search 170,000+ foods in FoodData Central with one-click nutritional import. |
| `docs/implementation-summaries/PHASE3_LIVESTOCK_TREE_NUTRITION_SUMMARY.md` | Phase 3 nutritional tracking extended to livestock (eggs, milk, honey, meat) and fruit/nut trees with aggregated dashboard. |
| `docs/implementation-summaries/PLANT_ICON_NAVIGATION_BUG_FIX.md` | Fixed plant icons reverting from PNGs to emojis when navigating between Garden Designer and Property Designer. |
| `docs/implementation-summaries/PLANTING_STYLE_SEPARATION_IMPLEMENTATION.md` | Decoupled planting style from planning method, enabling any style (grid, row, broadcast, etc.) in any bed type. |
| `docs/implementation-summaries/PLANTING_SUGGESTIONS_FIX_SUMMARY.md` | Fixed planting suggestions disappearing after blueprint refactoring; two validation API endpoints were accidentally deleted. |
| `docs/implementation-summaries/SEASON_PLANNER_DEBUG_IMPLEMENTATION.md` | Targeted debugging for "No Compatible Beds Available" errors; confirmed root cause is bed configuration issues. |
| `docs/implementation-summaries/SUN_EXPOSURE_VALIDATION_IMPLEMENTATION.md` | Sun exposure compatibility filtering and inline warnings in Garden Season Planner bed selector. |
| `docs/implementation-summaries/TESTING_ICON_SIMPLIFICATION.md` | Testing plan for removing icon toggle system; simplified to PNG-first with automatic emoji fallback. |
| `docs/implementation-summaries/TRELLIS_UX_ENHANCEMENT_SUMMARY.md` | Replaced feet-based trellis coordinates with A1/B2 grid labels and added 7 position presets for common configurations. |

---

## Development Tasks - Active (dev/active/)

> 29 active task initiatives. Each folder contains context.md, plan.md, and tasks.md.

| Task | Summary |
|------|---------|
| `address-validation-phase1/` | Address geocoding via Geocodio/Google Maps with USDA zone detection from lat/long. ~90% complete. |
| `authentication-phase4/` | Frontend auth guards for all 7 tabs using LoginRequiredMessage component with WCAG accessibility. |
| `authentication-phase5/` | Auth system testing/verification. 13/13 backend tests passed. Fixed missing `credentials: 'include'` in 19 fetch calls. |
| `claude-md-compliance-audit/` | Codebase audit against CLAUDE.md rules. Found partial compliance on date handling (uses `.replace('Z',...)` instead of `parse_iso_date`). |
| `csv-bulk-import-expansion/` | Expanding CSV seed import from lettuce-only to 14 crop types with variety-to-plant-id mapping. |
| `csv-plant-data-integration/` | Importing 16K-variety CSV (7.1 MB) into seed_inventory as global catalog entries with multi-season DTM parsing. |
| `duplicate-detection-bug/` | Investigation concluded NO BUG exists; all 54 CSV lettuce varieties already existed as global entries. |
| `editable-grid-coordinates/` | Adding human-readable grid labels (A1, B2) to PlantConfigModal with validation and error messages. |
| `emoji-and-image-system-analysis/` | Documents three-tier icon system (emoji always available, PNG for 87/111 plants, SVG context layer). |
| `garden-designer-plant-analysis/` | Comprehensive 796-line analysis of 5 plant placement methods; found 1 critical duplicate placement bug. |
| `garden-planner-edit-continue/` | Edit/duplicate functionality for saved garden plans: reconstructing wizard state from saved plan data. |
| `indoor-seed-starts-reset-bug/` | Orphaned IndoorSeedStart records persist when clearing beds due to no CASCADE DELETE on FK. |
| `move-trees-to-property-designer/` | 33 tree varieties in backend but NOT in any UI; plan to add "Trees & Shrubs" palette to PropertyDesigner. |
| `nutrition-pipeline-unification/` | Documents 3 inconsistent nutrition calculation paths that need unification. |
| `phase2-crud-operations/` | CRUD modals for SeedInventory, Livestock, and HarvestTracker with form validation and toast notifications. |
| `phase4-advanced-filtering/` | COMPLETED: Client-side filtering/sorting with SearchBar, SortDropdown, FilterBar, DateRangePicker across 4 views. |
| `plant-database-consolidation/` | Plan to consolidate 48+ variety entries down to ~14 base plant entries. 20% complete. |
| `plant-id-reconciliation/` | Frontend has 56 plants, backend has 112; 46 missing from frontend, 22 exist in frontend only. Needs sync. |
| `plant-palette-png-persistence/` | IconPreferenceContext with localStorage persistence and toggle button. Implementation complete, needs testing. |
| `plant-palette-symbols-investigation/` | Documents validation symbol system: yellow warning (frost/cold), green checkmark (good), blue info (marginal). |
| `planting-date-warnings/` | Phases 1-3 complete: validation API, optimal date suggestions, batch palette indicators. Phase 4 deferred. |
| `planting-suggestions-regression-fix/` | Green "Planting Options" box disappeared due to `warnings.length > 0` condition blocking suggestion rendering. |
| `project-health-analysis/` | Codebase health: app.py is 4734 lines, 123 console.logs, 20+ active tasks, React 19.2.0, TypeScript clean. |
| `property-designer-drag-drop/` | COMPLETED: Structures palette moved to left sidebar, @dnd-kit drag-drop, coordinate conversion, boundary validation. |
| `seed-catalog-search-analysis/` | Documents full-stack seed catalog: server-side search, client-side filters, pagination (100/page), CSV export. |
| `seed-planning-ui-improvements/` | Widened layout, assigned-beds chips, incompatible beds disabled with reasons, per-seed bed filter dropdown. |
| `seed-transplant-date-fix/` | Bug where `calculatePlantingDates()` always uses transplantDate regardless of planting method. |
| `too-hot-warnings/` | Implementation complete: "Too hot" warnings for 21 cool-weather crops when soil exceeds threshold. |
| `tree-placement/` | 3-phase plan: MVP tree placement on Property Designer, multi-year timeline, grouped orchard beds. |

---

## Development Tasks - Completed (dev/completed/)

> 39 completed task initiatives.

| Task | Summary |
|------|---------|
| `add-harvest-edit/` | Added PUT endpoint and EditHarvestModal for editing existing harvest records. |
| `api-url-refactoring/` | Replaced 39 hardcoded `localhost:5000` URLs across 14 files with centralized `config.ts` using env vars. |
| `clear-bed-functionality/` | Date-aware "Clear Bed" supporting clearing plants on a selected date and nuclear reset of all bed history. |
| `code-review-fixes/` | Fixed code quality issues from Open-Meteo integration: logging, cache location, constants, error messages. |
| `create-startup-scripts/` | Windows .bat startup scripts for backend (Flask) and frontend (React) with error handling. |
| `enhanced-planting-calendar/` | Calendar grid view, crops sidebar, AddCropModal with variety/succession support, list/grid view toggle. |
| `enhanced-planting-calendar-fixes/` | Fixed 6 issues: date validation, error boundaries, API integration for frost dates/beds/events, shared date utility. |
| `eslint-cleanup/` | Cleaned ESLint warnings across 8 files: unused variables, hook dependency arrays, useCallback wrapping. |
| `fix-frontend-backend-parity/` | Added missing frontend components (Livestock, HarvestTracker, SeedInventory, etc.) to match backend features. |
| `fix-plant-varieties-bug/` | Removed undefined PLANT_VARIETIES reference causing NameError in /planting-calendar route. |
| `fruit-and-nut-trees-expansion/` | Added 14 trees (9 fruit, 5 nut) to plant database; expanded from 72 to 86 plants, introduced 'nut' category. |
| `garden-bed-duplicate-placement-fix/` | Fixed duplicate plant creation where batch placement + onSave both triggered POSTs; added `skipPost` flag. |
| `garden-bed-planting-calculation-fix/` | Investigated lettuce showing 5 squares instead of 4; analyzed plantsPerSquare and numSquares logic. |
| `garden-beds-property-integration/` | Garden beds created in Garden Designer appear as placeable structures in Property Designer. |
| `garden-planner-wizard-simplification/` | Simplified wizard from 3 steps to 2 by removing redundant "Configure Strategy" step. |
| `garden-quantity-label-positioning/` | Repositioned plant quantity badges to top-right corner of SVG cells with adjusted sizing. |
| `herbs-csv-import/` | Added 9 herb type mappings, 9 crop type options in frontend, and sample herbs.csv with 24 varieties. |
| `indoor-seed-starting-integration/` | Integration between Indoor Seed Starts and Planting Calendar with auto-calculated start dates. |
| `migardener-analysis/` | Comprehensive analysis of MIGardener method: architecture, data flow, 13 crop spacing values, known limitations. |
| `migardener-calculation-fix/` | Fixed missing backend MIGardener calculation logic and corrected radish spacing from [6,2] to [4,1]. |
| `my-seed-inventory/` | Dual-view seed system: personal "My Seeds" + global "Seed Catalog" with admin CSV import and multi-user isolation. |
| `plant-palette-sorting/` | Added alphabetical A-Z sorting to PlantPalette using localeCompare(). |
| `plant-palette-variety-fix/` | Frontend plant deduplication showing one entry per crop type; variety selection in PlantConfigModal after drag-drop. |
| `property-designer-button-fix/` | Created PropertyFormModal with all 8 property fields and wired "Create Property" button. |
| `property-designer-grid-enhancements/` | Multi-level grid (1ft/10ft/50ft), ruler edges, scale legend, snap-to-grid, real-time coordinates, grid toggle. |
| `resize-handles/` | 4-corner resize handles with grid snapping, real-time dimension tooltip, ellipse support, backend persistence. |
| `seed-filtering-feature/` | Custom range filters for DTM and soil temp with overlap logic, plus variety/type filter in FilterBar. |
| `seed-import-fix/` | Fixed CSV import with case-insensitive type mapping; successfully imported 53 lettuce varieties. |
| `sfg-spacing-audit/` | Audited/corrected SFG spacing values against official Square Foot Gardening rules; updated 8 plants. |
| `soil-temperature-feature/` | Soil temp estimation with air-to-soil model, WeatherAPI.com integration, 3-tier readiness indicators. |
| `succession-planting-bug-fix/` | Fixed React state race condition creating only 1 event instead of N; replaced with batch Promise.all(). |
| `timeline-garden-integration/` | Timeline integrated with Garden Designer via date filtering, URL state, PlantingEvent position matching. |
| `timeline-planting-feature/` | Complete 7-phase timeline planting: Gantt chart, position tracking, conflict detection, succession wizard. |
| `variety-dropdown-feature/` | Created /api/seeds/varieties endpoint and progressive disclosure UI (dropdown if varieties exist, text fallback). |
| `variety-selection-options/` | Analyzed variety support gaps in Garden Designer; documented existing Planting Calendar patterns to reuse. |
| `visual-planting-system/` | Visual drag-drop planting with emoji icons, PlantPalette, @dnd-kit, spacing validation, zoom, clear/delete. |
| `weather-soil-temp-validation/` | Enhanced validation with daily historical averages, zipcode location, auth fixes across 13+ endpoints. |
| `permaculture-quantity-fix/` | Added spacing-based quantity calculation for permaculture beds using `(12/spacing)²` and amber overcapacity warning for all dual-input methods. |
| `year-filtering-fix/` | Fixed frontend not passing date params to planting events API and date string vs Date comparison bugs. |

---

## Development - Future Enhancements

| File | Summary |
|------|---------|
| `dev/future-enhancements/trellis-zoning-system.md` | Trellis zoning Phases 1-4 implemented (CRUD, visualization, allocation, placement); Phases 5+ (capacity warnings, scheduling) are future. |
| `dev/future-enhancements/property-dimensions-auto-fill/README.md` | Deferred feature: auto-fill property dimensions via Regrid Parcel API ($0.001/req); ~8-10 hours, U.S./Canada only. |
| `dev/future-enhancements/property-dimensions-auto-fill/research-findings.md` | API comparison: Regrid (recommended), Estated ($179/mo), ATTOM (enterprise), Geocodio/Google (no parcel data). |

---

## Development - Templates & Meta

| File | Summary |
|------|---------|
| `dev/README.md` | Guide to the dev docs system: three-file pattern (plan/context/tasks) and workflows for starting, continuing, completing tasks. |
| `dev/PROJECT_STATUS.md` | Project status snapshot from 2025-11-11: 19 database models, 50+ API endpoints, builds clean. |
| `dev/PROJECT_ARCHITECTURE.md` | Architecture overview: Flask backend, React/TypeScript frontend, SQLite, component patterns, data flow diagrams. |
| `dev/MANAGER_SESSION_SUMMARY.md` | Summary of initial project manager session: discovery, PLANT_VARIETIES bug fix, validation, and doc creation. |
| `dev/TESTING_CHECKLIST.md` | Manual testing checklist for PlantConfigModal, GardenPlanner, PlantingCalendar, SeedInventory, PropertyDesigner, and API. |
| `dev/DEV_DOCS_REVIEW_2026-01-19.md` | Cleanup review reducing active task directories from 44 to 22; archived 22 completed tasks. |
| `dev/templates/task-context-template.md` | Template for context.md files: key files, architectural decisions, technical context, discoveries. |
| `dev/templates/task-plan-template.md` | Template for plan.md files: summary, background, objectives, phased implementation, risk assessment. |
| `dev/templates/task-tasks-template.md` | Template for tasks.md files: checklist organized into pre-implementation, backend, frontend, integration, QA phases. |

---

## Scripts & Tests

| File | Summary |
|------|---------|
| `scripts/README.md` | Utility scripts for auth fixes, ESLint cleanup, CSV mapping updates, and patches; most are one-off scripts. |
| `tests/README.md` | Test scripts for backend import, seed import, and search logic; recommends moving to proper test frameworks. |
