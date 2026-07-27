"""
Regression tests for the nutritional_data table bootstrap.

``nutritional_data`` is a raw-SQL table rather than a SQLAlchemy model, so
``db.create_all()`` does not create it. It was previously created only by a
one-off script (``migrations/custom/schema/add_nutritional_data_table.py``) with
a hardcoded path to ``instance/homestead.db``.

The consequence was that any database nobody had run that script against — a
fresh install, CI, the E2E database, and in fact the developer database itself —
answered ``POST /api/nutrition/estimate`` with a 500:

    sqlite3.OperationalError: no such table: nutritional_data

``app.initialize_database()`` now calls ``ensure_nutritional_data_table()``, so
every database gets the table. These tests guard that it stays created, stays
idempotent, and follows the configured database rather than a fixed path.
"""
import os
import sqlite3

import pytest

from services.nutritional_service import (
    ensure_nutritional_data_table,
    resolve_db_path,
    DEFAULT_DB_PATH,
)


def _tables(db_path):
    conn = sqlite3.connect(db_path)
    try:
        rows = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        ).fetchall()
        return {r[0] for r in rows}
    finally:
        conn.close()


def _columns(db_path, table):
    conn = sqlite3.connect(db_path)
    try:
        return {r[1] for r in conn.execute(f'PRAGMA table_info({table})')}
    finally:
        conn.close()


def test_creates_table_in_empty_database(tmp_path):
    db = tmp_path / 'fresh.db'
    assert 'nutritional_data' not in _tables(str(db))

    ensure_nutritional_data_table(str(db))

    assert 'nutritional_data' in _tables(str(db))


def test_is_idempotent(tmp_path):
    """Safe to call on every startup, including over an existing table."""
    db = tmp_path / 'twice.db'

    ensure_nutritional_data_table(str(db))
    conn = sqlite3.connect(str(db))
    conn.execute(
        "INSERT INTO nutritional_data (source_type, source_id, name, calories) "
        "VALUES ('plant', 'tomato-1', 'Tomato', 18)"
    )
    conn.commit()
    conn.close()

    ensure_nutritional_data_table(str(db))  # must not raise or wipe data

    conn = sqlite3.connect(str(db))
    try:
        count = conn.execute('SELECT COUNT(*) FROM nutritional_data').fetchone()[0]
    finally:
        conn.close()
    assert count == 1, 'existing rows must survive a repeat call'


def test_schema_has_the_columns_the_service_queries(tmp_path):
    db = tmp_path / 'schema.db'
    ensure_nutritional_data_table(str(db))

    cols = _columns(str(db), 'nutritional_data')

    # Queried by NutritionalService.get_nutritional_data and the estimate path.
    for required in (
        'source_type', 'source_id', 'name', 'user_id',
        'calories', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g',
        'average_yield_lbs_per_plant',
    ):
        assert required in cols, f'missing column: {required}'


def test_creates_indexes(tmp_path):
    db = tmp_path / 'idx.db'
    ensure_nutritional_data_table(str(db))

    conn = sqlite3.connect(str(db))
    try:
        idx = {
            r[0] for r in conn.execute(
                "SELECT name FROM sqlite_master WHERE type='index' "
                "AND tbl_name='nutritional_data'"
            )
        }
    finally:
        conn.close()

    assert 'idx_nutritional_data_source' in idx
    assert 'idx_nutritional_data_user' in idx


class TestDatabasePathResolution:
    """The service must follow the app's configured database.

    It opens its own sqlite3 connection, so without this it would read and
    write the developer's file even when the app is pointed somewhere else —
    silently mixing test or CI nutrition data into the dev database.
    """

    def test_follows_database_url(self, monkeypatch, tmp_path):
        target = tmp_path / 'configured.db'
        monkeypatch.setenv('DATABASE_URL', f'sqlite:///{target.as_posix()}')

        assert resolve_db_path() == target.as_posix()

    def test_falls_back_to_default_when_unset(self, monkeypatch):
        monkeypatch.delenv('DATABASE_URL', raising=False)

        assert resolve_db_path() == DEFAULT_DB_PATH

    def test_ignores_non_sqlite_urls(self, monkeypatch):
        """A Postgres URL has no file path — fall back rather than mangle it."""
        monkeypatch.setenv('DATABASE_URL', 'postgresql://user@host/db')

        assert resolve_db_path() == DEFAULT_DB_PATH
