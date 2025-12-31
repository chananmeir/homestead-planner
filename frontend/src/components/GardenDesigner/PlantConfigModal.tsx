import React, { useState, useEffect, useMemo } from 'react';
import { Modal } from '../common/Modal';
import { Plant, ValidationWarning, ValidationResult, DateSuggestion, GardenBed, SeedInventoryItem } from '../../types';
import { API_BASE_URL } from '../../config';
import WarningDisplay from '../common/WarningDisplay';
import { extractCropName, getVarietyOptions } from '../../utils/plantUtils';
import { autoPlacePlants } from './utils/autoPlacement';
import { useToast } from '../common/Toast';
import { coordinateToGridLabel, gridLabelToCoordinate, isValidGridLabel, getGridBoundsDescription } from './utils/gridCoordinates';

/**
 * Determine if plant should use dense planting (multiple plants in one cell)
 * vs spread planting (one plant per cell)
 */
function shouldUseDensePlanting(plant: Plant, planningMethod: string): boolean {
  if (planningMethod !== 'square-foot' && planningMethod !== 'migardener') {
    return false; // Only SFG and MIgardener support dense planting
  }
  const spacing = plant.spacing || 12;
  return spacing <= 12; // Plants with 12" or less spacing can be planted densely
}

interface PlantConfigModalProps {
  isOpen: boolean;
  cropName: string;  // Base crop name (e.g., "Tomato")
  allPlants: Plant[];  // All plants for variety lookup
  position: { x: number; y: number } | null;
  planningMethod?: string;  // Planning method from garden bed (e.g., 'square-foot', 'row', 'intensive')
  plantingDate?: string;  // Date when plant will be placed (from dateFilter)
  bedId?: number;  // Garden bed ID (for protection offset calculation)
  bed?: GardenBed;  // Full bed object (for auto-placement)
  onDateChange?: (newDate: string) => void;  // Callback to change the planting date
  onPreviewChange?: (positions: { x: number; y: number }[]) => void;  // Callback to show preview in grid
  onSave: (config: PlantConfig) => void;
  onCancel: () => void;
}

export interface PlantConfig {
  variety?: string;
  quantity: number;
  notes: string;
  plantingMethod: 'direct' | 'transplant';
  skipPost?: boolean; // If true, items already created via batch POST - parent should skip POST
  position?: { x: number; y: number }; // Updated position if user edited grid label
}

