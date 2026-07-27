import socket
import sqlite3

import app as app_module


def test_port_is_in_use_detects_bound_local_port():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as server:
        server.bind(('127.0.0.1', 0))
        server.listen(5)
        port = server.getsockname()[1]

        assert app_module._port_is_in_use('127.0.0.1', port) is True
        assert app_module._port_is_in_use('0.0.0.0', port) is True


def test_configure_sqlite_connection_sets_wal_and_busy_timeout(tmp_path):
    db_path = tmp_path / 'pragma-check.db'
    connection = sqlite3.connect(str(db_path))
    try:
        app_module._configure_sqlite_connection(connection, None)

        busy_timeout = connection.execute('PRAGMA busy_timeout').fetchone()[0]
        journal_mode = connection.execute('PRAGMA journal_mode').fetchone()[0].lower()

        assert busy_timeout == 5000
        assert journal_mode == 'wal'
    finally:
        connection.close()
