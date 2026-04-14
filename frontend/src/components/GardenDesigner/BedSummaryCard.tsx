import React from 'react';
import { GardenBed, PlantedItem, Plant } from '../../types';
import BedThumbnail from './BedThumbnail';

interface BedSummaryCardProps {
  bed: GardenBed;
  plants: Plant[];
  activePlantedItems: PlantedItem[];
  onSelect: () => void;
}

const PROTECTION_ICONS: Record<string, string> = {
  'row-cover': '\uD83D\uDEE1\uFE0F',
  'low-tunnel': '\u26FA',
  'cold-frame': '\uD83D\uDCE6',
  'high-tunnel': '\uD83C\uDFE0',
  'greenhouse': '\uD83C\uDFDB\uFE0F',
};

const METHOD_LABELS: Record<string, string> = {
  'square-foot': 'SFG',
  'row': 'Row',
  'intensive': 'Intensive',
  'migardener': 'MIGardener',
};

const BedSummaryCard: React.FC<BedSummaryCardProps> = ({
  bed,
  plants,
  activePlantedItems,
  onSelect,
}) => {
  const plantCount = activePlantedItems.length;
  const totalSqFt = bed.width * bed.length;

  // Get unique plants with counts, sorted by count descending
  const plantCounts = new Map<string, { name: string; icon: string; count: number }>();
  for (const item of activePlantedItems) {
    const plant = plants.find(p => p.id === item.plantId);
    const key = item.variety ? `${item.plantId}::${item.variety}` : item.plantId;
    const existing = plantCounts.get(key);
    if (existing) {
      existing.count += item.quantity;
    } else {
      const displayName = item.variety
        ? `${plant?.name || item.plantId} (${item.variety})`
        : (plant?.name || item.plantId);
      plantCounts.set(key, {
        name: displayName,
        icon: plant?.icon || '\uD83C\uDF31',
        count: item.quantity,
      });
    }
  }
  const sortedPlants = Array.from(plantCounts.values()).sort((a, b) => b.count - a.count);
  const topPlants = sortedPlants.slice(0, 4);
  const remainingCount = sortedPlants.length - topPlants.length;

  const hasProtection = bed.seasonExtension && bed.seasonExtension.type !== 'none';
  const protectionIcon = hasProtection ? PROTECTION_ICONS[bed.seasonExtension!.type] || '\uD83D\uDEE1\uFE0F' : null;
  const methodLabel = METHOD_LABELS[bed.planningMethod] || bed.planningMethod;

  // Derive a status label
  const getStatus = (): { label: string; color: string } => {
    if (plantCount === 0) return { label: 'Empty', color: 'bg-gray-100 text-gray-600' };
    const statuses = activePlantedItems.map(i => i.status);
    const growing = statuses.filter(s => s === 'growing' || s === 'transplanted').length;
    const planned = statuses.filter(s => s === 'planned' || s === 'seeded').length;
    if (growing > plantCount * 0.5) return { label: 'Growing', color: 'bg-green-100 text-green-700' };
    if (planned > plantCount * 0.5) return { label: 'Planned', color: 'bg-blue-100 text-blue-700' };
    return { label: 'Active', color: 'bg-emerald-100 text-emerald-700' };
  };
  const status = getStatus();

  return (
    <div
      data-testid={`bed-card-${bed.id}`}
      onClick={onSelect}
      className="bg-white rounded-2xl border border-gray-200 p-4 cursor-pointer transition-all hover:shadow-lg hover:border-green-400 hover:-translate-y-0.5 flex flex-col"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-base font-semibold text-gray-900">{bed.name}</h3>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-sm text-gray-500">{bed.width}' x {bed.length}'</span>
            <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">{methodLabel}</span>
            {protectionIcon && (
              <span className="text-sm" title={`Protected: ${bed.seasonExtension!.type.replace('-', ' ')}`}>
                {protectionIcon}
              </span>
            )}
          </div>
        </div>
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${status.color}`}>
          {status.label}
        </span>
      </div>

      {/* Thumbnail + Stats */}
      <div className="flex gap-3 mb-3 flex-1">
        <BedThumbnail
          bed={bed}
          activePlantedItems={activePlantedItems}
          plants={plants}
        />
        <div className="flex flex-col justify-center">
          <div className="text-2xl font-bold text-gray-800">{plantCount}</div>
          <div className="text-xs text-gray-500">plants placed</div>
          <div className="text-xs text-gray-400 mt-1">{totalSqFt} sq ft</div>
        </div>
      </div>

      {/* Plant Chips */}
      {topPlants.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {topPlants.map((p, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-50 text-xs text-green-700 border border-green-200"
            >
              <span>{p.icon}</span>
              <span className="max-w-[80px] truncate">{p.name}</span>
              {p.count > 1 && <span className="text-green-500">x{p.count}</span>}
            </span>
          ))}
          {remainingCount > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-100 text-xs text-gray-500">
              +{remainingCount} more
            </span>
          )}
        </div>
      )}

      {/* View Button */}
      <button
        className="w-full mt-auto px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-xl transition-colors"
      >
        View Bed
      </button>
    </div>
  );
};

export default BedSummaryCard;
