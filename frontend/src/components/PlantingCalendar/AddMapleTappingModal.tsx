import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { apiGet, apiPost } from '../../utils/api';

interface PlacedStructure {
  id: number;
  structureId: string;
  name: string;
  positionX: number;
  positionY: number;
}

interface AddMapleTappingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEventAdded: () => void;
}

interface CollectionRecord {
  date: string;
  sapAmount: number;
  notes: string;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface SyrupYield {
  gallons: number;
  grade: 'Golden' | 'Amber' | 'Dark' | 'VeryDark';
  boilDate: string;
  notes: string;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface TreeHealth {
  tapHealing: 'good' | 'fair' | 'poor';
  observations: string;
  diameter: number;
}

const TREE_TYPE_LABELS: Record<string, string> = {
  'sugar': 'Sugar Maple',
  'red': 'Red Maple',
  'black': 'Black Maple',
  'boxelder': 'Box Elder Maple',
};

const SYRUP_GRADES = [
  { value: 'Golden', label: 'Golden - Delicate', description: 'Light, mild flavor' },
  { value: 'Amber', label: 'Amber - Rich', description: 'Full-bodied, smooth' },
  { value: 'Dark', label: 'Dark - Robust', description: 'Strong maple flavor' },
  { value: 'VeryDark', label: 'Very Dark - Strong', description: 'Very strong, best for cooking' },
];

const AddMapleTappingModal: React.FC<AddMapleTappingModalProps> = ({
  isOpen,
  onClose,
  onEventAdded
}) => {
  // Basic fields
  const [mapleTrees, setMapleTrees] = useState<PlacedStructure[]>([]);
  const [selectedTreeId, setSelectedTreeId] = useState<number | ''>('');
  const [tappingDate, setTappingDate] = useState<string>('');
  const [tapCount, setTapCount] = useState<number>(1);
  const [notes, setNotes] = useState<string>('');

  // Collection tracking
  const [collections, setCollections] = useState<CollectionRecord[]>([]);
  const [showCollections, setShowCollections] = useState(false);

  // Syrup production
  const [showSyrupYield, setShowSyrupYield] = useState(false);
  const [syrupGallons, setSyrupGallons] = useState<string>('');
  const [syrupGrade, setSyrupGrade] = useState<'Golden' | 'Amber' | 'Dark' | 'VeryDark'>('Amber');
  const [boilDate, setBoilDate] = useState<string>('');
  const [syrupNotes, setSyrupNotes] = useState<string>('');

  // Tree health
  const [showTreeHealth, setShowTreeHealth] = useState(false);
  const [tapHealing, setTapHealing] = useState<'good' | 'fair' | 'poor'>('good');
  const [treeDiameter, setTreeDiameter] = useState<string>('');
  const [healthObservations, setHealthObservations] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingTrees, setIsLoadingTrees] = useState(false);

  // Fetch maple trees on mount
  useEffect(() => {
    if (isOpen) {
      fetchMapleTrees();
    }
  }, [isOpen]);

  const fetchMapleTrees = async () => {
    setIsLoadingTrees(true);
    try {
      const response = await apiGet('/api/properties');

      if (!response.ok) {
        throw new Error('Failed to fetch properties');
      }

      const properties = await response.json();

      // Extract all placed structures from all properties and filter to maple trees
      const allStructures = properties.flatMap((prop: any) => prop.placedStructures || []);
      const maples = allStructures.filter((s: PlacedStructure) =>
        ['sugar-maple', 'red-maple', 'black-maple', 'box-elder-maple'].includes(s.structureId)
      );
      setMapleTrees(maples);

      if (maples.length === 0) {
        setError('No maple trees found. Please add maple trees in the Property Designer first.');
      }
    } catch (err) {
      setError('Failed to load maple trees');
    } finally {
      setIsLoadingTrees(false);
    }
  };

  const handleAddCollection = () => {
    setCollections([...collections, { date: '', sapAmount: 0, notes: '' }]);
  };

  const handleRemoveCollection = (index: number) => {
    setCollections(collections.filter((_, i) => i !== index));
  };

  const handleCollectionChange = (index: number, field: keyof CollectionRecord, value: string | number) => {
    const updated = [...collections];
    updated[index] = { ...updated[index], [field]: value };
    setCollections(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedTreeId) {
      setError('Please select a maple tree');
      return;
    }

    if (!tappingDate) {
      setError('Please select a tapping date');
      return;
    }

    setIsSubmitting(true);

    try {
      const selectedTree = mapleTrees.find(t => t.id === selectedTreeId);
      if (!selectedTree) {
        throw new Error('Selected tree not found');
      }

      // Determine tree type from structure ID
      let treeType: 'sugar' | 'red' | 'black' | 'boxelder' = 'sugar';
      if (selectedTree.structureId === 'red-maple') treeType = 'red';
      if (selectedTree.structureId === 'black-maple') treeType = 'black';
      if (selectedTree.structureId === 'box-elder-maple') treeType = 'boxelder';

      // Build collection dates array
      const collectionDates = showCollections
        ? collections.filter(c => c.date && c.sapAmount > 0)
        : [];

      // Build syrup yield object
      const syrupYield = showSyrupYield && syrupGallons
        ? {
            gallons: parseFloat(syrupGallons),
            grade: syrupGrade,
            boilDate: boilDate || new Date().toISOString().split('T')[0],
            notes: syrupNotes
          }
        : undefined;

      // Build tree health object
      const treeHealth = showTreeHealth
        ? {
            tapHealing,
            observations: healthObservations,
            diameter: treeDiameter ? parseFloat(treeDiameter) : undefined
          }
        : undefined;

      const eventData = {
        eventType: 'maple-tapping',
        tappingDate: new Date(tappingDate).toISOString(),
        treeStructureId: selectedTreeId,
        treeType,
        tapCount,
        collectionDates,
        syrupYield,
        treeHealth,
        notes: notes || undefined
      };

      const response = await apiPost('/api/planting-events', eventData);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create tapping event');
      }

      onEventAdded();
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    // Reset form
    setSelectedTreeId('');
    setTappingDate('');
    setTapCount(1);
    setNotes('');
    setCollections([]);
    setShowCollections(false);
    setSyrupGallons('');
    setSyrupGrade('Amber');
    setBoilDate('');
    setSyrupNotes('');
    setShowSyrupYield(false);
    setTapHealing('good');
    setTreeDiameter('');
    setHealthObservations('');
    setShowTreeHealth(false);
    setError(null);
    onClose();
  };

  const selectedTree = mapleTrees.find(t => t.id === selectedTreeId);
  const treeType = selectedTree?.structureId.replace('-maple', '') || 'sugar';
  const totalSapCollected = collections.reduce((sum, c) => sum + (c.sapAmount || 0), 0);

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="🍁 Track Maple Tapping">
      <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
        {/* Maple Tree Selection */}
        <div>
          <label htmlFor="maplTree" className="block text-sm font-medium text-gray-700 mb-1">
            Maple Tree *
          </label>
          {isLoadingTrees ? (
            <p className="text-sm text-gray-500">Loading maple trees...</p>
          ) : mapleTrees.length === 0 ? (
            <p className="text-sm text-amber-600">
              No maple trees found. Add maple trees in the Property Designer first.
            </p>
          ) : (
            <>
              <select
                id="mapleTree"
                value={selectedTreeId}
                onChange={(e) => setSelectedTreeId(e.target.value ? Number(e.target.value) : '')}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                required
              >
                <option value="">Select a tree...</option>
                {mapleTrees.map(tree => {
                  const type = tree.structureId.replace('-maple', '');
                  return (
                    <option key={tree.id} value={tree.id}>
                      {TREE_TYPE_LABELS[type] || tree.name} ({tree.positionX}', {tree.positionY}')
                    </option>
                  );
                })}
              </select>
              {selectedTree && (
                <p className="mt-1 text-xs text-gray-500">
                  {TREE_TYPE_LABELS[treeType]} at position ({selectedTree.positionX}', {selectedTree.positionY}')
                </p>
              )}
            </>
          )}
        </div>

        {/* Tapping Date */}
        <div>
          <label htmlFor="tappingDate" className="block text-sm font-medium text-gray-700 mb-1">
            Tapping Date *
          </label>
          <input
            type="date"
            id="tappingDate"
            value={tappingDate}
            onChange={(e) => setTappingDate(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            required
          />
          <p className="mt-1 text-xs text-gray-500">
            Ideal: freezing nights (below 32°F) and thawing days (above 32°F)
          </p>
        </div>

        {/* Tap Count */}
        <div>
          <label htmlFor="tapCount" className="block text-sm font-medium text-gray-700 mb-1">
            Number of Taps *
          </label>
          <input
            type="number"
            id="tapCount"
            value={tapCount}
            onChange={(e) => setTapCount(Number(e.target.value))}
            min="1"
            max="4"
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            required
          />
          <p className="mt-1 text-xs text-gray-500">
            Rule of thumb: 1 tap for 10-17" diameter, 2 taps for 18-24", 3+ for larger trees
          </p>
        </div>

        {/* Collection Tracking (Optional) */}
        <div className="border-t pt-4">
          <div className="flex items-center justify-between mb-2">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={showCollections}
                onChange={(e) => setShowCollections(e.target.checked)}
                className="mr-2"
              />
              <span className="text-sm font-medium text-gray-700">Track Sap Collection</span>
            </label>
          </div>

          {showCollections && (
            <div className="space-y-3 pl-4">
              {collections.map((collection, index) => (
                <div key={index} className="flex gap-2 items-start bg-gray-50 p-3 rounded">
                  <div className="flex-1">
                    <input
                      type="date"
                      value={collection.date}
                      onChange={(e) => handleCollectionChange(index, 'date', e.target.value)}
                      className="w-full p-1 text-sm border border-gray-300 rounded"
                      placeholder="Collection date"
                    />
                  </div>
                  <div className="flex-1">
                    <input
                      type="number"
                      value={collection.sapAmount || ''}
                      onChange={(e) => handleCollectionChange(index, 'sapAmount', parseFloat(e.target.value) || 0)}
                      min="0"
                      step="0.1"
                      className="w-full p-1 text-sm border border-gray-300 rounded"
                      placeholder="Gallons"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveCollection(index)}
                    className="text-red-600 hover:text-red-800 text-sm px-2"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={handleAddCollection}
                className="text-sm text-orange-600 hover:text-orange-800 font-medium"
              >
                + Add Collection
              </button>
              {totalSapCollected > 0 && (
                <p className="text-sm text-gray-600">
                  Total collected: <strong>{totalSapCollected.toFixed(1)} gallons</strong>
                  {' '}(≈ {(totalSapCollected / 40).toFixed(2)} gallons syrup at 40:1 ratio)
                </p>
              )}
            </div>
          )}
        </div>

        {/* Syrup Production (Optional) */}
        <div className="border-t pt-4">
          <div className="flex items-center justify-between mb-2">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={showSyrupYield}
                onChange={(e) => setShowSyrupYield(e.target.checked)}
                className="mr-2"
              />
              <span className="text-sm font-medium text-gray-700">Record Syrup Production</span>
            </label>
          </div>

          {showSyrupYield && (
            <div className="space-y-3 pl-4">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Syrup Yield (gallons)</label>
                <input
                  type="number"
                  value={syrupGallons}
                  onChange={(e) => setSyrupGallons(e.target.value)}
                  min="0"
                  step="0.1"
                  className="w-full p-2 border border-gray-300 rounded"
                  placeholder="e.g., 1.5"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">USDA Grade</label>
                <select
                  value={syrupGrade}
                  onChange={(e) => setSyrupGrade(e.target.value as typeof syrupGrade)}
                  className="w-full p-2 border border-gray-300 rounded"
                >
                  {SYRUP_GRADES.map(grade => (
                    <option key={grade.value} value={grade.value}>
                      {grade.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  {SYRUP_GRADES.find(g => g.value === syrupGrade)?.description}
                </p>
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Boil Date</label>
                <input
                  type="date"
                  value={boilDate}
                  onChange={(e) => setBoilDate(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Production Notes</label>
                <textarea
                  value={syrupNotes}
                  onChange={(e) => setSyrupNotes(e.target.value)}
                  rows={2}
                  className="w-full p-2 border border-gray-300 rounded"
                  placeholder="Flavor notes, cooking details..."
                />
              </div>
            </div>
          )}
        </div>

        {/* Tree Health (Optional) */}
        <div className="border-t pt-4">
          <div className="flex items-center justify-between mb-2">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={showTreeHealth}
                onChange={(e) => setShowTreeHealth(e.target.checked)}
                className="mr-2"
              />
              <span className="text-sm font-medium text-gray-700">Track Tree Health</span>
            </label>
          </div>

          {showTreeHealth && (
            <div className="space-y-3 pl-4">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Tree Diameter (inches DBH)</label>
                <input
                  type="number"
                  value={treeDiameter}
                  onChange={(e) => setTreeDiameter(e.target.value)}
                  min="10"
                  step="0.5"
                  className="w-full p-2 border border-gray-300 rounded"
                  placeholder="e.g., 14.5"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Measure diameter at breast height (4.5 feet from ground)
                </p>
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Tap Healing Status</label>
                <select
                  value={tapHealing}
                  onChange={(e) => setTapHealing(e.target.value as typeof tapHealing)}
                  className="w-full p-2 border border-gray-300 rounded"
                >
                  <option value="good">Good - Normal healing</option>
                  <option value="fair">Fair - Some issues</option>
                  <option value="poor">Poor - Needs attention</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Health Observations</label>
                <textarea
                  value={healthObservations}
                  onChange={(e) => setHealthObservations(e.target.value)}
                  rows={2}
                  className="w-full p-2 border border-gray-300 rounded"
                  placeholder="Overall tree health, tap placement notes..."
                />
              </div>
            </div>
          )}
        </div>

        {/* General Notes */}
        <div>
          <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
            Notes <span className="text-gray-500 text-xs">(optional)</span>
          </label>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Weather conditions, additional observations..."
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          />
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-4 border-t sticky bottom-0 bg-white">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || mapleTrees.length === 0}
            className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 transition-colors disabled:bg-gray-400"
          >
            {isSubmitting ? 'Adding...' : 'Add Tapping Event'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default AddMapleTappingModal;
