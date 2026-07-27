"""
Admin backup helpers.

Creates portable ZIP archives containing a consistent SQLite database snapshot,
uploaded files, and a manifest describing the backup contents.
"""
import json
import os
import sqlite3
import tempfile
import zipfile
from datetime import datetime
from pathlib import Path

from flask import current_app


BACKUP_FORMAT_VERSION = 1
BACKUP_PREFIX = 'homestead-backup-'
BACKUP_SUFFIX = '.zip'


class BackupError(Exception):
    """Raised for expected backup validation failures."""


def get_backup_dir():
    """Return the configured backup directory, creating it if needed."""
    configured = current_app.config.get('BACKUP_FOLDER')
    backup_dir = Path(configured) if configured else Path(current_app.instance_path) / 'backups'
    backup_dir.mkdir(parents=True, exist_ok=True)
    return backup_dir


def resolve_backup_path(backup_id):
    """Resolve a backup id to a file path without allowing path traversal."""
    if not backup_id or backup_id != os.path.basename(backup_id):
        raise BackupError('Invalid backup id')
    if not backup_id.startswith(BACKUP_PREFIX) or not backup_id.endswith(BACKUP_SUFFIX):
        raise BackupError('Invalid backup id')

    backup_dir = get_backup_dir().resolve()
    backup_path = (backup_dir / backup_id).resolve()
    if backup_dir not in backup_path.parents and backup_path != backup_dir:
        raise BackupError('Invalid backup id')
    if not backup_path.exists() or not backup_path.is_file():
        raise BackupError('Backup not found')
    return backup_path


def list_backups():
    """List backup archive metadata newest first."""
    backups = []
    for backup_path in get_backup_dir().glob(f'{BACKUP_PREFIX}*{BACKUP_SUFFIX}'):
        if backup_path.is_file():
            backups.append(_backup_info(backup_path))
    backups.sort(key=lambda item: item.get('createdAt') or '', reverse=True)
    return backups


def create_backup():
    """Create a backup ZIP and return its metadata."""
    db_path = _resolve_sqlite_path()
    upload_dir = _resolve_upload_dir()
    created_at = datetime.utcnow().replace(microsecond=0).isoformat() + 'Z'
    stamp = datetime.utcnow().strftime('%Y%m%dT%H%M%SZ')
    backup_path = get_backup_dir() / f'{BACKUP_PREFIX}{stamp}{BACKUP_SUFFIX}'

    if backup_path.exists():
        stamp = datetime.utcnow().strftime('%Y%m%dT%H%M%S%fZ')
        backup_path = get_backup_dir() / f'{BACKUP_PREFIX}{stamp}{BACKUP_SUFFIX}'

    with tempfile.TemporaryDirectory(dir=str(get_backup_dir())) as temp_dir:
        temp_db_path = Path(temp_dir) / 'homestead.db'
        _copy_sqlite_database(db_path, temp_db_path)

        upload_stats = _collect_uploads(upload_dir)
        manifest = {
            'formatVersion': BACKUP_FORMAT_VERSION,
            'createdAt': created_at,
            'source': {
                'app': 'homestead-planner',
            },
            'database': {
                'path': 'database/homestead.db',
                'sourcePath': str(db_path),
                'sizeBytes': temp_db_path.stat().st_size,
                'migrationRevision': _read_migration_revision(temp_db_path),
            },
            'uploads': {
                'path': 'uploads/',
                'sourcePath': str(upload_dir) if upload_dir else None,
                'fileCount': upload_stats['fileCount'],
                'sizeBytes': upload_stats['sizeBytes'],
            },
        }

        with zipfile.ZipFile(backup_path, 'w', compression=zipfile.ZIP_DEFLATED) as archive:
            archive.write(temp_db_path, 'database/homestead.db')
            archive.writestr(
                'metadata/manifest.json',
                json.dumps(manifest, indent=2, sort_keys=True),
            )
            for file_path, arcname in upload_stats['files']:
                archive.write(file_path, arcname)

    return _backup_info(backup_path)


def delete_backup(backup_id):
    """Delete a backup archive."""
    backup_path = resolve_backup_path(backup_id)
    backup_path.unlink()


def _resolve_sqlite_path():
    uri = current_app.config.get('SQLALCHEMY_DATABASE_URI', '')
    if uri in ('sqlite:///:memory:', 'sqlite://'):
        raise BackupError('Backups require a file-based SQLite database')
    if not uri.startswith('sqlite:///'):
        raise BackupError('Only SQLite database backups are supported')

    db_path = uri[len('sqlite:///'):].split('?', 1)[0]
    if db_path == ':memory:':
        raise BackupError('Backups require a file-based SQLite database')

    # SQLAlchemy absolute Windows URIs may appear as /C:/path.
    if len(db_path) >= 3 and db_path[0] == '/' and db_path[2] == ':':
        db_path = db_path[1:]

    path = Path(db_path)
    if not path.is_absolute():
        path = Path(current_app.root_path) / path
    path = path.resolve()

    if not path.exists() or not path.is_file():
        raise BackupError('SQLite database file not found')
    return path


def _resolve_upload_dir():
    configured = current_app.config.get('UPLOAD_FOLDER', 'static/uploads')
    upload_dir = Path(configured)
    if not upload_dir.is_absolute():
        upload_dir = Path(current_app.root_path) / upload_dir
    upload_dir = upload_dir.resolve()
    return upload_dir if upload_dir.exists() and upload_dir.is_dir() else None


def _copy_sqlite_database(source_path, destination_path):
    source = sqlite3.connect(str(source_path))
    destination = sqlite3.connect(str(destination_path))
    try:
        source.backup(destination)
    finally:
        destination.close()
        source.close()


def _read_migration_revision(db_path):
    connection = sqlite3.connect(str(db_path))
    try:
        cursor = connection.execute('SELECT version_num FROM alembic_version LIMIT 1')
        row = cursor.fetchone()
        return row[0] if row else None
    except sqlite3.Error:
        return None
    finally:
        connection.close()


def _collect_uploads(upload_dir):
    files = []
    size_bytes = 0
    if upload_dir:
        for file_path in upload_dir.rglob('*'):
            if not file_path.is_file():
                continue
            relative = file_path.relative_to(upload_dir).as_posix()
            files.append((file_path, f'uploads/{relative}'))
            size_bytes += file_path.stat().st_size
    return {
        'files': files,
        'fileCount': len(files),
        'sizeBytes': size_bytes,
    }


def _backup_info(backup_path):
    manifest = _read_manifest(backup_path)
    stat = backup_path.stat()
    database = manifest.get('database', {}) if manifest else {}
    uploads = manifest.get('uploads', {}) if manifest else {}
    created_at = manifest.get('createdAt') if manifest else None
    if not created_at:
        created_at = datetime.utcfromtimestamp(stat.st_mtime).replace(microsecond=0).isoformat() + 'Z'

    return {
        'id': backup_path.name,
        'filename': backup_path.name,
        'createdAt': created_at,
        'sizeBytes': stat.st_size,
        'databaseBytes': database.get('sizeBytes'),
        'uploadFileCount': uploads.get('fileCount'),
        'uploadBytes': uploads.get('sizeBytes'),
        'migrationRevision': database.get('migrationRevision'),
        'formatVersion': manifest.get('formatVersion') if manifest else None,
    }


def _read_manifest(backup_path):
    try:
        with zipfile.ZipFile(backup_path, 'r') as archive:
            with archive.open('metadata/manifest.json') as manifest_file:
                return json.load(manifest_file)
    except (KeyError, OSError, json.JSONDecodeError, zipfile.BadZipFile):
        return {}
