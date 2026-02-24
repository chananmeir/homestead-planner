/**
 * Plant ID Alias Resolver
 *
 * Maps deprecated/variety-specific plant IDs to canonical plant IDs.
 * This allows old seed_inventory records to work with the current plant database
 * until data migration is complete.
 *
 * Usage:
 *   import { resolveAlias, getPlantById } from './plantIdResolver';
 *   const canonicalId = resolveAlias('chia-white'); // returns 'chia-1'
 *   const plant = getPlantById('chia-white'); // returns plant with id 'chia-1'
 */

import { PLANT_DATABASE } from '../data/plantDatabase';
import { Plant } from '../types';

/**
 * Alias map: deprecated plant_id -> canonical plant_id
 *
 * Add entries here when:
 * 1. A variety-specific ID needs to map to a canonical base ID
 * 2. A plant ID was renamed and old data still references the old ID
 *
 * After running data migration to update seed_inventory rows,
 * entries can be removed from this map.
 */
export const PLANT_ID_ALIASES: Record<string, string> = {
  // Variety-specific IDs -> canonical IDs
  'chia-white': 'chia-1',

  // Add more aliases as needed:
  // 'old-plant-id': 'new-canonical-id',
};

/**
 * Resolve a plant_id alias to its canonical ID.
 * Returns the original ID if no alias exists.
 */
export function resolveAlias(plantId: string): string {
  return PLANT_ID_ALIASES[plantId] ?? plantId;
}

/**
 * Get a plant by ID, with alias resolution.
 * First checks if the plantId is an alias, then looks up the canonical ID.
 *
 * @param plantId - The plant ID (may be deprecated/aliased)
 * @returns The Plant object, or undefined if not found
 */
export function getPlantById(plantId: string): Plant | undefined {
  const canonicalId = resolveAlias(plantId);
  return PLANT_DATABASE.find(p => p.id === canonicalId);
}

/**
 * Check if a plant ID is deprecated (has an alias).
 */
export function isDeprecatedPlantId(plantId: string): boolean {
  return plantId in PLANT_ID_ALIASES;
}

/**
 * Get all deprecated plant IDs that map to a canonical ID.
 */
export function getAliasesForCanonicalId(canonicalId: string): string[] {
  return Object.entries(PLANT_ID_ALIASES)
    .filter(([_, canonical]) => canonical === canonicalId)
    .map(([deprecated, _]) => deprecated);
}
