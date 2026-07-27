import React, { useCallback, useEffect, useState } from 'react';
import { API_BASE_URL } from '../../config';
import { Button, ConfirmDialog, useToast } from '../common';

interface BackupInfo {
  id: string;
  filename: string;
  createdAt: string;
  sizeBytes: number;
  databaseBytes?: number | null;
  uploadFileCount?: number | null;
  uploadBytes?: number | null;
  migrationRevision?: string | null;
  formatVersion?: number | null;
}

export const BackupManagement: React.FC = () => {
  const { showSuccess, showError } = useToast();
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BackupInfo | null>(null);

  const fetchBackups = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/backups`, {
        credentials: 'include',
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to load backups');
      }
      const data = await response.json();
      setBackups(data.backups || []);
    } catch (error) {
      console.error('Error loading backups:', error);
      showError(error instanceof Error ? error.message : 'Failed to load backups');
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    fetchBackups();
  }, [fetchBackups]);

  const createBackup = async () => {
    setCreating(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/backups`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create backup');
      }
      showSuccess(data.message || 'Backup created successfully');
      await fetchBackups();
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Failed to create backup');
    } finally {
      setCreating(false);
    }
  };

  const downloadBackup = async (backup: BackupInfo) => {
    setDownloadingId(backup.id);
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/admin/backups/${encodeURIComponent(backup.id)}/download`,
        { credentials: 'include' },
      );
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to download backup');
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = backup.filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Failed to download backup');
    } finally {
      setDownloadingId(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/admin/backups/${encodeURIComponent(deleteTarget.id)}`,
        {
          method: 'DELETE',
          credentials: 'include',
        },
      );
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to delete backup');
      }
      showSuccess('Backup deleted');
      setDeleteTarget(null);
      await fetchBackups();
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Failed to delete backup');
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Backups</h2>
          <p className="mt-1 text-sm text-gray-600 max-w-3xl">
            Create a ZIP archive of the SQLite database, uploaded photos, and a manifest with migration details.
          </p>
        </div>
        <Button
          variant="primary"
          onClick={createBackup}
          loading={creating}
          className="lg:self-start"
          data-testid="btn-create-backup"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v12m0 0l4-4m-4 4l-4-4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
          </svg>
          Create Backup
        </Button>
      </div>

      <div className="mt-5 border border-gray-200 rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading backups...</div>
        ) : backups.length === 0 ? (
          <div className="p-8 text-center">
            <div className="text-sm font-medium text-gray-900">No backups yet</div>
            <div className="mt-1 text-sm text-gray-500">Create one before major imports, migrations, or cleanup work.</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Size
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Photos
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Migration
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {backups.map((backup) => (
                  <tr key={backup.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-gray-900">{formatDateTime(backup.createdAt)}</div>
                      <div className="text-xs text-gray-500 font-mono">{backup.filename}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      <div>{formatBytes(backup.sizeBytes)}</div>
                      {backup.databaseBytes != null && (
                        <div className="text-xs text-gray-500">DB {formatBytes(backup.databaseBytes)}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      <div>{backup.uploadFileCount ?? 0} files</div>
                      {backup.uploadBytes != null && (
                        <div className="text-xs text-gray-500">{formatBytes(backup.uploadBytes)}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      <span className="font-mono text-xs">
                        {backup.migrationRevision || 'unknown'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <Button
                          variant="secondary"
                          size="small"
                          onClick={() => downloadBackup(backup)}
                          loading={downloadingId === backup.id}
                        >
                          Download
                        </Button>
                        <Button
                          variant="danger"
                          size="small"
                          onClick={() => setDeleteTarget(backup)}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={deleteTarget != null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Delete Backup"
        message={deleteTarget ? `Delete backup "${deleteTarget.filename}"?\n\nThis removes only the backup archive. It does not change current homestead data.` : ''}
        confirmText="Delete Backup"
        cancelText="Cancel"
        variant="danger"
      />
    </div>
  );
};

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatBytes(value?: number | null): string {
  if (value == null || value < 0) return 'unknown';
  if (value < 1024) return `${value} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let size = value / 1024;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(size >= 10 ? 1 : 2)} ${units[unitIndex]}`;
}

export default BackupManagement;