const PlantConfigModal: React.FC<PlantConfigModalProps> = ({
  isOpen,
  cropName,
  allPlants,
  position,
  planningMethod = 'square-foot',
  plantingDate,
  bedId,
  bed,
  onDateChange,
  onPreviewChange,
  onSave,
  onCancel
}) => {
  const { showSuccess, showError, showWarning } = useToast();
  const [variety, setVariety] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [notes, setNotes] = useState<string>('');
  const [plantingMethod, setPlantingMethod] = useState<'direct' | 'transplant'>('direct');
  const [error, setError] = useState<string>('');
  const [warnings, setWarnings] = useState<ValidationWarning[]>([]);
  const [suggestion, setSuggestion] = useState<DateSuggestion | undefined>(undefined);
  const [validating, setValidating] = useState<boolean>(false);

  // Preview state
  const [previewPositions, setPreviewPositions] = useState<{ x: number; y: number }[]>([]);
  const [showingPreview, setShowingPreview] = useState(false);
  const [plantsPerSquare, setPlantsPerSquare] = useState<number>(1); // For dense planting
  const [isSubmitting, setIsSubmitting] = useState(false); // Prevent double-submission

  // Position editing state
  const [editedPosition, setEditedPosition] = useState<{ x: number; y: number } | null>(null);
  const [gridLabelInput, setGridLabelInput] = useState<string>('');
  const [positionError, setPositionError] = useState<string>('');

  // User's personal seed inventory
  const [userSeeds, setUserSeeds] = useState<SeedInventoryItem[]>([]);

  // Find representative plant for this crop
  const representativePlant = useMemo(() => {
    return allPlants.find(p => extractCropName(p.name) === cropName);
  }, [allPlants, cropName]);

  // Fetch user's personal seed inventory
  useEffect(() => {
    if (!isOpen) return;

    const fetchUserSeeds = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/my-seeds`, {
          credentials: 'include',
        });

        if (response.ok) {
          const seeds = await response.json();
          setUserSeeds(seeds);
        } else {
          console.error('Failed to fetch user seeds:', response.statusText);
          setUserSeeds([]);
        }
      } catch (error) {
        console.error('Error fetching user seeds:', error);
        setUserSeeds([]);
      }
    };

    fetchUserSeeds();
  }, [isOpen]);

  // Get variety options from user's personal seed inventory for this crop
  const varietyOptions = useMemo(() => {
    if (!cropName) return [];

    // Filter user's seeds by matching the crop name from the plant database
    const matchingSeeds = userSeeds.filter(seed => {
      // Find the plant in allPlants by plantId
      const plant = allPlants.find(p => p.id === seed.plantId);
      if (!plant) return false;

      // Extract the crop name from the plant's name and compare
      const plantCropName = extractCropName(plant.name);
      return plantCropName.toLowerCase() === cropName.toLowerCase();
    });

    // Extract unique varieties
    const uniqueVarieties = new Set<string>();
    matchingSeeds.forEach(seed => {
      if (seed.variety && seed.variety.trim()) {
        uniqueVarieties.add(seed.variety.trim());
      }
    });

    // Convert to array and sort
    const varieties = Array.from(uniqueVarieties).sort((a, b) => {
      // Put "Generic" first if it exists
      if (a === 'Generic') return -1;
      if (b === 'Generic') return 1;
      return a.localeCompare(b);
    });

    return varieties.map(variety => ({
      variety,
      plantId: cropName, // Use cropName as plantId
      plant: representativePlant // Use representative plant for agronomic data
    }));
  }, [cropName, userSeeds, representativePlant, allPlants]);

  // Determine if this plant should use dense planting mode
  const isDensePlanting = useMemo(() => {
    return representativePlant && shouldUseDensePlanting(representativePlant, planningMethod);
  }, [representativePlant, planningMethod]);

  // Validate planting conditions when plant, date, or method changes
  useEffect(() => {
    if (!representativePlant || !isOpen || !plantingDate) {
      setWarnings([]);
      setSuggestion(undefined);
      return;
    }

    const validatePlanting = async () => {
      setValidating(true);
      setWarnings([]);
      setSuggestion(undefined);

      try {
        // Get user's zipcode from localStorage (set by Weather Dashboard)
        const zipcode = localStorage.getItem('weatherZipCode');

        if (!zipcode) {
          setWarnings([{
            type: 'no_location',
            message: 'Set your location in Weather Dashboard for planting validation',
            severity: 'info'
          }]);
          setValidating(false);
          return;
        }

        const response = await fetch(`${API_BASE_URL}/api/validate-planting`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            plantId: representativePlant.id,
            plantingDate: plantingDate,
            zipcode: zipcode,
            bedId: bedId,
            plantingMethod: plantingMethod
          })
        });

        if (!response.ok) {
          console.error('Validation request failed:', response.status);
          setValidating(false);
          return;
        }

        const result: ValidationResult = await response.json();
        setWarnings(result.warnings || []);
        setSuggestion(result.suggestion);
      } catch (err) {
        console.error('Error validating planting:', err);
        // Don't block user if validation fails
      } finally {
        setValidating(false);
      }
    };

    validatePlanting();
  }, [representativePlant, plantingDate, plantingMethod, isOpen, bedId, variety]);

  // Calculate grid dimensions from bed
  const gridDimensions = useMemo(() => {
    if (!bed) return null;
    return {
      gridWidth: Math.floor((bed.width * 12) / (bed.gridSize || 12)),
      gridHeight: Math.floor((bed.length * 12) / (bed.gridSize || 12))
    };
  }, [bed]);

  // Get current position (edited or original)
  const currentPosition = editedPosition || position;

  // Convert current position to grid label
  const currentGridLabel = useMemo(() => {
    if (!currentPosition) return '';
    return coordinateToGridLabel(currentPosition.x, currentPosition.y);
  }, [currentPosition]);

  // Handle grid label input change
  const handleGridLabelChange = (value: string) => {
    setGridLabelInput(value);
    setPositionError('');

    // Don't validate empty input
    if (!value.trim()) {
      setEditedPosition(null);
      return;
    }

    // Validate the input
    if (!gridDimensions) {
      setPositionError('Grid dimensions not available');
      return;
    }

    const validation = isValidGridLabel(value, gridDimensions.gridWidth, gridDimensions.gridHeight);

    if (!validation.valid) {
      setPositionError(validation.error || 'Invalid grid label');
      return;
    }

    // Convert to coordinates
    const coord = gridLabelToCoordinate(value);
    if (coord) {
      setEditedPosition(coord);
      setPositionError('');
    }
  };

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen && representativePlant) {
      // Calculate default quantity based on planning method
      let defaultQuantity = 1;

      if (planningMethod === 'square-foot' && representativePlant.spacing) {
        // Square foot gardening: plants per square foot
        const spacing = representativePlant.spacing;
        if (spacing <= 12) {
          // Small plants: multiple per square - (12 / spacing)²
          defaultQuantity = Math.floor(Math.pow(12 / spacing, 2));
        } else {
          // Large plants: store as negative to indicate squares needed
          defaultQuantity = -Math.floor(Math.pow(spacing / 12, 2));
        }
      } else if (planningMethod === 'migardener' && representativePlant.rowSpacing && representativePlant.spacing) {
        // MIgardener high-intensity: (12 / rowSpacing) × (12 / plantSpacing)
        const rowsPerFoot = 12 / representativePlant.rowSpacing;
        const plantsPerFoot = 12 / representativePlant.spacing;
        defaultQuantity = Math.floor(rowsPerFoot * plantsPerFoot);
      }
      // For other methods (row, intensive, etc.), default to 1

      setQuantity(defaultQuantity);
      setPlantsPerSquare(defaultQuantity > 0 ? defaultQuantity : 1); // Store for succession planting
      setVariety('');
      setNotes('');
      setPlantingMethod('direct');

      // Reset position editing
      setEditedPosition(null);
      setGridLabelInput('');
      setPositionError('');
    }
  }, [isOpen, representativePlant, planningMethod]);

  const handlePreviewPlacement = () => {
    if (!bed || !representativePlant || !position || quantity <= 1) {
      return;
    }

    // Calculate grid dimensions
    const gridWidth = Math.floor((bed.width * 12) / (bed.gridSize || 12));
    const gridHeight = Math.floor((bed.length * 12) / (bed.gridSize || 12));

    // For dense planting, calculate number of squares needed
    const numSquares = isDensePlanting ? Math.ceil(quantity / plantsPerSquare) : quantity;

    // Run auto-placement algorithm
    const result = autoPlacePlants({
      startPosition: position,
      plant: representativePlant,
      quantity: numSquares, // Number of squares to find
      bedDimensions: { gridWidth, gridHeight },
      gridSize: bed.gridSize || 12,
      existingPlants: bed.plantedItems || [],
      dateFilter: plantingDate,
    });

    // DEBUG: Log auto-placement results
    console.log('=== AUTO-PLACEMENT DEBUG ===');
    console.log('numSquares requested:', numSquares);
    console.log('result.placed:', result.placed);
    console.log('result.positions.length:', result.positions.length);
    console.log('result.positions:', result.positions);

    setPreviewPositions(result.positions);
    setShowingPreview(true);

    // Notify parent to show preview
    if (onPreviewChange) {
      onPreviewChange(result.positions);
    }

    // Show warning if partial placement
    if (result.placed < numSquares) {
      const plantsPlaced = isDensePlanting ? result.placed * plantsPerSquare : result.placed;
      const plantsTotal = quantity;
      showWarning(
        `Can only place ${plantsPlaced} of ${plantsTotal} plants in ${result.placed} squares. Not enough space for remaining ${plantsTotal - plantsPlaced}.`
      );
    } else {
      const message = isDensePlanting
        ? `Preview: Will place ${result.placed} squares with ${plantsPerSquare} ${cropName} plants each (${result.placed * plantsPerSquare} total)`
        : `Preview: Will place ${result.placed} ${cropName} plants`;
      showSuccess(message);
    }
  };

  const handleSave = async () => {
    // Prevent double-submission
    if (isSubmitting) {
      console.log('❌ Already submitting, ignoring duplicate click');
      return;
    }

    console.log('=== HANDLE SAVE START ===');
    console.log('isDensePlanting:', isDensePlanting);
    console.log('quantity:', quantity);
    console.log('showingPreview:', showingPreview);
    console.log('previewPositions.length:', previewPositions.length);

    setIsSubmitting(true);

    try {
      // PATH 1: DENSE PLANTING - Single item with quantity at one position
      if (isDensePlanting && quantity >= 1 && !showingPreview) {
        console.log('✅ Taking PATH 1: Dense planting without preview');
        const config: PlantConfig = {
          variety: variety.trim() || undefined,
          quantity, // e.g., 4 for lettuce
          notes: notes.trim(),
          plantingMethod,
          position: editedPosition || undefined, // Include edited position if changed
        };
        onSave(config); // Parent GardenDesigner handles API call
        return;
      }

      // PATH 2: SPREAD PLANTING - Single plant or no preview - use existing logic
      if (quantity === 1 || !showingPreview || previewPositions.length === 0) {
        console.log('✅ Taking PATH 2: Spread planting or single plant');
        const config: PlantConfig = {
          variety: variety.trim() || undefined,
          quantity,
          notes: notes.trim(),
          plantingMethod,
          position: editedPosition || undefined, // Include edited position if changed
        };
        onSave(config);
        return;
      }

      console.log('✅ Taking PATH 3: Multi-plant batch creation');

      // Multi-plant batch creation
      if (!bed || !bedId || !representativePlant) {
        showError('Missing required information for batch placement');
        setIsSubmitting(false);
        return;
      }

      // For dense planting, each position gets plantsPerSquare quantity
      const quantityPerPosition = isDensePlanting ? plantsPerSquare : 1;

      // DEBUG: Log preview positions
      console.log('=== BATCH CREATION DEBUG ===');
      console.log('previewPositions:', previewPositions);
      console.log('previewPositions.length:', previewPositions.length);
      console.log('quantityPerPosition:', quantityPerPosition);
      console.log('isDensePlanting:', isDensePlanting);
      console.log('plantsPerSquare:', plantsPerSquare);

      const response = await fetch(`${API_BASE_URL}/api/planted-items/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          gardenBedId: bedId,
          plantId: representativePlant.id,
          variety: variety.trim() || undefined,
          plantedDate: plantingDate,
          plantingMethod,
          status: 'planned',
          notes: notes.trim(),
          positions: previewPositions.map((pos) => ({ x: pos.x, y: pos.y, quantity: quantityPerPosition })),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const totalPlants = isDensePlanting ? data.created * plantsPerSquare : data.created;
        const message = isDensePlanting
          ? `Placed ${data.created} squares with ${plantsPerSquare} ${cropName} each (${totalPlants} total plants) in ${bed.name}`
          : `Placed ${data.created} ${cropName} plants in ${bed.name}`;
        showSuccess(message);

        // Call onSave with skipPost=true to tell parent items already created
        const config: PlantConfig = {
          variety: variety.trim() || undefined,
          quantity: data.created,
          notes: notes.trim(),
          plantingMethod,
          skipPost: true, // Items already created via batch POST - parent should skip POST
        };
        onSave(config);
      } else {
        const errorData = await response.json();
        showError(errorData.error || 'Failed to place plants');
      }
    } catch (error) {
      console.error('Error placing plants:', error);
      showError('Network error while placing plants');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setVariety('');
    setQuantity(1);
    setNotes('');
    setPlantingMethod('direct');
    setError('');
    setPreviewPositions([]);
    setShowingPreview(false);

    // Clear preview in parent
    if (onPreviewChange) {
      onPreviewChange([]);
    }

    onCancel();
  };

  if (!cropName || !representativePlant || !position) {
    return null;
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleCancel}
      title={`Configure ${cropName}`}
    >
      <div className="space-y-4">
        {/* Plant Info */}
        <div className="bg-gray-50 p-3 rounded-lg">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{representativePlant.icon || '🌱'}</span>
            <div className="flex-1">
              <p className="font-semibold text-gray-900">{cropName}</p>
              <div className="flex items-center gap-2 mt-1">
                <label htmlFor="gridPosition" className="text-sm text-gray-600 whitespace-nowrap">
                  Position:
                </label>
                <input
                  id="gridPosition"
                  type="text"
                  value={gridLabelInput || currentGridLabel}
                  onChange={(e) => handleGridLabelChange(e.target.value)}
                  onBlur={() => {
                    // Reset to current position if input is cleared
                    if (!gridLabelInput.trim() && currentPosition) {
                      setGridLabelInput('');
                      setEditedPosition(null);
                    }
                  }}
                  placeholder={currentGridLabel}
                  className={`px-2 py-1 text-sm border rounded w-16 focus:outline-none focus:ring-1 ${
                    positionError
                      ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                      : 'border-gray-300 focus:ring-green-500 focus:border-green-500'
                  }`}
                  title="Edit grid position (e.g., A1, B2)"
                />
                <span className="text-xs text-gray-500">
                  ({currentPosition?.x}, {currentPosition?.y})
                </span>
                {gridDimensions && (
                  <span className="text-xs text-gray-400 ml-1">
                    {getGridBoundsDescription(gridDimensions.gridWidth, gridDimensions.gridHeight)}
                  </span>
                )}
              </div>
              {positionError && (
                <p className="text-xs text-red-600 mt-1">{positionError}</p>
              )}
            </div>
          </div>
        </div>

        {/* Variety Selection */}
        <div>
          <label htmlFor="variety" className="block text-sm font-medium text-gray-700 mb-1">
            Variety {varietyOptions.length > 1 ? '' : '(optional)'}
          </label>

          {varietyOptions.length > 1 ? (
            <div>
              <select
                id="variety"
                value={variety}
                onChange={(e) => setVariety(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
              >
                <option value="">-- Select variety --</option>
                {varietyOptions.map((opt, index) => (
                  <option key={index} value={opt.variety}>
                    {opt.variety}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-sm text-gray-500">
                {varietyOptions.length} varieties available for {cropName}
              </p>
            </div>
          ) : (
            <div>
              <input
                type="text"
                id="variety"
                value={variety}
                onChange={(e) => setVariety(e.target.value)}
                placeholder={`Optional variety name`}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
              <p className="mt-1 text-sm text-gray-500">
                No specific varieties found. You can add a custom variety name.
              </p>
            </div>
          )}

          {error && (
            <p className="mt-1 text-sm text-amber-600">{error}</p>
          )}
        </div>

        {/* Planting Method */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Planting Method
          </label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="plantingMethod"
                value="direct"
                checked={plantingMethod === 'direct'}
                onChange={(e) => setPlantingMethod(e.target.value as 'direct' | 'transplant')}
                className="text-green-600 focus:ring-green-500"
              />
              <span className="text-sm text-gray-700">Direct Seed</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="plantingMethod"
                value="transplant"
                checked={plantingMethod === 'transplant'}
                onChange={(e) => setPlantingMethod(e.target.value as 'direct' | 'transplant')}
                className="text-green-600 focus:ring-green-500"
              />
              <span className="text-sm text-gray-700">Transplant</span>
            </label>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            {plantingMethod === 'direct'
              ? 'Seeds will be sown directly in the garden'
              : 'Seedlings will be transplanted from indoor starts'}
          </p>
        </div>

        {/* Planting Validation Warnings */}
        {validating && (
          <div className="flex items-center justify-center py-2 text-gray-500">
            <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Checking planting conditions...
          </div>
        )}

        {!validating && warnings.length > 0 && (variety !== '' || varietyOptions.length === 0) && (
          <WarningDisplay
            warnings={warnings}
            suggestion={suggestion}
            onChangeDateClick={onDateChange}
          />
        )}

        {/* Quantity */}
        <div>
          <label htmlFor="quantity" className="block text-sm font-medium text-gray-700 mb-1">
            {isDensePlanting ? 'Plants per Square' : 'Quantity'}
          </label>
          <input
            type="number"
            id="quantity"
            min="1"
            max="100"
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
          />
          <p className="mt-1 text-sm text-gray-500">
            {isDensePlanting
              ? quantity <= plantsPerSquare
                ? `Based on ${representativePlant.spacing}" spacing, ${plantsPerSquare} plants fit per square foot. All will be placed at position (${position.x}, ${position.y}).`
                : `Based on ${representativePlant.spacing}" spacing, ${plantsPerSquare} plants fit per square. Enter ${quantity} to place ${Math.ceil(quantity / plantsPerSquare)} squares. Click Preview to see placement.`
              : `Number of ${cropName} plants to place at this position`
            }
          </p>
        </div>

        {/* Notes */}
        <div>
          <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
            Notes (optional)
          </label>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Add notes about this planting..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 resize-none"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 justify-end pt-2">
          <button
            onClick={handleCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
          >
            Cancel
          </button>

          {/* Preview button - show for succession planting (dense or spread) */}
          {quantity > 1 && !showingPreview && bed && (
            // For dense planting, show preview when quantity > plantsPerSquare (succession planting)
            // For spread planting, always show preview when quantity > 1
            (isDensePlanting ? quantity > plantsPerSquare : true) && (
              <button
                onClick={handlePreviewPlacement}
                className="px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-300 rounded-md hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                {isDensePlanting
                  ? `Preview Placement (${Math.ceil(quantity / plantsPerSquare)} squares)`
                  : `Preview Placement (${quantity} plants)`}
              </button>
            )
          )}

          <button
            onClick={handleSave}
            disabled={
              isSubmitting ||
              (quantity > 1 &&
                !showingPreview &&
                bed !== undefined &&
                (!isDensePlanting || quantity > plantsPerSquare)) // Disable for succession planting without preview
            }
            className={`px-4 py-2 text-sm font-medium text-white border border-transparent rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 flex items-center gap-2 ${
              quantity > 1 && !showingPreview && bed !== undefined && (!isDensePlanting || quantity > plantsPerSquare)
                ? 'bg-gray-400 cursor-not-allowed'
                : warnings.some(w => w.severity === 'warning')
                ? 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500'
                : 'bg-green-600 hover:bg-green-700 focus:ring-green-500'
            }`}
          >
            {warnings.some(w => w.severity === 'warning') && (
              <span className="flex items-center justify-center w-5 h-5 text-xs font-bold bg-white text-yellow-700 rounded-full">
                {warnings.filter(w => w.severity === 'warning').length}
              </span>
            )}
            {isDensePlanting && quantity > 1 && quantity <= plantsPerSquare
              ? `Place ${quantity} Plants`
              : showingPreview && quantity > 1
                ? isDensePlanting
                  ? `Place ${previewPositions.length} Squares (${previewPositions.length * plantsPerSquare} total)`
                  : `Place ${previewPositions.length} Plants`
                : `Place Plant${quantity > 1 ? 's' : ''}`}
            {warnings.some(w => w.severity === 'warning') && !showingPreview ? ' Anyway' : ''}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default PlantConfigModal;
