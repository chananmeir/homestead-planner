/**
 * Plant Utilities - Helper functions for plant name parsing and variety management
 *
 * Handles extraction of crop names and varieties from plant names in format:
 * "CropName (Variety)" or "CropName"
 */

import { Plant } from '../types';

/**
 * Extracts the base crop name from a plant name with variety.
 *
 * @param plantName - Full plant name (e.g., "Tomato (Beefsteak)")
 * @returns Base crop name (e.g., "Tomato")
 *
 * @example
 * extractCropName("Tomato (Beefsteak)") // "Tomato"
 * extractCropName("Basil") // "Basil"
 * extractCropName("Watermelon (Sugar Baby)") // "Watermelon"
 */
export const extractCropName = (plantName: string): string => {
  return plantName.split('(')[0].trim();
};

/**
 * Extracts the variety from a plant name.
 *
 * @param plantName - Full plant name (e.g., "Tomato (Beefsteak)")
 * @returns Variety name or null if no variety
 *
 * @example
 * extractVariety("Tomato (Beefsteak)") // "Beefsteak"
 * extractVariety("Basil") // null
 * extractVariety("Watermelon (Sugar Baby)") // "Sugar Baby"
 */
export const extractVariety = (plantName: string): string | null => {
  const match = plantName.match(/\(([^)]+)\)/);
  return match ? match[1] : null;
};

/**
 * Groups plants by their crop name (base name without variety).
 *
 * @param plants - Array of Plant objects
 * @returns Map where keys are crop names and values are arrays of matching plants
 *
 * @example
 * groupPlantsByCrop([
 *   { name: "Tomato (Beefsteak)", ... },
 *   { name: "Tomato (Cherry)", ... },
 *   { name: "Basil", ... }
 * ])
 * // Returns Map {
 * //   "Tomato" => [{ name: "Tomato (Beefsteak)", ... }, { name: "Tomato (Cherry)", ... }],
 * //   "Basil" => [{ name: "Basil", ... }]
 * // }
 */
export const groupPlantsByCrop = (plants: Plant[]): Map<string, Plant[]> => {
  const cropMap = new Map<string, Plant[]>();

  plants.forEach(plant => {
    const cropName = extractCropName(plant.name);
    if (!cropMap.has(cropName)) {
      cropMap.set(cropName, []);
    }
    cropMap.get(cropName)!.push(plant);
  });

  return cropMap;
};

/**
 * Returns a representative plant for a group of variety plants.
 * Uses the first plant but replaces the name with the crop name only.
 *
 * @param plants - Array of plants with the same crop name
 * @returns A representative Plant object with crop name (no variety)
 *
 * @example
 * getRepresentativePlant([
 *   { id: 'tomato-1', name: "Tomato (Beefsteak)", ... },
 *   { id: 'tomato-2', name: "Tomato (Cherry)", ... }
 * ])
 * // Returns { id: 'tomato-1', name: "Tomato", ... }
 */
export const getRepresentativePlant = (plants: Plant[]): Plant => {
  if (plants.length === 0) {
    throw new Error('Cannot get representative plant from empty array');
  }

  // Use first plant as base, but strip variety from name
  const representative = { ...plants[0] };
  representative.name = extractCropName(representative.name);

  return representative;
};

/**
 * Finds a specific plant by crop name and variety.
 *
 * @param cropName - Base crop name (e.g., "Tomato")
 * @param variety - Variety name (e.g., "Beefsteak") or null for generic
 * @param plants - Array of all plants to search
 * @returns Matching Plant object or undefined if not found
 *
 * @example
 * findPlantByVariety("Tomato", "Beefsteak", allPlants)
 * // Returns { id: 'tomato-beefsteak', name: "Tomato (Beefsteak)", ... }
 *
 * findPlantByVariety("Tomato", null, allPlants)
 * // Returns first Tomato plant (generic)
 */
export const findPlantByVariety = (
  cropName: string,
  variety: string | null | undefined,
  plants: Plant[]
): Plant | undefined => {
  // Filter to plants matching the crop name
  const cropPlants = plants.filter(p => extractCropName(p.name) === cropName);

  if (cropPlants.length === 0) {
    return undefined;
  }

  // If no variety specified, return first plant (generic)
  if (!variety || variety.trim() === '') {
    return cropPlants[0];
  }

  // Find plant matching the variety
  const matchingPlant = cropPlants.find(p => {
    const plantVariety = extractVariety(p.name);
    return plantVariety === variety;
  });

  // If no exact match, return first plant (fallback to generic)
  return matchingPlant || cropPlants[0];
};

/**
 * Gets all variety options for a given crop name.
 *
 * @param cropName - Base crop name (e.g., "Tomato")
 * @param plants - Array of all plants to search
 * @returns Array of variety option objects with variety name and plant ID
 *
 * @example
 * getVarietyOptions("Tomato", allPlants)
 * // Returns [
 * //   { variety: "Beefsteak", plantId: "tomato-beefsteak", plant: {...} },
 * //   { variety: "Cherry", plantId: "tomato-cherry", plant: {...} },
 * //   { variety: "Generic", plantId: "tomato-1", plant: {...} }
 * // ]
 */
export interface VarietyOption {
  variety: string;
  plantId: string;
  plant: Plant;
}

export const getVarietyOptions = (cropName: string, plants: Plant[]): VarietyOption[] => {
  const cropPlants = plants.filter(p => extractCropName(p.name) === cropName);

  const options: VarietyOption[] = cropPlants.map(p => ({
    variety: extractVariety(p.name) || 'Generic',
    plantId: p.id,
    plant: p
  }));

  // Sort alphabetically, but put "Generic" first if it exists
  options.sort((a, b) => {
    if (a.variety === 'Generic') return -1;
    if (b.variety === 'Generic') return 1;
    return a.variety.localeCompare(b.variety);
  });

  return options;
};

/**
 * Checks if a plant name matches a search term (crop name or variety).
 *
 * @param plantName - Full plant name (e.g., "Tomato (Beefsteak)")
 * @param searchTerm - Search query
 * @returns True if crop name or variety matches the search term
 *
 * @example
 * matchesSearch("Tomato (Beefsteak)", "tomato") // true
 * matchesSearch("Tomato (Beefsteak)", "beef") // true
 * matchesSearch("Tomato (Beefsteak)", "lettuce") // false
 */
export const matchesSearch = (plantName: string, searchTerm: string): boolean => {
  const lowerSearch = searchTerm.toLowerCase();
  const lowerPlantName = plantName.toLowerCase();

  // Check full name
  if (lowerPlantName.includes(lowerSearch)) {
    return true;
  }

  // Check crop name
  const cropName = extractCropName(plantName);
  if (cropName.toLowerCase().includes(lowerSearch)) {
    return true;
  }

  // Check variety
  const variety = extractVariety(plantName);
  if (variety && variety.toLowerCase().includes(lowerSearch)) {
    return true;
  }

  return false;
};
