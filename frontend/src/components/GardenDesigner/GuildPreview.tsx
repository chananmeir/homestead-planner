import React, { useEffect, useMemo, useState } from 'react';
import { Modal } from '../common/Modal';
import { Plant, GardenBed } from '../../types';
import { apiPost } from '../../utils/api';
import { extractCropName } from '../../utils/plantUtils';
import PlantIcon, { PlantIconSVG } from '../common/PlantIcon';

interface PlantGuildPlant {
  id: string;
  quantity: number;
  role: string;
}

interface PlantGuild {
  name: string;
  description: string;
  plants: PlantGuildPlant[];
  bedSize: { width: number; length: number };
  method: string;
}

interface GuildPlacement {
  plantId: string;
  plantName: string;
  role: string;
  position: { x: number; y: number };
  quantity: number;
}

interface GuildValidationMessage {
  code: string;
  message: string;
  plantId?: string;
  position?: { x: number; y: number };
}

interface GuildValidation {
  guildId: string;
  guildName: string;
  origin: { x: number; y: number };
  guildDimensions: { width: number; height: number };
  placements: GuildPlacement[];
  totalQuantity: number;
  errors: GuildValidationMessage[];
  warnings: GuildValidationMessage[];
  benefits: GuildValidationMessage[];
  score: number;
  canInsert: boolean;
}

interface GuildPreviewProps {
  isOpen: boolean;
  onClose: () => void;
  guildId: string;
  guild: PlantGuild;
  bed: GardenBed;
  allPlants: Plant[];
  plantedDate: string;
  onInsert: (
    guildId: string,
    guild: PlantGuild,
    startPosition: { x: number; y: number }
  ) => Promise<boolean>;
}

