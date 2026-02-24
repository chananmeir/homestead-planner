# E2E Tests

## Prerequisites
Both servers must be running:
- Backend: `cd backend && python app.py` (port 5000)
- Frontend: `cd frontend && npm start` (port 3000)

## Setup
```bash
npx playwright install
```

## Run Tests
```bash
npx playwright test                  # All E2E tests (headed locally, headless in CI)
npx playwright test e2e-core         # Core 3 tests only
npx playwright test --headed         # Force headed mode
CI=true npx playwright test          # Force CI mode (headless, no slowMo)
```

## Test Reports
```bash
npx playwright show-report
```

## Test Suites

| Suite | File | Tests | Description |
|-------|------|-------|-------------|
| Smoke | `tests/smoke.spec.ts` | 10 | Navigation, login/logout, bed creation |
| Auth Isolation | `tests/auth-isolation.spec.ts` | varies | Multi-user data isolation |
| Core E2E | `tests/e2e-core.spec.ts` | 3 | Critical user journeys (serial) |

### Core E2E Tests
- **E2E-01**: Login + Create Bed + Place Plant (UI + API hybrid)
- **E2E-02**: Conflict detection on same-cell placement (API-level)
- **E2E-03**: Create Plan + Export to Calendar + Verify events appear (API + UI)
