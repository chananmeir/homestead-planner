/**
 * Types specific to GardenDesigner and its sub-components.
 * Extracted from GardenDesigner.tsx to reduce component size.
 */

import { PlantedItem, GardenBed, Plant, PlantingEvent } from '../../types';
import { FuturePlantingPosition } from './FuturePlantingsOverlay';

export interface GardenDesignerProps {
  initialBedId?: number | null;
  initialDate?: string | null;
  transplantSeedStartId?: number | null;
  onTransplantComplete?: () => void;
  plantingEventId?: number | null;
  onPlantingComplete?: () => void;
}

export interface HoverInfo {
  gridX: number;
  gridY: number;
  svgX: number;
  svgY: number;
  bedId: number;
  currentPlants: { plantId: string; variety?: string; status: string }[];
  futurePlants: { plantId: string; variety?: string; plantingDate: string }[];
}

export interface SelectedPlantedCell {
  item: PlantedItem;
  bed: GardenBed;
  plant: Plant | undefined;
  futureEvents: PlantingEvent[];
  clickX: number;
  clickY: number;
}

export interface SelectedFutureCell {
  position: FuturePlantingPosition;
  bed: GardenBed;
  futurePlantedItems: PlantedItem[];
  clickX: number;
  clickY: number;
}

export interface PendingPlant {
  cropName: string;
  position: { x: number; y: number } | null;
  bedId: number;
  sourcePlanItemId?: number;
  initialVariety?: string;
}

export interface RemoveAllByPlantConfirm {
  plantId: string;
  variety?: string;
  count: number;
  plantName: string;
}

export interface DraggedPlantedItem {
  plantedItem: PlantedItem;
  sourceBed: GardenBed;
  isDuplication: boolean;
}
