import React, { useState, useMemo } from 'react';
import { Modal } from '../common/Modal';
import { Plant, GardenBed } from '../../types';
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

interface GuildPreviewProps {
  isOpen: boolean;
  onClose: () => void;
  guildId: string;
  guild: PlantGuild;
  bed: GardenBed;
  allPlants: Plant[];
  onInsert: (guildId: string, guild: PlantGuild, startPosition: { x: number; y: number }) => void;
}

export const GuildPreview: React.FC<GuildPreviewProps> = ({
  isOpen,
  onClose,
  guildId,
  guild,
  bed,
  allPlants,
  onInsert
}) => {
  const [startX, setStartX] = useState(0);
  const [startY, setStartY] = useState(0);

  const getPlant = (plantId: string): Plant | undefined => {
    return allPlants.find(p => p.id === plantId);
  };

  // Calculate guild dimensions in grid cells
  const guildDimensions = useMemo(() => {
    const guildWidthCells = Math.ceil((guild.bedSize.width * 12) / bed.gridSize);
    const guildHeightCells = Math.ceil((guild.bedSize.length * 12) / bed.gridSize);
    return { width: guildWidthCells, height: guildHeightCells };
  }, [guild, bed]);

  // Check if guild fits in bed at current position
  const fitsInBed = useMemo(() => {
    const bedWidthCells = Math.floor((bed.width * 12) / bed.gridSize);
    const bedHeightCells = Math.floor((bed.length * 12) / bed.gridSize);
    return (
      startX + guildDimensions.width <= bedWidthCells &&
      startY + guildDimensions.height <= bedHeightCells
    );
  }, [startX, startY, guildDimensions, bed]);

  const cellSize = 40; // Size for preview grid

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
            Guild size: {guild.bedSize.width}' × {guild.bedSize.length}'
            ({guildDimensions.width} × {guildDimensions.height} cells on {bed.gridSize}" grid)
          </div>
        </div>

        {/* Position Controls */}
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
                max={Math.floor((bed.width * 12) / bed.gridSize) - guildDimensions.width}
                value={startX}
                onChange={(e) => setStartX(parseInt(e.target.value) || 0)}
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
                max={Math.floor((bed.length * 12) / bed.gridSize) - guildDimensions.height}
                value={startY}
                onChange={(e) => setStartY(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
          </div>

          {!fitsInBed && (
            <div className="mt-3 bg-red-50 border border-red-200 rounded p-2">
              <p className="text-sm text-red-700">
                Guild doesn't fit at this position. Adjust starting position or choose a larger bed.
              </p>
            </div>
          )}
        </div>

        {/* Guild Layout Preview */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-3">Guild Layout Preview</h4>

          <div className="bg-white border border-gray-300 rounded p-4 inline-block">
            <svg
              width={guildDimensions.width * cellSize}
              height={guildDimensions.height * cellSize}
              className="border border-gray-200"
            >
              {/* Grid */}
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

              {/* Plants - Distribute evenly across guild area */}
              {guild.plants.map((guildPlant, idx) => {
                const plant = getPlant(guildPlant.id);
                if (!plant) return null;

                // Simple distribution: spread plants across the guild area
                const totalPlants = guild.plants.reduce((sum, p) => sum + p.quantity, 0);
                let currentPlantIndex = guild.plants
                  .slice(0, idx)
                  .reduce((sum, p) => sum + p.quantity, 0);

                const plantsInGuild: React.ReactNode[] = [];
                for (let i = 0; i < guildPlant.quantity; i++) {
                  const plantIdx = currentPlantIndex + i;
                  // Distribute in a grid pattern
                  const cols = Math.ceil(Math.sqrt(totalPlants));
                  const col = plantIdx % cols;
                  const row = Math.floor(plantIdx / cols);

                  const x = (col + 0.5) * (guildDimensions.width / cols) * cellSize;
                  const y = (row + 0.5) * (guildDimensions.height / Math.ceil(totalPlants / cols)) * cellSize;
                  const iconSize = cellSize * 0.7;

                  plantsInGuild.push(
                    <g key={`${idx}-${i}`}>
                      <PlantIconSVG
                        key={`guild-${plant.id}-${idx}-${i}`}
                        plantId={plant.id}
                        plantIcon={plant.icon || '🌱'}
                        x={x - iconSize / 2}
                        y={y - iconSize / 2}
                        width={iconSize}
                        height={iconSize}
                      />
                    </g>
                  );
                }

                return plantsInGuild;
              })}
            </svg>
          </div>
        </div>

        {/* Plant List */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-3">Plants in Guild</h4>
          <div className="space-y-2">
            {guild.plants.map((guildPlant, idx) => {
              const plant = getPlant(guildPlant.id);
              if (!plant) return null;
              return (
                <div
                  key={idx}
                  className="flex items-center gap-3 p-2 bg-white rounded border border-gray-200"
                >
                  <PlantIcon plantId={plant.id} plantIcon={plant.icon || '🌱'} size={32} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">
                        {extractCropName(plant.name)}
                      </span>
                      <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded">
                        {guildPlant.quantity}× plants
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

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (fitsInBed) {
                onInsert(guildId, guild, { x: startX, y: startY });
                onClose();
              }
            }}
            disabled={!fitsInBed}
            className={`px-6 py-2 font-medium rounded-lg transition-colors ${
              fitsInBed
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            Insert Guild
          </button>
        </div>
      </div>
    </Modal>
  );
};
