Proceed with option 1.

Please carve out only the geocoding cache / status-aware error-path work into a clean commit.

Do not sweep in:
- the USDA hardiness-zone refinement hunks in `backend/services/geocoding_service.py`
- the unrelated indoor-start or cancelled-at hunks in `backend/blueprints/utilities_bp.py`

Reason:
This geocoding overuse fix should remain independently reviewable and reversible.
The USDA zone work and the indoor-start work belong to separate commits/workstreams.

Use a clean commit for just this scope, something like:
`fix: Geocoding service add ZIP cache + status-aware error path`
