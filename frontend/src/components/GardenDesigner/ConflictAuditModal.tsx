import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { apiGet, apiDelete, apiPut } from '../../utils/api';
import { AlertTriangle, CheckCircle, Trash2, Scissors } from 'lucide-react';
import { format, parseISO, differenceInDays, subDays } from 'date-fns';
import { coordinateToGridLabel } from './utils/gridCoordinates';
import { useToast } from '../common/Toast';

interface ConflictPair {
  gardenBedId: number;
  gardenBedName: string;
  position: { x: number; y: number };
  eventA: {
    id: number;
    plantName: string;
    variety?: string;
    startDate: string;
    endDate: string;
  };
  eventB: {
    id: number;
    plantName: string;
    variety?: string;
    startDate: string;
    endDate: string;
  };
}

interface ConflictAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ConflictAuditModal: React.FC<ConflictAuditModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [loading, setLoading] = useState(false);
  const [conflicts, setConflicts] = useState<ConflictPair[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [autoResolving, setAutoResolving] = useState(false);
  const [trimming, setTrimming] = useState(false);
  const { showSuccess, showError } = useToast();

  // Helper function to calculate overlap duration in days
  const calculateOverlapDays = (conflict: ConflictPair): number => {
    if (!conflict.eventA.startDate || !conflict.eventA.endDate ||
        !conflict.eventB.startDate || !conflict.eventB.endDate) {
      return 0;
    }

    const aStart = parseISO(conflict.eventA.startDate);
    const aEnd = parseISO(conflict.eventA.endDate);
    const bStart = parseISO(conflict.eventB.startDate);
    const bEnd = parseISO(conflict.eventB.endDate);

    // Find overlap start and end
    const overlapStart = aStart > bStart ? aStart : bStart;
    const overlapEnd = aEnd < bEnd ? aEnd : bEnd;

    // If no overlap (shouldn't happen, but check)
    if (overlapStart > overlapEnd) return 0;

    return differenceInDays(overlapEnd, overlapStart) + 1; // +1 to include both days
  };

  // Calculate statistics about conflicts
  const duplicateCropConflicts = conflicts.filter(
    c => c.eventA.plantName === c.eventB.plantName
  );
  const differentCropConflicts = conflicts.filter(
    c => c.eventA.plantName !== c.eventB.plantName
  );

  // All different crop conflicts (no size threshold - handle any overlap)
  const allDifferentCropConflicts = differentCropConflicts;

  useEffect(() => {
    if (isOpen) {
      fetchConflicts();
    }
  }, [isOpen]);

  const fetchConflicts = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiGet('/api/planting-events/audit-conflicts');

      if (response.ok) {
        const data = await response.json();
        setConflicts(data.conflicts);
      } else {
        setError('Failed to fetch conflicts');
      }
    } catch (err) {
      setError('Error fetching conflicts');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEvent = async (eventId: number, plantName: string, variety?: string) => {
    const displayName = variety ? `${plantName} (${variety})` : plantName;

    if (!window.confirm(`Delete ${displayName}? This will remove it from your garden.`)) {
      return;
    }

    setDeleting(eventId);
    try {
      const response = await apiDelete(`/api/planting-events/${eventId}`);

      if (response.ok) {
        showSuccess(`Deleted ${displayName}`);
        // Re-fetch conflicts to update the list
        await fetchConflicts();
      } else {
        showError(`Failed to delete ${displayName}`);
      }
    } catch (err) {
      showError(`Error deleting ${displayName}`);
      console.error(err);
    } finally {
      setDeleting(null);
    }
  };

  const handleAutoResolveDuplicates = async () => {
    const count = duplicateCropConflicts.length;

    if (count === 0) {
      showError('No duplicate crop conflicts to auto-resolve');
      return;
    }

    const confirmed = window.confirm(
      `Auto-resolve ${count} duplicate crop conflict${count > 1 ? 's' : ''}?\n\n` +
      `This will automatically delete one planting from each pair where both plantings are the same crop type.\n\n` +
      `For example: "Lettuce vs Lettuce" → delete one Lettuce\n\n` +
      `This cannot be undone. Continue?`
    );

    if (!confirmed) {
      return;
    }

    setAutoResolving(true);
    let successCount = 0;
    let failCount = 0;

    try {
      // Process duplicates - delete eventB (second one) for each
      for (const conflict of duplicateCropConflicts) {
        try {
          const response = await apiDelete(`/api/planting-events/${conflict.eventB.id}`);
          if (response.ok) {
            successCount++;
          } else {
            failCount++;
          }
        } catch (err) {
          failCount++;
          console.error(`Failed to delete event ${conflict.eventB.id}:`, err);
        }

        // Small delay to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Show results
      if (successCount > 0) {
        showSuccess(`Auto-resolved ${successCount} duplicate conflict${successCount > 1 ? 's' : ''}!`);
      }
      if (failCount > 0) {
        showError(`Failed to resolve ${failCount} conflict${failCount > 1 ? 's' : ''}`);
      }

      // Re-fetch to show remaining conflicts
      await fetchConflicts();
    } catch (err) {
      showError('Error during auto-resolve');
      console.error(err);
    } finally {
      setAutoResolving(false);
    }
  };

  const handleAutoResolveAllDifferentCrops = async () => {
    const count = allDifferentCropConflicts.length;

    if (count === 0) {
      showError('No different crop conflicts to auto-resolve');
      return;
    }

    const confirmed = window.confirm(
      `Auto-resolve ${count} different crop conflict${count > 1 ? 's' : ''}?\n\n` +
      `This will keep the FIRST planting and DELETE the LATER planting for ALL conflicts between different crops.\n\n` +
      `Example:\n` +
      `Lettuce: Mar 26 → May 25 (KEEP - planted first)\n` +
      `Pepper: May 17 → Jul 29 (DELETE - planted later)\n` +
      `Overlap: 8 days\n\n` +
      `Result: Pepper deleted, Lettuce kept\n\n` +
      `This will resolve conflicts of ANY overlap size.\n\n` +
      `Continue?`
    );

    if (!confirmed) {
      return;
    }

    setTrimming(true);
    let successCount = 0;
    let failCount = 0;

    try {
      for (const conflict of allDifferentCropConflicts) {
        try {
          // Determine which crop starts later
          const aStart = parseISO(conflict.eventA.startDate);
          const bStart = parseISO(conflict.eventB.startDate);
          const aEnd = parseISO(conflict.eventA.endDate);
          const bEnd = parseISO(conflict.eventB.endDate);

          let laterEvent;

          // The later crop is the one that STARTS later
          // (if both start same day, delete the one that ends later)
          if (bStart > aStart || (aStart.getTime() === bStart.getTime() && bEnd > aEnd)) {
            laterEvent = conflict.eventB;
          } else {
            laterEvent = conflict.eventA;
          }

          // Delete the later event
          const response = await apiDelete(`/api/planting-events/${laterEvent.id}`);

          if (response.ok) {
            successCount++;
          } else {
            failCount++;
          }
        } catch (err) {
          failCount++;
          console.error(`Failed to resolve conflict:`, err);
        }

        // Small delay to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Show results
      if (successCount > 0) {
        showSuccess(`Auto-resolved ${successCount} different crop conflict${successCount > 1 ? 's' : ''}!`);
      }
      if (failCount > 0) {
        showError(`Failed to resolve ${failCount} conflict${failCount > 1 ? 's' : ''}`);
      }

      // Re-fetch to show remaining conflicts
      await fetchConflicts();
    } catch (err) {
      showError('Error during auto-resolve');
      console.error(err);
    } finally {
      setTrimming(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Garden Conflict Audit"
      size="large"
    >
      <div className="space-y-4">
        {loading && (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Scanning gardens for conflicts...</p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {!loading && !error && conflicts.length === 0 && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
            <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-green-900 mb-2">
              No Conflicts Found!
            </h3>
            <p className="text-green-800">
              Your garden beds are conflict-free. All plantings have proper spacing and timing.
            </p>
          </div>
        )}

        {!loading && !error && conflicts.length > 0 && (
          <>
            {/* Statistics & Auto-Resolve Button */}
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1">
                  <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-1" />
                  <div>
                    <p className="text-amber-900 font-medium">
                      Found {conflicts.length} conflict{conflicts.length > 1 ? 's' : ''} in your gardens
                    </p>
                    <div className="text-sm text-amber-800 mt-2 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{duplicateCropConflicts.length}</span>
                        <span>duplicate crop conflicts (same plant) - delete one copy</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{allDifferentCropConflicts.length}</span>
                        <span>different crop conflicts (any overlap size) - keep first, delete later</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  {duplicateCropConflicts.length > 0 && (
                    <button
                      onClick={handleAutoResolveDuplicates}
                      disabled={autoResolving || trimming}
                      className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap"
                      title={`Automatically delete one planting from each duplicate pair (${duplicateCropConflicts.length} conflicts)`}
                    >
                      {autoResolving ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          <span>Deleting...</span>
                        </>
                      ) : (
                        <>
                          <Trash2 className="w-4 h-4" />
                          <span>Delete {duplicateCropConflicts.length} Duplicates</span>
                        </>
                      )}
                    </button>
                  )}

                  {allDifferentCropConflicts.length > 0 && (
                    <button
                      onClick={handleAutoResolveAllDifferentCrops}
                      disabled={autoResolving || trimming}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap"
                      title={`Keep first planting, delete later planting for ALL different crop conflicts (${allDifferentCropConflicts.length} conflicts)`}
                    >
                      {trimming ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          <span>Resolving...</span>
                        </>
                      ) : (
                        <>
                          <Trash2 className="w-4 h-4" />
                          <span>Keep First, Delete {allDifferentCropConflicts.length} Later</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-4 max-h-96 overflow-y-auto">
              {conflicts.map((conflict, index) => {
                const isDuplicate = conflict.eventA.plantName === conflict.eventB.plantName;
                const overlapDays = calculateOverlapDays(conflict);

                return (
                <div
                  key={index}
                  className={`border rounded-lg p-4 space-y-3 ${
                    isDuplicate
                      ? 'bg-orange-50 border-orange-300'
                      : 'bg-blue-50 border-blue-300'
                  }`}
                >
                  <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                    <div className="flex items-center gap-2">
                      <div className="font-medium text-gray-900">
                        {conflict.gardenBedName} - Position {coordinateToGridLabel(conflict.position.x, conflict.position.y)}
                      </div>
                      {isDuplicate ? (
                        <span className="px-2 py-0.5 bg-orange-200 text-orange-800 text-xs font-medium rounded">
                          DUPLICATE
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-blue-200 text-blue-800 text-xs font-medium rounded">
                          OVERLAP ({overlapDays} day{overlapDays !== 1 ? 's' : ''})
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Event A */}
                  <div className="bg-red-50 border border-red-200 rounded p-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">
                          {conflict.eventA.plantName}
                          {conflict.eventA.variety && (
                            <span className="text-gray-600 font-normal ml-1">
                              ({conflict.eventA.variety})
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-700 mt-1">
                          {conflict.eventA.startDate && format(parseISO(conflict.eventA.startDate), 'MMM d, yyyy')}
                          {' → '}
                          {conflict.eventA.endDate && format(parseISO(conflict.eventA.endDate), 'MMM d, yyyy')}
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteEvent(conflict.eventA.id, conflict.eventA.plantName, conflict.eventA.variety)}
                        disabled={deleting === conflict.eventA.id}
                        className="ml-3 p-2 text-red-600 hover:bg-red-100 rounded transition-colors disabled:opacity-50 flex-shrink-0"
                        title="Delete this planting"
                      >
                        {deleting === conflict.eventA.id ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="text-center text-gray-500 text-sm">overlaps with</div>

                  {/* Event B */}
                  <div className="bg-red-50 border border-red-200 rounded p-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">
                          {conflict.eventB.plantName}
                          {conflict.eventB.variety && (
                            <span className="text-gray-600 font-normal ml-1">
                              ({conflict.eventB.variety})
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-700 mt-1">
                          {conflict.eventB.startDate && format(parseISO(conflict.eventB.startDate), 'MMM d, yyyy')}
                          {' → '}
                          {conflict.eventB.endDate && format(parseISO(conflict.eventB.endDate), 'MMM d, yyyy')}
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteEvent(conflict.eventB.id, conflict.eventB.plantName, conflict.eventB.variety)}
                        disabled={deleting === conflict.eventB.id}
                        className="ml-3 p-2 text-red-600 hover:bg-red-100 rounded transition-colors disabled:opacity-50 flex-shrink-0"
                        title="Delete this planting"
                      >
                        {deleting === conflict.eventB.id ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className={`border rounded p-3 text-sm ${
                    isDuplicate
                      ? 'bg-orange-100 border-orange-300'
                      : 'bg-blue-100 border-blue-300'
                  }`}>
                    <p className={`font-medium mb-1 ${
                      isDuplicate
                        ? 'text-orange-900'
                        : 'text-blue-900'
                    }`}>
                      How to resolve:
                    </p>
                    <ul className={`space-y-1 list-disc list-inside ${
                      isDuplicate
                        ? 'text-orange-800'
                        : 'text-blue-800'
                    }`}>
                      {isDuplicate ? (
                        <>
                          <li><strong>Auto-resolve:</strong> Click "Delete {duplicateCropConflicts.length} Duplicates" button at top</li>
                          <li>Or click trash icon above to manually delete one planting</li>
                        </>
                      ) : (
                        <>
                          <li><strong>Auto-resolve:</strong> Click "Keep First, Delete {allDifferentCropConflicts.length} Later" button at top</li>
                          <li>This keeps the earlier planting and deletes the later one</li>
                          <li>Or click trash icon above to manually choose which to delete</li>
                          <li>Leave as-is if this is intentional succession/companion planting</li>
                        </>
                      )}
                    </ul>
                  </div>
                </div>
              );
              })}
            </div>
          </>
        )}

        <div className="flex justify-between items-center pt-4 border-t border-gray-200">
          <button
            onClick={fetchConflicts}
            disabled={loading}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            {loading ? 'Scanning...' : 'Refresh'}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
};
