"""
Launch the backend against a disposable end-to-end test database.

WHY THIS EXISTS
---------------
The Playwright suite used to run against the developer's working database
(``instance/homestead.db``). That coupled the tests to whatever happened to be
in it, which produced three recurring classes of failure that look like product
bugs but are not:

* **Non-idempotent tests.** A suite that mutates shared state can only pass
  once — e.g. a test asserting "this user is not an admin" fails on every run
  after the one that promoted them.
* **Order- and data-dependent flakiness.** Assertions that match page text can
  resolve to a different number of elements depending on unrelated rows, so the
  same test passes or fails run to run.
* **Assertions that prove nothing.** "User B sees none of user A's beds" passes
  trivially when the query is broken *and* when the table is empty. Isolation
  tests in particular need a populated, known database to be meaningful.

Running against a database this script creates from scratch each time makes the
suite reproducible and lets it be run by anyone (or by CI) without first
arranging for the right local data.

WHAT IT DOES
------------
1. Points ``DATABASE_URL`` at a dedicated e2e database file, *before* importing
   ``app`` (``app.py`` reads that variable at import time).
2. Deletes any previous e2e database so every run starts from a known state.
3. Creates the schema and the bootstrap ``admin`` account
   (``initialize_database``), then populates the global seed catalog — reference
   data several specs assume exists.
4. Starts Flask.

Set ``E2E_KEEP_DB=1`` to reuse the existing database instead of recreating it,
which is useful when debugging a single failing spec.

The developer database is never touched.
"""
import os
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

E2E_DB_PATH = BACKEND_DIR / 'instance' / 'e2e.db'


def _truthy(name):
    return os.environ.get(name, '').strip().lower() in {'1', 'true', 'yes', 'on'}


def main():
    E2E_DB_PATH.parent.mkdir(parents=True, exist_ok=True)

    if _truthy('E2E_KEEP_DB'):
        print(f'[e2e] Reusing existing database: {E2E_DB_PATH}')
    elif E2E_DB_PATH.exists():
        E2E_DB_PATH.unlink()
        print(f'[e2e] Removed previous database: {E2E_DB_PATH}')

    # Must be set before importing app — app.py reads it at module scope.
    os.environ['DATABASE_URL'] = f'sqlite:///{E2E_DB_PATH.as_posix()}'

    # The suite drives the time machine (dashboard staleness specs), so the
    # opt-in simulation endpoints are enabled for this throwaway server only.
    os.environ.setdefault('HOMESTEAD_ENABLE_SIMULATION', 'true')

    host = os.environ.get('HOMESTEAD_BACKEND_HOST', '127.0.0.1')
    port = int(os.environ.get('HOMESTEAD_BACKEND_PORT', '5000'))

    from app import app, initialize_database

    initialize_database()  # schema + bootstrap admin/admin123

    # Reference data: the global seed catalog. Specs that browse the catalog,
    # clone from it, or check that shared entries stay visible to every user
    # need this to exist. Idempotent, so safe under E2E_KEEP_DB.
    sys.path.insert(0, str(BACKEND_DIR / 'migrations' / 'custom' / 'data'))
    from populate_seed_catalog import populate_catalog

    populate_catalog()

    # Baseline nutrition for ~30 common crops. Without it the nutrition
    # endpoints answer 200 but every total is zero, so the specs asserting on
    # calories/protein would be measuring nothing.
    from import_baseline_nutrition import main as import_baseline_nutrition

    import_baseline_nutrition()

    print(f'[e2e] Backend listening on http://{host}:{port} using {E2E_DB_PATH.name}')
    # No reloader: it would re-exec this module and wipe the database mid-run.
    app.run(debug=False, host=host, port=port, use_reloader=False)


if __name__ == '__main__':
    main()
