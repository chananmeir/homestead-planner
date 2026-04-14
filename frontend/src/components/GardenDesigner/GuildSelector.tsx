import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Plant } from '../../types';
import { API_BASE_URL } from '../../config';
import { extractCropName } from '../../utils/plantUtils';
import PlantIcon from '../common/PlantIcon';

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

interface GuildSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectGuild: (guildId: string, guild: PlantGuild) => void;
  allPlants: Plant[];
}

export const GuildSelector: React.FC<GuildSelectorProps> = ({
  isOpen,
  onClose,
  onSelectGuild,
  allPlants
}) => {
  const [guilds, setGuilds] = useState<Record<string, PlantGuild>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedGuildId, setSelectedGuildId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadGuilds();
    }
  }, [isOpen]);

  const loadGuilds = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${API_BASE_URL}/api/guilds`, { credentials: 'include' });
      if (!response.ok) {
        throw new Error('Failed to load plant guilds');
      }
      const data = await response.json();
      setGuilds(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load guilds');
    } finally {
      setLoading(false);
    }
  };

  const getPlant = (plantId: string): Plant | undefined => {
    return allPlants.find(p => p.id === plantId);
  };

  const selectedGuild = selectedGuildId ? guilds[selectedGuildId] : null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Plant Guild Templates"
      size="large"
    >
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          Pre-designed plant combinations based on companion planting principles. Each guild includes plants that benefit each other through pest control, nutrient sharing, and structural support.
        </p>

        {loading && (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
            <p className="mt-2 text-sm text-gray-600">Loading guilds...</p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {!loading && !error && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(guilds).map(([guildId, guild]) => {
              const isSelected = selectedGuildId === guildId;
              const totalPlants = guild.plants.reduce((sum, p) => sum + p.quantity, 0);

              return (
                <div
                  key={guildId}
                  onClick={() => setSelectedGuildId(guildId)}
                  className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                    isSelected
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-300 hover:border-green-300 bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-gray-900">{guild.name}</h3>
                    <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
                      {guild.method}
                    </span>
                  </div>

                  <p className="text-sm text-gray-600 mb-3">{guild.description}</p>

                  <div className="space-y-2">
                    <div className="text-xs text-gray-500">
                      {totalPlants} plants • {guild.bedSize.width}' × {guild.bedSize.length}' bed
                    </div>

                    {/* Plant Icons Preview */}
                    <div className="flex flex-wrap gap-1">
                      {guild.plants.map((guildPlant, idx) => {
                        const plant = getPlant(guildPlant.id);
                        if (!plant) return null;
                        return (
                          <div
                            key={idx}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-gray-200 rounded text-xs"
                            title={`${extractCropName(plant.name)} (${guildPlant.quantity}) - ${guildPlant.role}`}
                          >
                            <PlantIcon plantId={plant.id} plantIcon={plant.icon || '🌱'} size={16} className="inline-block" />
                            <span className="text-gray-700">{guildPlant.quantity}×</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {isSelected && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectGuild(guildId, guild);
                      }}
                      className="mt-3 w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
                    >
                      Preview & Insert
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Guild Details Panel */}
        {selectedGuild && (
          <div className="mt-4 bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h4 className="font-semibold text-gray-900 mb-3">Guild Details</h4>
            <div className="space-y-2">
              {selectedGuild.plants.map((guildPlant, idx) => {
                const plant = getPlant(guildPlant.id);
                if (!plant) return null;
                return (
                  <div
                    key={idx}
                    className="flex items-start gap-3 p-2 bg-white rounded border border-gray-200"
                  >
                    <PlantIcon plantId={plant.id} plantIcon={plant.icon || '🌱'} size={32} />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">
                          {extractCropName(plant.name)}
                        </span>
                        <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-700 rounded">
                          {guildPlant.quantity}× plants
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 mt-1">
                        Role: {guildPlant.role}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
