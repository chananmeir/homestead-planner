import json
import sqlite3
import zipfile


def _make_sqlite_database(path):
    connection = sqlite3.connect(str(path))
    try:
        connection.execute('CREATE TABLE alembic_version (version_num VARCHAR(32) NOT NULL)')
        connection.execute("INSERT INTO alembic_version (version_num) VALUES ('test_revision')")
        connection.execute('CREATE TABLE sample_data (id INTEGER PRIMARY KEY, name TEXT)')
        connection.execute("INSERT INTO sample_data (name) VALUES ('backup smoke test')")
        connection.commit()
    finally:
        connection.close()


def _configure_backup_paths(app, tmp_path, monkeypatch):
    db_path = tmp_path / 'homestead.db'
    upload_dir = tmp_path / 'uploads'
    backup_dir = tmp_path / 'backups'

    _make_sqlite_database(db_path)
    upload_dir.mkdir()
    (upload_dir / 'garden-photo.txt').write_text('photo bytes', encoding='utf-8')

    monkeypatch.setitem(app.config, 'SQLALCHEMY_DATABASE_URI', f'sqlite:///{db_path}')
    monkeypatch.setitem(app.config, 'UPLOAD_FOLDER', str(upload_dir))
    monkeypatch.setitem(app.config, 'BACKUP_FOLDER', str(backup_dir))

    return db_path, upload_dir, backup_dir


def test_regular_user_cannot_access_admin_backups(auth_client_a):
    response = auth_client_a.get('/api/admin/backups')
    assert response.status_code == 403
    assert response.get_json()['error'] == 'Admin privileges required'


def test_admin_can_create_list_download_and_delete_backup(
    admin_client,
    full_app,
    tmp_path,
    monkeypatch,
):
    _, _, backup_dir = _configure_backup_paths(full_app, tmp_path, monkeypatch)

    create_response = admin_client.post('/api/admin/backups')
    assert create_response.status_code == 201, create_response.data
    created = create_response.get_json()['backup']
    assert created['filename'].startswith('homestead-backup-')
    assert created['filename'].endswith('.zip')
    assert created['migrationRevision'] == 'test_revision'
    assert created['uploadFileCount'] == 1

    backup_path = backup_dir / created['filename']
    assert backup_path.exists()

    with zipfile.ZipFile(backup_path, 'r') as archive:
        names = set(archive.namelist())
        assert 'database/homestead.db' in names
        assert 'metadata/manifest.json' in names
        assert 'uploads/garden-photo.txt' in names
        manifest = json.loads(archive.read('metadata/manifest.json').decode('utf-8'))
        assert manifest['formatVersion'] == 1
        assert manifest['database']['migrationRevision'] == 'test_revision'
        assert manifest['uploads']['fileCount'] == 1

    list_response = admin_client.get('/api/admin/backups')
    assert list_response.status_code == 200
    backups = list_response.get_json()['backups']
    assert [backup['id'] for backup in backups] == [created['id']]

    download_response = admin_client.get(f"/api/admin/backups/{created['id']}/download")
    assert download_response.status_code == 200
    assert download_response.mimetype == 'application/zip'
    assert download_response.headers['Content-Disposition'].startswith('attachment;')
    download_response.close()

    delete_response = admin_client.delete(f"/api/admin/backups/{created['id']}")
    assert delete_response.status_code == 204
    assert not backup_path.exists()

    final_list_response = admin_client.get('/api/admin/backups')
    assert final_list_response.status_code == 200
    assert final_list_response.get_json()['backups'] == []


def test_admin_backup_rejects_in_memory_sqlite(admin_client, full_app, tmp_path, monkeypatch):
    monkeypatch.setitem(full_app.config, 'SQLALCHEMY_DATABASE_URI', 'sqlite:///:memory:')
    monkeypatch.setitem(full_app.config, 'BACKUP_FOLDER', str(tmp_path / 'backups'))

    response = admin_client.post('/api/admin/backups')
    assert response.status_code == 400
    assert response.get_json()['error'] == 'Backups require a file-based SQLite database'
