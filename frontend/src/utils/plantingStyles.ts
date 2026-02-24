import { PlantingStyle } from '../types';

// Re-export PlantingStyle for convenience
export type { PlantingStyle };

export interface PlantingStyleDefinition {
  id: PlantingStyle;
  label: string;
  description: string;
  idealFor: string;
}

export const PLANTING_STYLES: Record<PlantingStyle, PlantingStyleDefinition> = {
  grid: {
    id: 'grid',
    label: 'Grid Placement',
    description: 'Individual plants in grid pattern',
    idealFor: 'Fruiting crops, transplants, large plants'
  },
  row: {
    id: 'row',
    label: 'Row Placement',
    description: 'Individual plants in rows',
    idealFor: 'Traditional row gardens, mechanical cultivation'
  },
  broadcast: {
    id: 'broadcast',
    label: 'Broadcast/Scatter',
    description: 'Seeds scattered densely over area',
    idealFor: 'Greens, cover crops, small seeds, intensive harvest'
  },
  dense_patch: {
    id: 'dense_patch',
    label: 'Dense Patch',
    description: 'Closely spaced plants in defined area',
    idealFor: 'Carrots, radishes, intensive spacing methods'
  },
  plant_spacing: {
    id: 'plant_spacing',
    label: 'Plant Spacing',
    description: 'Plants at specific spacing intervals',
    idealFor: 'Custom spacing requirements, specialty crops'
  },
  trellis_linear: {
    id: 'trellis_linear',
    label: 'Trellis Linear',
    description: 'Plants in line along trellis or support',
    idealFor: 'Vining crops, vertical growing, space-saving'
  }
};

/**
 * Get the default planting style for a planning method
 */
export function getMethodDefaultStyle(planningMethod: string): PlantingStyle {
  const defaults: Record<string, PlantingStyle> = {
    'square-foot': 'grid',
    'row': 'row',
    'intensive': 'dense_patch',
    'migardener': 'row',
    'raised-bed': 'grid',
    'permaculture': 'grid',
    'container': 'grid'
  };
  return defaults[planningMethod] || 'grid';
}

/**
 * Determine the effective planting style for a plant placement
 * Uses a fallback chain:
 * 1. User override (explicit selection)
 * 2. Plant metadata (migardener.plantingStyle)
 * 3. Bed default (bed.defaultPlantingStyle) - Phase 2 feature
 * 4. Method default (hardcoded mapping)
 */
export function getEffectivePlantingStyle(
  plant: any,
  bed: any | null,
  userOverride?: PlantingStyle
): PlantingStyle {
  // Priority 1: User override
  if (userOverride) {
    return userOverride;
  }

  // Priority 2: Plant metadata (map agronomic style → UI PlantingStyle)
  if (plant?.migardener?.plantingStyle) {
    const agronomicToUI: Record<string, PlantingStyle> = {
      'row_based': 'row',
      'broadcast': 'broadcast',
      'dense_patch': 'dense_patch',
      'plant_spacing': 'plant_spacing',
      'trellis_linear': 'trellis_linear',
    };
    return agronomicToUI[plant.migardener.plantingStyle] || 'grid';
  }

  // Priority 3: Bed default (Phase 2 - optional)
  if (bed?.defaultPlantingStyle) {
    return bed.defaultPlantingStyle as PlantingStyle;
  }

  // Priority 4: Method default
  return getMethodDefaultStyle(bed?.planningMethod || 'square-foot');
}

/**
 * Check if a planting style requires seed density input
 */
export function requiresSeedDensity(style: PlantingStyle): boolean {
  return ['broadcast', 'dense_patch', 'plant_spacing'].includes(style);
}

/**
 * Get context-appropriate terminology for quantity input based on planting style
 */
export function getQuantityTerminology(style: PlantingStyle): {
  unitLabel: string;       // "Squares", "Rows", "Patches", etc.
  totalLabel: string;      // "Total Plants", "Total Coverage", etc.
  helpText: string;        // Contextual help text
} {
  const terminology: Record<PlantingStyle, { unitLabel: string; totalLabel: string; helpText: string }> = {
    grid: {
      unitLabel: 'Squares',
      totalLabel: 'Total Plants',
      helpText: 'Each square can hold multiple plants based on spacing'
    },
    row: {
      unitLabel: 'Rows',
      totalLabel: 'Total Plants',
      helpText: 'Plants will be arranged in horizontal rows'
    },
    broadcast: {
      unitLabel: 'Patches',
      totalLabel: 'Coverage Area (sq ft)',
      helpText: 'Seeds will be scattered densely over the selected area'
    },
    dense_patch: {
      unitLabel: 'Patches',
      totalLabel: 'Total Plants',
      helpText: 'Plants will be densely packed in defined patches'
    },
    plant_spacing: {
      unitLabel: 'Spots',
      totalLabel: 'Total Plants',
      helpText: 'Each spot will have multiple seeds, thinned to desired count'
    },
    trellis_linear: {
      unitLabel: 'Linear Feet',
      totalLabel: 'Total Plants',
      helpText: 'Plants will be spaced along the trellis support'
    }
  };

  // Return the terminology for the style, or default to 'grid' if not found
  return terminology[style] || terminology.grid;
}