export const GuildPreview: React.FC<GuildPreviewProps> = ({
  isOpen,
  onClose,
  guildId,
  guild,
  bed,
  allPlants,
  plantedDate,
  onInsert
}) => {
  const [startX, setStartX] = useState(0);
  const [startY, setStartY] = useState(0);
  const [validation, setValidation] = useState<GuildValidation | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);
  const [inserting, setInserting] = useState(false);

  const getPlant = (plantId: string): Plant | undefined => {
    return allPlants.find(p => p.id === plantId);
  };

  const localGuildDimensions = useMemo(() => {
    const guildWidthCells = Math.ceil((guild.bedSize.width * 12) / bed.gridSize);
    const guildHeightCells = Math.ceil((guild.bedSize.length * 12) / bed.gridSize);
    return { width: guildWidthCells, height: guildHeightCells };
  }, [guild, bed]);

  const guildDimensions = validation?.guildDimensions || localGuildDimensions;
  const bedWidthCells = Math.floor((bed.width * 12) / bed.gridSize);
  const bedHeightCells = Math.floor((bed.length * 12) / bed.gridSize);
  const maxStartX = Math.max(0, bedWidthCells - guildDimensions.width);
  const maxStartY = Math.max(0, bedHeightCells - guildDimensions.height);
  const cellSize = 40;

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    let active = true;
    const validate = async () => {
      setValidating(true);
      setValidationError(null);
      try {
        const response = await apiPost(`/api/guilds/${guildId}/validate-placement`, {
          gardenBedId: bed.id,
          origin: { x: startX, y: startY },
          plantedDate
        });

        const data = await response.json();
        if (!active) {
          return;
        }
        if (!response.ok) {
          setValidation(null);
          setValidationError(data.error || 'Failed to validate guild placement');
          return;
        }
        setValidation(data);
      } catch (err) {
        if (active) {
          setValidation(null);
          setValidationError('Failed to validate guild placement');
        }
      } finally {
        if (active) {
          setValidating(false);
        }
      }
    };

    validate();

    return () => {
      active = false;
    };
  }, [isOpen, guildId, bed.id, startX, startY, plantedDate]);

  const canInsert = Boolean(validation?.canInsert) && !validating && !inserting;

  const handleInsert = async () => {
    if (!canInsert) {
      return;
    }
    setInserting(true);
    try {
      const inserted = await onInsert(guildId, guild, { x: startX, y: startY });
      if (inserted) {
        onClose();
      }
    } finally {
      setInserting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Preview: ${guild.name}`}
      size="large"
    >
      <div className="space-y-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-sm text-blue-900">
            {guild.description}
          </p>
          <div className="mt-2 text-xs text-blue-700">
            Guild size: {guild.bedSize.width}' x {guild.bedSize.length}'
            ({guildDimensions.width} x {guildDimensions.height} cells on {bed.gridSize}" grid)
          </div>
        </div>

        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-3">Starting Position</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="start-x" className="block text-sm font-medium text-gray-700 mb-1">
                Column (X)
              </label>
              <input
                id="start-x"
                type="number"
                min="0"
                max={maxStartX}
                value={startX}
                onChange={(e) => setStartX(Math.max(0, parseInt(e.target.value, 10) || 0))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
            <div>
              <label htmlFor="start-y" className="block text-sm font-medium text-gray-700 mb-1">
                Row (Y)
              </label>
              <input
                id="start-y"
                type="number"
                min="0"
                max={maxStartY}
                value={startY}
                onChange={(e) => setStartY(Math.max(0, parseInt(e.target.value, 10) || 0))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {validationError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-sm text-red-700">{validationError}</p>
          </div>
        )}

        {validation?.errors && validation.errors.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <h4 className="text-sm font-medium text-red-900 mb-2">Cannot Insert</h4>
            <div className="space-y-1">
              {validation.errors.map((error, index) => (
                <p key={`${error.code}-${index}`} className="text-sm text-red-700">
                  {error.message}
                </p>
              ))}
            </div>
          </div>
        )}

        {validation?.warnings && validation.warnings.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <h4 className="text-sm font-medium text-amber-900 mb-2">Warnings</h4>
            <div className="space-y-1">
              {validation.warnings.map((warning, index) => (
                <p key={`${warning.code}-${index}`} className="text-sm text-amber-800">
                  {warning.message}
                </p>
              ))}
            </div>
          </div>
        )}

        {validation?.benefits && validation.benefits.length > 0 && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <h4 className="text-sm font-medium text-green-900 mb-2">Companion Benefits</h4>
            <div className="space-y-1">
              {validation.benefits.map((benefit, index) => (
                <p key={`${benefit.code}-${index}`} className="text-sm text-green-800">
                  {benefit.message}
                </p>
              ))}
            </div>
          </div>
        )}

        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-3">Guild Layout Preview</h4>

          {validating && (
            <p className="text-sm text-gray-600">Validating placement...</p>
          )}

          {!validating && (
            <div className="bg-white border border-gray-300 rounded p-4 inline-block max-w-full overflow-auto">
              <svg
                width={guildDimensions.width * cellSize}
                height={guildDimensions.height * cellSize}
                className="border border-gray-200"
              >
                <defs>
                  <pattern id="guild-grid" width={cellSize} height={cellSize} patternUnits="userSpaceOnUse">
                    <path
                      d={`M ${cellSize} 0 L 0 0 0 ${cellSize}`}
                      fill="none"
                      stroke="#e5e7eb"
                      strokeWidth="1"
                    />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#guild-grid)" />

                {validation?.placements.map((placement, index) => {
                  const plant = getPlant(placement.plantId);
                  const localX = placement.position.x - startX;
                  const localY = placement.position.y - startY;
                  const iconSize = cellSize * 0.68;
                  const iconX = (localX * cellSize) + (cellSize - iconSize) / 2;
                  const iconY = (localY * cellSize) + (cellSize - iconSize) / 2;

                  return (
                    <g key={`${placement.plantId}-${placement.position.x}-${placement.position.y}-${index}`}>
                      <PlantIconSVG
                        plantId={placement.plantId}
                        plantIcon={plant?.icon || 'Plant'}
                        x={iconX}
                        y={iconY}
                        width={iconSize}
                        height={iconSize}
                      />
                      {placement.quantity > 1 && (
                        <text
                          x={(localX + 1) * cellSize - 5}
                          y={(localY + 1) * cellSize - 5}
                          fontSize="11"
                          textAnchor="end"
                          className="fill-gray-800 font-semibold"
                        >
                          {placement.quantity}
                        </text>
                      )}
                    </g>
                  );
                })}
              </svg>
            </div>
          )}
        </div>

        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-3">Plants in Guild</h4>
          <div className="space-y-2">
            {guild.plants.map((guildPlant, idx) => {
              const plant = getPlant(guildPlant.id);
              const plantName = plant ? extractCropName(plant.name) : guildPlant.id;
              return (
                <div
                  key={idx}
                  className="flex items-center gap-3 p-2 bg-white rounded border border-gray-200"
                >
                  <PlantIcon plantId={guildPlant.id} plantIcon={plant?.icon || 'Plant'} size={32} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">
                        {plantName}
                      </span>
                      <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded">
                        {guildPlant.quantity}x plants
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">
                      {guildPlant.role}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleInsert}
            disabled={!canInsert}
            className={`px-6 py-2 font-medium rounded-lg transition-colors ${
              canInsert
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {inserting ? 'Inserting...' : 'Insert Guild'}
          </button>
        </div>
      </div>
    </Modal>
  );
};
