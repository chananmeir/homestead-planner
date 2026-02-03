import React from 'react';
import { CropReadinessMap } from './types';
import { PlantingCalendar } from '../../../types';

interface ReadinessIndicatorProps {
  cropReadiness: CropReadinessMap;
  plantingEvents: PlantingCalendar[];
}

const ReadinessIndicator: React.FC<ReadinessIndicatorProps> = ({
  cropReadiness,
  plantingEvents
}) => {
  // Get unique plant IDs from planting events (filter out non-planting events)
  const plantedCropIds = Array.from(
    new Set(plantingEvents.map(event => event.plantId).filter((id): id is string => id !== undefined))
  );

  // Filter readiness data to only include planted crops
  const relevantCrops = plantedCropIds
    .map(plantId => ({
      plantId,
      readiness: cropReadiness[plantId]
    }))
    .filter(crop => crop.readiness !== undefined);

  // Group by readiness status
  const ready = relevantCrops.filter(c => c.readiness.status === 'ready');
  const marginal = relevantCrops.filter(c => c.readiness.status === 'marginal');
  const tooCold = relevantCrops.filter(c => c.readiness.status === 'too_cold');

  // If no planting events, show message
  if (plantingEvents.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>No planting events yet. Add crops to see planting readiness.</p>
      </div>
    );
  }

  // If no crops have soil temp data, show message
  if (relevantCrops.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>Soil temperature data not available for your crops.</p>
      </div>
    );
  }

  const CropBadge: React.FC<{ plantId: string; name: string; minTemp: number; status: string }> = ({
    name,
    minTemp,
    status
  }) => {
    let bgColor = '';
    let textColor = '';
    let icon = '';

    switch (status) {
      case 'ready':
        bgColor = 'bg-green-100';
        textColor = 'text-green-800';
        icon = '✓';
        break;
      case 'marginal':
        bgColor = 'bg-yellow-100';
        textColor = 'text-yellow-800';
        icon = '⚠';
        break;
      case 'too_cold':
        bgColor = 'bg-red-100';
        textColor = 'text-red-800';
        icon = '✗';
        break;
    }

    return (
      <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm ${bgColor} ${textColor} m-1`}>
        <span className="mr-1">{icon}</span>
        <span className="font-medium">{name}</span>
        <span className="ml-2 text-xs opacity-75">{minTemp}°F min</span>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Ready to Plant */}
      {ready.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-green-700 mb-2 flex items-center">
            <span className="w-3 h-3 bg-green-500 rounded-full mr-2"></span>
            Ready to Plant ({ready.length})
          </h4>
          <div className="flex flex-wrap">
            {ready.map(crop => (
              <CropBadge
                key={crop.plantId}
                plantId={crop.plantId}
                name={crop.readiness.name}
                minTemp={crop.readiness.min_temp}
                status="ready"
              />
            ))}
          </div>
        </div>
      )}

      {/* Marginal */}
      {marginal.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-yellow-700 mb-2 flex items-center">
            <span className="w-3 h-3 bg-yellow-500 rounded-full mr-2"></span>
            Marginal - Wait for Warmer Weather ({marginal.length})
          </h4>
          <div className="flex flex-wrap">
            {marginal.map(crop => (
              <CropBadge
                key={crop.plantId}
                plantId={crop.plantId}
                name={crop.readiness.name}
                minTemp={crop.readiness.min_temp}
                status="marginal"
              />
            ))}
          </div>
        </div>
      )}

      {/* Too Cold */}
      {tooCold.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-red-700 mb-2 flex items-center">
            <span className="w-3 h-3 bg-red-500 rounded-full mr-2"></span>
            Too Cold - Do Not Plant ({tooCold.length})
          </h4>
          <div className="flex flex-wrap">
            {tooCold.map(crop => (
              <CropBadge
                key={crop.plantId}
                plantId={crop.plantId}
                name={crop.readiness.name}
                minTemp={crop.readiness.min_temp}
                status="too_cold"
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ReadinessIndicator;
