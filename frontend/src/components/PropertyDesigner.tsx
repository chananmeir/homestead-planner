import React, { useState, useEffect } from 'react';
import { DndContext, DragStartEvent, DragEndEvent, DragMoveEvent, DragOverlay, useSensor, useSensors, PointerSensor, useDraggable, useDroppable } from '@dnd-kit/core';
import { PropertyFormModal } from './PropertyDesigner/PropertyFormModal';
import { StructureFormModal } from './PropertyDesigner/StructureFormModal';
import { TrellisManager } from './PropertyDesigner/TrellisManager';
import { ConfirmDialog, useToast } from './common';
import PlantIcon, { PlantIconSVG } from './common/PlantIcon';
import StructureIcon, { StructureIconSVG } from './common/StructureIcon';
import { apiGet, apiPost, apiPut, apiDelete } from '../utils/api';
import { Plant, TrellisStructure } from '../types';
interface Property {
  id: number;
  name: string;
  width: number;
  length: number;
  address?: string;
  latitude?: number;
  longitude?: number;
  zone?: string;
  soilType?: string;
  slope?: string;
  notes?: string;
  placedStructures?: PlacedStructure[];
}

interface PlacedStructure {
  id: number;
  structureId: string;
  name: string;
  positionX: number;
  positionY: number;
  rotation: number;
  cost?: number;
  notes?: string;
  customWidth?: number;  // For trees: canopy diameter in feet
  customLength?: number; // For trees: canopy diameter in feet
  shapeType?: string;    // 'circle' for trees, 'rectangle' for structures
}

interface Structure {
  id: string;
  name: string;
  category: string;
  width: number;
  length: number;
  description?: string;
  icon?: string;
  cost?: number;
  shapeType?: string;  // 'circle' for trees
}

interface TreeNutrition {
  totals: {
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
  };
  by_tree_type: Record<string, {
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
  }>;
  tree_summary: Array<{
    tree_type: string;
    count: number;
    annual_yield_lbs: number;
  }>;
  year: number;
}

// Constants
const PROPERTY_SCALE = 10; // pixels per foot
const GRID_SNAP_SPACING = 1; // feet - snap precision for structure placement
const DRAG_THRESHOLD = 5; // pixels - minimum movement to trigger drag

const GRID_CONFIG = {
  minor: { spacing: 1, stroke: "#e5e5e5", width: 0.5, opacity: 0.3, dash: "2,2" },
  major: { spacing: 10, stroke: "#cccccc", width: 1, opacity: 0.5, dash: "4,4" },
  superMajor: { spacing: 50, stroke: "#999999", width: 1.5, opacity: 0.7, dash: "none" }
} as const;

// Coordinate Display Component
const CoordinateDisplay: React.FC<{
  dragCursorPosition: {x: number, y: number} | null;
  draggedStructure: Structure | null;
}> = ({ dragCursorPosition, draggedStructure }) => {
  if (!dragCursorPosition || !draggedStructure) return null;

  const mapElement = document.getElementById('property-map-svg');
  if (!mapElement) return null;

  const rect = mapElement.getBoundingClientRect();
  const rawX = (dragCursorPosition.x - rect.left) / PROPERTY_SCALE;
  const rawY = (dragCursorPosition.y - rect.top) / PROPERTY_SCALE;

  // Clamp to valid range and round
  const x = Math.max(0, Math.round(rawX));
  const y = Math.max(0, Math.round(rawY));

  return (
    <div
      className="fixed pointer-events-none bg-black bg-opacity-75 text-white px-3 py-2 rounded text-sm font-mono z-50"
      style={{
        left: dragCursorPosition.x + 15,
        top: dragCursorPosition.y - 40
      }}
    >
      <div>X: {x}' Y: {y}'</div>
      <div className="text-xs opacity-75">{draggedStructure.name}</div>
    </div>
  );
};

const PropertyDesigner: React.FC = () => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [structures, setStructures] = useState<Structure[]>([]);
  const [treePlants, setTreePlants] = useState<Plant[]>([]);  // Fruit and nut trees
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [isStructureModalOpen, setIsStructureModalOpen] = useState(false);
  const [isTrellisManagerOpen, setIsTrellisManagerOpen] = useState(false);
  const [trellises, setTrellises] = useState<TrellisStructure[]>([]);
  const [draggedStructure, setDraggedStructure] = useState<Structure | null>(null);
  const [dragCursorPosition, setDragCursorPosition] = useState<{x: number, y: number} | null>(null);
  const [editingStructure, setEditingStructure] = useState<PlacedStructure | null>(null);
  const [draggingPlacedStructure, setDraggingPlacedStructure] = useState<{
    structure: PlacedStructure;
    startX: number;
    startY: number;
    offsetX: number;
    offsetY: number;
    initialMouseX: number;
    initialMouseY: number;
    isDragging: boolean;
  } | null>(null);
  const [dragValidation, setDragValidation] = useState<{
    isValid: boolean;
    isContained: boolean;
    conflicts: string[];
  } | null>(null);
  const [showGrid, setShowGrid] = useState(true);
  const [showMinorGridToggle, setShowMinorGridToggle] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    propertyId: number | null;
    propertyName: string;
  }>({
    isOpen: false,
    propertyId: null,
    propertyName: '',
  });
  const [treeNutritionData, setTreeNutritionData] = useState<TreeNutrition | null>(null);
  const [treeNutritionLoading, setTreeNutritionLoading] = useState(false);
  const { showSuccess, showError } = useToast();

  // Configure drag sensor
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement required to start drag
      },
    })
  );

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedProperty) {
      loadTrellises();
      loadTreeNutrition();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProperty]);

  const loadTrellises = async () => {
    if (!selectedProperty) return;
    try {
      const response = await apiGet(`/api/trellis-structures?propertyId=${selectedProperty.id}`);
      if (response.ok) {
        const data = await response.json();
        setTrellises(data);
      }
    } catch (error) {
      console.error('Failed to load trellises:', error);
    }
  };

  const loadTreeNutrition = async () => {
    try {
      setTreeNutritionLoading(true);
      const response = await apiGet('/api/nutrition/trees');
      if (response.ok) {
        const data = await response.json();
        setTreeNutritionData(data);
      }
    } catch (error) {
      console.error('Failed to load tree nutrition data:', error);
      // Silently fail - nutrition is optional enhancement
    } finally {
      setTreeNutritionLoading(false);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);

      // Load properties
      const propResponse = await apiGet('/api/properties');
      if (!propResponse.ok) {
        throw new Error('Failed to fetch properties');
      }
      const propData = await propResponse.json();
      setProperties(propData);

      // Load structures
      const structResponse = await apiGet('/api/structures');
      if (!structResponse.ok) {
        throw new Error('Failed to fetch structures');
      }
      const structData = await structResponse.json();
      setStructures(structData.structures || []);

      // Load trees (fruit and nut category plants)
      const plantsResponse = await apiGet('/api/plants');
      if (plantsResponse.ok) {
        const plantsData = await plantsResponse.json();
        const trees = plantsData.filter((p: Plant) =>
          p.category === 'fruit' || p.category === 'nut'
        );
        setTreePlants(trees);
      }

      // Select first property by default
      if (propData.length > 0) {
        setSelectedProperty(propData[0]);
      }
    } catch (error) {
      showError('Failed to load property data. Please refresh the page.');
    } finally {
      setLoading(false);
    }
  };

  // Helper function to check if a structure is a tree and get yield info
  const getTreeYieldInfo = (structureId: string): { isTree: boolean; yieldInfo?: { annual_yield_lbs: number } } => {
    if (!structureId.startsWith('tree-') || !treeNutritionData) {
      return { isTree: false };
    }

    // Extract tree type from structure_id (e.g., 'tree-apple' -> 'apple')
    const treeType = structureId.replace('tree-', '');

    // Find yield info in tree summary
    const treeSummary = treeNutritionData.tree_summary.find(t => t.tree_type === treeType);

    if (treeSummary && treeSummary.count > 0) {
      return {
        isTree: true,
        yieldInfo: {
          annual_yield_lbs: treeSummary.annual_yield_lbs / treeSummary.count // Average per tree
        }
      };
    }

    return { isTree: true }; // Is a tree but no yield data yet
  };

  // Collision detection rules - mirrors backend collision_rules.py
  const COLLISION_RULES: Record<string, {
    is_container: boolean;
    allowed_children?: string[];
    can_overlap: string[] | '*';
    must_not_overlap: string[];
  }> = {
    'ground-covering': {
      // Mulch, gravel, grass, hardscape - renders below all other structures
      is_container: false,
      can_overlap: '*',  // Special: can overlap with everything (like infrastructure)
      must_not_overlap: []
    },
    structures: {
      is_container: true,
      allowed_children: ['garden', 'compost', 'water'],
      can_overlap: ['infrastructure', 'ground-covering'],
      must_not_overlap: ['structures', 'livestock', 'storage', 'orchard']
    },
    garden: {
      is_container: false,
      can_overlap: ['infrastructure'],
      must_not_overlap: ['garden', 'livestock', 'storage', 'compost', 'water', 'orchard']
    },
    livestock: {
      is_container: false,
      can_overlap: ['infrastructure'],
      must_not_overlap: ['livestock', 'garden', 'storage', 'compost', 'water', 'orchard']
    },
    storage: {
      is_container: false,
      can_overlap: ['infrastructure'],
      must_not_overlap: ['storage', 'garden', 'livestock', 'compost', 'water', 'orchard']
    },
    compost: {
      is_container: false,
      can_overlap: ['infrastructure'],
      must_not_overlap: ['compost', 'garden', 'livestock', 'storage', 'water', 'orchard']
    },
    water: {
      is_container: false,
      can_overlap: ['infrastructure'],
      must_not_overlap: ['water', 'garden', 'livestock', 'storage', 'compost', 'orchard']
    },
    orchard: {
      is_container: false,
      can_overlap: ['infrastructure'],
      must_not_overlap: ['orchard', 'garden', 'livestock', 'storage', 'compost', 'water']
    },
    infrastructure: {
      is_container: false,
      can_overlap: '*',
      must_not_overlap: []
    }
  };

  // Collision detection helper functions
  const checkAABBCollision = (
    structA: { x: number; y: number; width: number; height: number },
    structB: { x: number; y: number; width: number; height: number }
  ): boolean => {
    return (
      structA.x < structB.x + structB.width &&
      structA.x + structA.width > structB.x &&
      structA.y < structB.y + structB.height &&
      structA.y + structA.height > structB.y
    );
  };

  const checkFullContainment = (
    container: { x: number; y: number; width: number; height: number },
    inner: { x: number; y: number; width: number; height: number }
  ): boolean => {
    return (
      inner.x >= container.x &&
      inner.y >= container.y &&
      inner.x + inner.width <= container.x + container.width &&
      inner.y + inner.height <= container.y + container.height
    );
  };

  const isContainer = (category: string): boolean => {
    const rules = COLLISION_RULES[category];
    return rules?.is_container || false;
  };

  const canOverlap = (categoryA: string, categoryB: string): boolean => {
    // Infrastructure and ground-covering special cases - can overlap with anything
    if (categoryA === 'infrastructure' || categoryB === 'infrastructure') {
      return true;
    }
    if (categoryA === 'ground-covering' || categoryB === 'ground-covering') {
      return true;
    }

    const rulesA = COLLISION_RULES[categoryA];
    if (!rulesA) {
      // Unknown category - default to no overlap with same category
      return categoryA !== categoryB;
    }

    // Check if categoryA explicitly allows overlap with categoryB
    const canOverlapList = rulesA.can_overlap;
    if (canOverlapList === '*' || (Array.isArray(canOverlapList) && canOverlapList.includes(categoryB))) {
      return true;
    }

    // Check if categoryA must not overlap with categoryB
    if (rulesA.must_not_overlap.includes(categoryB)) {
      return false;
    }

    // Default: different categories can overlap unless explicitly forbidden
    return categoryA !== categoryB;
  };

  const canContain = (containerCategory: string, childCategory: string): boolean => {
    if (!isContainer(containerCategory)) {
      return false;
    }

    const rules = COLLISION_RULES[containerCategory];
    const allowedChildren = rules?.allowed_children || [];
    return allowedChildren.includes(childCategory);
  };

  const validateStructurePlacement = (
    newStructure: { structureId: string; x: number; y: number; id?: number },
    existingStructures: PlacedStructure[],
    allStructures: Structure[]
  ): { isValid: boolean; isContained: boolean; conflicts: string[] } => {
    const conflicts: string[] = [];
    let isContained = false;

    const newStructDef = allStructures.find(s => s.id === newStructure.structureId);
    if (!newStructDef) {
      return { isValid: false, isContained: false, conflicts: ['Unknown structure type'] };
    }

    const newBounds = {
      x: newStructure.x,
      y: newStructure.y,
      width: newStructDef.width,
      height: newStructDef.length
    };

    for (const existing of existingStructures) {
      // Skip self when editing
      if (newStructure.id && existing.id === newStructure.id) {
        continue;
      }

      const existingDef = allStructures.find(s => s.id === existing.structureId);
      if (!existingDef) continue;

      const existingBounds = {
        x: existing.positionX,
        y: existing.positionY,
        width: existingDef.width,
        height: existingDef.length
      };

      const hasOverlap = checkAABBCollision(newBounds, existingBounds);
      if (!hasOverlap) continue;

      // Check if new structure is inside a container
      if (isContainer(existingDef.category)) {
        if (checkFullContainment(existingBounds, newBounds)) {
          if (canContain(existingDef.category, newStructDef.category)) {
            isContained = true; // Valid containment
            continue;
          } else {
            conflicts.push(`${existingDef.name} cannot contain ${newStructDef.name}`);
          }
        } else {
          conflicts.push(`Must be fully inside or outside ${existing.name || existingDef.name}`);
        }
        continue;
      }

      // Check if new structure is a container
      if (isContainer(newStructDef.category)) {
        if (checkFullContainment(newBounds, existingBounds)) {
          if (canContain(newStructDef.category, existingDef.category)) {
            continue; // Valid: will contain existing structure
          } else {
            conflicts.push(`${newStructDef.name} cannot contain ${existingDef.name}`);
          }
        } else {
          conflicts.push(`Must fully contain or avoid ${existing.name || existingDef.name}`);
        }
        continue;
      }

      // Check regular structure overlap rules
      if (!canOverlap(newStructDef.category, existingDef.category)) {
        conflicts.push(`Overlaps with ${existing.name || existingDef.name}`);
      }
    }

    return {
      isValid: conflicts.length === 0,
      isContained,
      conflicts
    };
  };

  // Tree-specific validation (circle collision detection)
  const validateTreePlacement = (
    plant: Plant,
    x: number,
    y: number,
    property: Property
  ): { isContained: boolean; conflicts: string[] } => {
    const conflicts: string[] = [];
    const radius = (plant.spacing / 12) / 2; // Convert inches to feet, then get radius

    // Check boundaries - ensure entire circle is within property
    const isContained = (
      x - radius >= 0 &&
      x + radius <= property.width &&
      y - radius >= 0 &&
      y + radius <= property.length
    );

    if (!isContained) {
      conflicts.push(`Tree canopy would extend beyond property boundaries`);
    }

    // Check tree-to-tree and tree-to-structure conflicts
    property.placedStructures?.forEach(placed => {
      const existingStructure = structures.find(s => s.id === placed.structureId);

      // Check if existing item is also a tree (circle)
      if (placed.shapeType === 'circle' && placed.customWidth) {
        const existingRadius = placed.customWidth / 2;
        const distance = Math.sqrt(
          Math.pow(placed.positionX - x, 2) +
          Math.pow(placed.positionY - y, 2)
        );
        const minDistance = radius + existingRadius;

        if (distance < minDistance) {
          conflicts.push(`Tree would overlap with ${placed.name}`);
        }
      } else if (existingStructure) {
        // Check collision with rectangular structures (simplified AABB vs circle)
        const structBounds = {
          x: placed.positionX,
          y: placed.positionY,
          width: existingStructure.width,
          height: existingStructure.length
        };

        // Find closest point on rectangle to circle center
        const closestX = Math.max(structBounds.x, Math.min(x, structBounds.x + structBounds.width));
        const closestY = Math.max(structBounds.y, Math.min(y, structBounds.y + structBounds.height));

        const distance = Math.sqrt(
          Math.pow(x - closestX, 2) +
          Math.pow(y - closestY, 2)
        );

        if (distance < radius) {
          conflicts.push(`Tree would overlap with ${placed.name || existingStructure.name}`);
        }
      }
    });

    return { isContained, conflicts };
  };

  const handleEdit = (property: Property) => {
    setSelectedProperty(property);
    setModalMode('edit');
    setIsModalOpen(true);
  };

  const handleDeleteClick = (property: Property) => {
    setDeleteConfirm({
      isOpen: true,
      propertyId: property.id,
      propertyName: property.name,
    });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm.propertyId) return;

    try {
      const response = await apiDelete(`/api/properties/${deleteConfirm.propertyId}`);

      if (response.ok) {
        showSuccess(`Property "${deleteConfirm.propertyName}" deleted successfully!`);

        // Clear selection if deleted property was selected
        if (selectedProperty?.id === deleteConfirm.propertyId) {
          setSelectedProperty(null);
        }

        // Reload properties list
        loadData();
      } else {
        showError('Failed to delete property');
      }
    } catch (error) {
      console.error('Error deleting property:', error);
      showError('Network error occurred');
    } finally {
      setDeleteConfirm({ isOpen: false, propertyId: null, propertyName: '' });
    }
  };

  // Drag and Drop handlers
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const data = active.data.current;

    // Check if dragging a tree or a structure
    if (data?.type === 'tree') {
      const plant = data.plant as Plant;

      // Convert plant to structure-like format for rendering
      const treeStructure: Structure = {
        id: plant.id,
        name: plant.name,
        category: 'orchard',
        width: plant.spacing / 12,  // inches to feet
        length: plant.spacing / 12,
        icon: plant.icon,
        shapeType: 'circle'
      };

      setDraggedStructure(treeStructure);
    } else {
      // Existing structure drag logic
      const structure = event.active.data.current?.structure;
      setDraggedStructure(structure || null);
    }
  };

  const handleDragMove = (event: DragMoveEvent) => {
    // Track the cursor position during drag for accurate drop placement
    if (event.delta) {
      const activeEvent = event.activatorEvent as PointerEvent;
      if (activeEvent) {
        setDragCursorPosition({
          x: activeEvent.clientX + event.delta.x,
          y: activeEvent.clientY + event.delta.y
        });
      }
    }
  };

  const saveStructureImmediately = async (structure: Structure, x: number, y: number) => {
    if (!selectedProperty) return;

    try {
      const payload = {
        propertyId: selectedProperty.id,
        structureId: structure.id,
        name: structure.name,
        position: { x, y },
        rotation: 0,
        notes: '',
        cost: structure.cost || null,
        builtDate: null,
      };

      const response = await apiPost('/api/placed-structures', payload);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to place structure');
      }

      showSuccess(`${structure.name} placed! Click to edit details.`);
      loadData(); // Refresh to show new structure on map
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Failed to place structure');
    }
  };

  // Save tree as PlacedStructure and auto-create PlantingEvent
  const saveTreeImmediately = async (plant: Plant, x: number, y: number) => {
    if (!selectedProperty) return;

    try {
      const spacingFeet = plant.spacing / 12;  // Convert inches to feet

      // Create PlacedStructure for the tree
      const placedStructurePayload = {
        property_id: selectedProperty.id,
        structure_id: plant.id,  // Use plant ID as structure ID
        name: plant.name,
        position_x: x,
        position_y: y,
        custom_width: spacingFeet,   // Tree canopy diameter
        custom_length: spacingFeet,  // Tree canopy diameter
        shape_type: 'circle',
        rotation: 0,
        notes: plant.notes?.split('.')[0] || '',  // First sentence of plant notes
      };

      const structureResponse = await apiPost('/api/placed-structures', placedStructurePayload);

      if (!structureResponse.ok) {
        const errorData = await structureResponse.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to place tree');
      }

      const savedStructure = await structureResponse.json();

      // Auto-create PlantingEvent for timeline integration
      await createPlantingEventForTree(plant, x, y);

      showSuccess(`${plant.name} tree placed! Will mature in ${Math.round(plant.daysToMaturity / 365)} years.`);
      loadData(); // Refresh to show new tree on map
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Failed to place tree');
    }
  };

  // Auto-create PlantingEvent when tree is placed (Task 4)
  const createPlantingEventForTree = async (plant: Plant, x: number, y: number) => {
    try {
      const today = new Date().toISOString().split('T')[0];  // YYYY-MM-DD format

      // Calculate expected harvest date
      const harvestDate = new Date();
      harvestDate.setDate(harvestDate.getDate() + plant.daysToMaturity);
      const expectedHarvestDate = harvestDate.toISOString().split('T')[0];

      // Calculate space required (circular area)
      const radiusFeet = (plant.spacing / 12) / 2;
      const spaceRequired = Math.round(Math.PI * radiusFeet * radiusFeet);

      const plantingEventPayload = {
        plant_id: plant.id,
        garden_bed_id: null,  // Property-level (not in a bed)
        position_x: x,
        position_y: y,
        direct_seed_date: today,
        expected_harvest_date: expectedHarvestDate,
        space_required: spaceRequired,
        variety: plant.name,  // Use plant name as variety
        quantity: 1,
        notes: `Tree placed on property at (${x}, ${y})`
      };

      const response = await apiPost('/api/planting-events', plantingEventPayload);

      if (!response.ok) {
        console.error('Failed to create PlantingEvent for tree - tree is still placed');
        // Don't throw - tree placement succeeded, event creation is secondary
      }
    } catch (error) {
      console.error('Error creating PlantingEvent for tree:', error);
      // Don't throw - tree placement succeeded, event creation is secondary
    }
  };

  const handleStructureClick = (placed: PlacedStructure) => {
    // Only open modal if we're not actively dragging (threshold passed)
    if (draggingPlacedStructure?.isDragging) return;

    // Open modal in edit mode with the placed structure data
    setEditingStructure(placed);
    setIsStructureModalOpen(true);
  };

  const handlePlacedStructureMouseDown = (event: React.MouseEvent, placed: PlacedStructure) => {
    event.stopPropagation();
    const mapElement = document.getElementById('property-map-svg');
    if (!mapElement) return;

    const rect = mapElement.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    // Calculate offset from structure's top-left corner
    const structureX = placed.positionX * PROPERTY_SCALE;
    const structureY = placed.positionY * PROPERTY_SCALE;

    // Set initial state but don't start dragging until threshold is passed
    setDraggingPlacedStructure({
      structure: placed,
      startX: placed.positionX,
      startY: placed.positionY,
      offsetX: mouseX - structureX,
      offsetY: mouseY - structureY,
      initialMouseX: event.clientX,
      initialMouseY: event.clientY,
      isDragging: false,
    });
  };

  const handlePlacedStructureMouseMove = (event: React.MouseEvent) => {
    if (!draggingPlacedStructure || !selectedProperty) return;

    // Check if we've moved beyond the threshold to start dragging
    if (!draggingPlacedStructure.isDragging) {
      const deltaX = Math.abs(event.clientX - draggingPlacedStructure.initialMouseX);
      const deltaY = Math.abs(event.clientY - draggingPlacedStructure.initialMouseY);
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

      if (distance < DRAG_THRESHOLD) {
        return; // Haven't moved enough yet
      }

      // Threshold passed, enable dragging
      setDraggingPlacedStructure(prev => prev ? { ...prev, isDragging: true } : null);
    }

    const mapElement = document.getElementById('property-map-svg');
    if (!mapElement) return;

    const rect = mapElement.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    // Calculate new position in feet, accounting for the offset
    const rawX = (mouseX - draggingPlacedStructure.offsetX) / PROPERTY_SCALE;
    const rawY = (mouseY - draggingPlacedStructure.offsetY) / PROPERTY_SCALE;

    // Get structure dimensions for boundary checking
    const structure = structures.find(s => s.id === draggingPlacedStructure.structure.structureId);
    const structureWidth = structure?.width || 0;
    const structureLength = structure?.length || 0;

    // Calculate max positions to keep entire structure within bounds
    const maxX = selectedProperty.width - structureWidth;
    const maxY = selectedProperty.length - structureLength;

    // Snap to grid and clamp to boundaries
    const newX = Math.max(0, Math.min(maxX, Math.round(rawX / GRID_SNAP_SPACING) * GRID_SNAP_SPACING));
    const newY = Math.max(0, Math.min(maxY, Math.round(rawY / GRID_SNAP_SPACING) * GRID_SNAP_SPACING));

    // Validate new position for collision detection
    const validation = validateStructurePlacement(
      {
        structureId: draggingPlacedStructure.structure.structureId,
        x: newX,
        y: newY,
        id: draggingPlacedStructure.structure.id
      },
      selectedProperty.placedStructures || [],
      structures
    );
    setDragValidation(validation);

    // Update the dragging state with new position
    setDraggingPlacedStructure(prev => prev ? {
      ...prev,
      structure: {
        ...prev.structure,
        positionX: newX,
        positionY: newY,
      }
    } : null);
  };

  const handlePlacedStructureMouseUp = async () => {
    if (!draggingPlacedStructure) return;

    const { structure, startX, startY, isDragging } = draggingPlacedStructure;

    // Save validation result but don't clear drag state yet
    const currentValidation = dragValidation;
    setDragValidation(null);

    // If we never passed the drag threshold, this was just a click
    if (!isDragging) {
      setDraggingPlacedStructure(null);
      return;
    }

    // Check if validation failed
    if (currentValidation && !currentValidation.isValid) {
      showError(`Cannot move structure: ${currentValidation.conflicts.join('; ')}`);
      // Clear drag state - automatically resets visual to original position
      setDraggingPlacedStructure(null);
      return; // No loadData() needed - never hit backend
    }

    const newX = structure.positionX;
    const newY = structure.positionY;

    // Only update if position changed
    if (newX !== startX || newY !== startY) {
      try {
        const response = await apiPut(`/api/placed-structures/${structure.id}`, {
          property_id: selectedProperty?.id,
          structure_id: structure.structureId,
          name: structure.name,
          position: { x: newX, y: newY },
          rotation: structure.rotation,
          notes: structure.notes,
          cost: structure.cost,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to update structure position');
        }

        showSuccess('Structure moved successfully!');
        setDraggingPlacedStructure(null);
        loadData(); // Sync with backend after successful update
      } catch (error) {
        showError(error instanceof Error ? error.message : 'Failed to move structure');
        setDraggingPlacedStructure(null);
        loadData(); // Sync with backend (state may be inconsistent after error)
      }
    } else {
      // No position change - just clear drag state
      setDraggingPlacedStructure(null);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const dragData = event.active.data.current;
    setDraggedStructure(null);

    if (event.over?.id === 'property-map' && selectedProperty) {
      const mapElement = document.getElementById('property-map-svg');

      if (!mapElement) {
        showError('Could not find property map');
        return;
      }

      // Get bounding rect at drop time (accounts for current scroll position)
      const rect = mapElement.getBoundingClientRect();
      const scale = 10; // pixels per foot

      // Calculate drop position using activator event + delta (more reliable than tracked cursor)
      const activeEvent = event.activatorEvent as PointerEvent;
      const clientX = activeEvent.clientX + (event.delta?.x || 0);
      const clientY = activeEvent.clientY + (event.delta?.y || 0);

      // Convert mouse position to property coordinates with snap-to-grid
      const gridSpacing = 1; // Snap to 1ft grid for precision
      const rawX = (clientX - rect.left) / scale;
      const rawY = (clientY - rect.top) / scale;

      // Clamp to valid range before rounding
      const clampedX = Math.max(0, Math.min(selectedProperty.width, rawX));
      const clampedY = Math.max(0, Math.min(selectedProperty.length, rawY));

      const x = Math.round(clampedX / gridSpacing) * gridSpacing;
      const y = Math.round(clampedY / gridSpacing) * gridSpacing;

      // Clear cursor position
      setDragCursorPosition(null);

      // Check if we're dropping a tree or a structure
      if (dragData?.type === 'tree') {
        // Handle tree placement
        const plant = dragData.plant as Plant;

        // Validate tree placement
        const validation = validateTreePlacement(plant, x, y, selectedProperty);
        if (!validation.isContained || validation.conflicts.length > 0) {
          showError(`Cannot place tree: ${validation.conflicts.join('; ')}`);
          return;
        }

        // Save tree as PlacedStructure
        await saveTreeImmediately(plant, x, y);
      } else {
        // Handle structure placement (existing logic)
        const structure = event.active.data.current?.structure as Structure;

        // Get structure dimensions for boundary validation
        const structureWidth = structure?.width || 0;
        const structureLength = structure?.length || 0;

        // Validate that ENTIRE structure (including dimensions) fits within property bounds
        if (x < 0 || y < 0 ||
            (x + structureWidth) > selectedProperty.width ||
            (y + structureLength) > selectedProperty.length) {
          showError(`Structure (${structureWidth}' x ${structureLength}') cannot be placed at (${x}', ${y}') - would extend beyond property boundaries (${selectedProperty.width}' x ${selectedProperty.length}')`);
          return;
        }

        // Place structure immediately
        saveStructureImmediately(structure, x, y);
      }
    }
  };

  const getStructureName = (structureId: string): string => {
    const structure = structures.find(s => s.id === structureId);
    return structure?.name || structureId;
  };

  const getStructureIcon = (structureId: string): string => {
    const structure = structures.find(s => s.id === structureId);
    const categoryIcons: { [key: string]: string } = {
      coops: '🐔',
      greenhouses: '🏡',
      storage: '🏚️',
      water: '💧',
      fencing: '🚧',
      garden: '🌱',
      orchard: '🌳',
      other: '🏗️'
    };
    return structure?.icon || categoryIcons[structure?.category || 'other'] || '🏗️';
  };

  // Component for droppable property map
  const DroppablePropertyMap: React.FC<{ property: Property }> = ({ property }) => {
    const { setNodeRef, isOver } = useDroppable({ id: 'property-map' });
    const scale = PROPERTY_SCALE;
    const canvasWidth = property.width * scale;
    const canvasHeight = property.length * scale;

    // Grid visibility logic
    const showMinorGrid = showGrid && showMinorGridToggle && property.width <= 200 && property.length <= 200;
    const showSuperMajorGrid = showGrid && (property.width > 100 || property.length > 100);

    // Helper function to render grid lines
    const renderGridLines = (
      type: 'vertical' | 'horizontal',
      spacing: number,
      maxDimension: number,
      config: { stroke: string; width: number; opacity: number; dash: string }
    ) => {
      const count = Math.floor(maxDimension / spacing) + 1;

      return Array.from({ length: count }).map((_, i) => {
        const position = i * spacing * scale;
        const key = `${type}-${spacing}ft-${i}`;

        if (type === 'vertical') {
          return (
            <line
              key={key}
              x1={position}
              y1={0}
              x2={position}
              y2={canvasHeight}
              stroke={config.stroke}
              strokeWidth={config.width}
              opacity={config.opacity}
              strokeDasharray={config.dash}
            />
          );
        } else {
          return (
            <line
              key={key}
              x1={0}
              y1={position}
              x2={canvasWidth}
              y2={position}
              stroke={config.stroke}
              strokeWidth={config.width}
              opacity={config.opacity}
              strokeDasharray={config.dash}
            />
          );
        }
      });
    };

    return (
      <div
        ref={setNodeRef}
        className={`relative bg-green-100 rounded-lg p-4 inline-block border-4 ${isOver ? 'border-blue-500' : 'border-green-700'}`}
        onMouseMove={handlePlacedStructureMouseMove}
        onMouseUp={handlePlacedStructureMouseUp}
        onMouseLeave={handlePlacedStructureMouseUp}
      >
        <svg id="property-map-svg" width={canvasWidth} height={canvasHeight}>
          {/* Property background */}
          <rect width="100%" height="100%" fill="#86efac" opacity="0.3" />

          {/* Multi-level grid system */}
          {/* Super-major grid (50ft) - for large properties */}
          {showSuperMajorGrid && (
            <g id="super-major-grid">
              {renderGridLines('vertical', GRID_CONFIG.superMajor.spacing, property.width, GRID_CONFIG.superMajor)}
              {renderGridLines('horizontal', GRID_CONFIG.superMajor.spacing, property.length, GRID_CONFIG.superMajor)}
            </g>
          )}

          {/* Major grid (10ft) - shown when grid is enabled */}
          {showGrid && (
            <g id="major-grid">
              {renderGridLines('vertical', GRID_CONFIG.major.spacing, property.width, GRID_CONFIG.major)}
              {renderGridLines('horizontal', GRID_CONFIG.major.spacing, property.length, GRID_CONFIG.major)}
            </g>
          )}

          {/* Minor grid (1ft) - shown for smaller properties */}
          {showMinorGrid && (
            <g id="minor-grid">
              {renderGridLines('vertical', GRID_CONFIG.minor.spacing, property.width, GRID_CONFIG.minor)}
              {renderGridLines('horizontal', GRID_CONFIG.minor.spacing, property.length, GRID_CONFIG.minor)}
            </g>
          )}

          {/* Placed structures - sorted by category for proper z-index layering */}
          {[...property.placedStructures || []]
            .sort((a, b) => {
              // Render order: ground-covering first (below), then everything else
              const structA = structures.find(s => s.id === a.structureId);
              const structB = structures.find(s => s.id === b.structureId);

              const getCategoryOrder = (category: string | undefined) => {
                if (category === 'ground-covering') return 0;  // Render first (below)
                return 1;  // All others render after
              };

              return getCategoryOrder(structA?.category) - getCategoryOrder(structB?.category);
            })
            .map((placed) => {
            // Use dragged position if this structure is being dragged
            const isDragging = draggingPlacedStructure?.structure.id === placed.id;
            const displayPlaced = isDragging ? draggingPlacedStructure.structure : placed;

            const structure = structures.find(s => s.id === displayPlaced.structureId);
            const width = (structure?.width || 10) * scale;
            const height = (structure?.length || 10) * scale;
            const x = displayPlaced.positionX * scale;
            const y = displayPlaced.positionY * scale;

            // Determine visual feedback based on validation
            let strokeColor = "#1e40af"; // Default blue
            let strokeWidth = "2";
            let fillColor = "#3b82f6"; // Default blue
            let opacity = "0.3"; // More transparent to show icon better

            if (isDragging) {
              strokeWidth = "3";
              opacity = "0.5"; // More transparent while dragging

              if (dragValidation) {
                if (!dragValidation.isValid) {
                  // RED: Collision detected
                  strokeColor = "#dc2626";
                  fillColor = "#ef4444";
                } else if (dragValidation.isContained) {
                  // YELLOW: Inside container (valid)
                  strokeColor = "#eab308";
                  fillColor = "#facc15";
                } else {
                  // GREEN: Valid placement
                  strokeColor = "#16a34a";
                  fillColor = "#22c55e";
                }
              } else {
                // Still dragging, no validation yet
                strokeColor = "#3b82f6";
                fillColor = "#60a5fa";
              }
            }

            // Render trees as circles, structures as rectangles
            if (displayPlaced.shapeType === 'circle') {
              // Tree rendering (circle)
              const radius = ((displayPlaced.customWidth || 10) / 2) * scale;
              const centerX = displayPlaced.positionX * scale;
              const centerY = displayPlaced.positionY * scale;

              // Get tree plant data for icon
              const treePlant = treePlants.find(p => p.id === displayPlaced.structureId);
              const treeIcon = treePlant?.icon || '🌳';

              return (
                <g key={placed.id}>
                  {/* Tree canopy circle */}
                  <circle
                    cx={centerX}
                    cy={centerY}
                    r={radius}
                    fill="#86efac"
                    fillOpacity={0.3}
                    stroke="#22c55e"
                    strokeWidth={2}
                    onClick={() => handleStructureClick(placed)}
                    onMouseDown={(e) => handlePlacedStructureMouseDown(e, placed)}
                    style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
                    className={isDragging ? "" : "hover:fill-opacity-50 transition-opacity cursor-pointer"}
                  />

                  {/* Tree icon */}
                  <StructureIconSVG
                    structureId={displayPlaced.structureId}
                    structureIcon={treeIcon}
                    x={centerX - (radius > 50 ? 16 : 12)}
                    y={centerY - (radius > 50 ? 16 : 12)}
                    width={radius > 50 ? 32 : 24}
                    height={radius > 50 ? 32 : 24}
                  />

                  {/* Tree name label */}
                  <text
                    x={centerX}
                    y={centerY + radius + 15}
                    textAnchor="middle"
                    fontSize={12}
                    fill="#374151"
                    fontWeight="600"
                    style={{ pointerEvents: 'none' }}
                  >
                    {displayPlaced.name}
                  </text>
                </g>
              );
            } else {
              // Structure rendering (rectangle)
              // Calculate icon size based on structure dimensions (scale with size but cap min/max)
              const iconSize = Math.min(Math.max(Math.min(width, height) * 0.6, 24), 80);

              return (
                <g key={placed.id}>
                  <rect
                    x={x}
                    y={y}
                    width={width}
                    height={height}
                    fill={fillColor}
                    opacity={opacity}
                    stroke={strokeColor}
                    strokeWidth={strokeWidth}
                    rx="4"
                    onClick={() => handleStructureClick(placed)}
                    onMouseDown={(e) => handlePlacedStructureMouseDown(e, placed)}
                    style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
                    className={isDragging ? "" : "hover:opacity-80 transition-opacity"}
                  />
                  <StructureIconSVG
                    structureId={displayPlaced.structureId}
                    structureIcon={getStructureIcon(displayPlaced.structureId)}
                    x={x + width / 2 - iconSize / 2}
                    y={y + height / 2 - iconSize / 2}
                    width={iconSize}
                    height={iconSize}
                  />
                </g>
              );
            }
          })}

          {/* Trellis structures - rendered as brown dashed lines */}
          {trellises.map((trellis) => {
            const startX = trellis.startX * scale;
            const startY = trellis.startY * scale;
            const endX = trellis.endX * scale;
            const endY = trellis.endY * scale;

            return (
              <g key={`trellis-${trellis.id}`}>
                {/* Trellis line */}
                <line
                  x1={startX}
                  y1={startY}
                  x2={endX}
                  y2={endY}
                  stroke="#8B4513"
                  strokeWidth="3"
                  strokeDasharray="8,4"
                />
                {/* Start point marker */}
                <circle
                  cx={startX}
                  cy={startY}
                  r="5"
                  fill="#8B4513"
                  stroke="#ffffff"
                  strokeWidth="2"
                />
                {/* End point marker */}
                <circle
                  cx={endX}
                  cy={endY}
                  r="5"
                  fill="#8B4513"
                  stroke="#ffffff"
                  strokeWidth="2"
                />
                {/* Label at midpoint */}
                <text
                  x={(startX + endX) / 2}
                  y={(startY + endY) / 2 - 8}
                  fill="#8B4513"
                  fontSize="12"
                  fontWeight="bold"
                  textAnchor="middle"
                  style={{ pointerEvents: 'none' }}
                >
                  {trellis.name} ({trellis.totalLengthFeet}ft)
                </text>
              </g>
            );
          })}
        </svg>

        {/* Scale Legend - Top Right Corner */}
        <div className="absolute top-4 right-4 bg-white bg-opacity-95 border border-gray-300 rounded-lg shadow-md p-3 text-xs z-10">
          <div className="font-bold text-gray-800 mb-2">SCALE</div>

          {/* Visual scale bar */}
          <div className="flex items-center gap-2 mb-2">
            <svg width="40" height="10">
              <line x1="0" y1="5" x2="40" y2="5" stroke="#666" strokeWidth="2" />
              <line x1="0" y1="2" x2="0" y2="8" stroke="#666" strokeWidth="1" />
              <line x1="40" y1="2" x2="40" y2="8" stroke="#666" strokeWidth="1" />
            </svg>
            <span className="text-gray-700">= 10 feet</span>
          </div>

          <div className="space-y-1 text-gray-600">
            <div className="font-semibold">Property Size:</div>
            <div>{property.width}' × {property.length}'</div>
            <div className="text-gray-500">
              ({((property.width * property.length) / 43560).toFixed(2)} acres)
            </div>
          </div>

          <div className="mt-2 pt-2 border-t border-gray-200 text-gray-500">
            <div>Grid: {showMinorGrid ? '1ft / 10ft' : showSuperMajorGrid ? '10ft / 50ft' : '10ft'}</div>
          </div>
        </div>

        {/* Ruler Edges - Top and Left */}
        {/* Top ruler (horizontal) */}
        <div className="absolute -top-7 left-0 pointer-events-none" style={{ width: canvasWidth }}>
          <svg width={canvasWidth} height="24">
            {Array.from({ length: Math.floor(property.width / 10) + 1 }).map((_, i) => {
              const position = i * 10 * scale;
              return (
                <g key={`h-tick-${i}`}>
                  <line x1={position} y1="16" x2={position} y2="24"
                        stroke="#666" strokeWidth="1" />
                  <text x={position} y="12" textAnchor="middle"
                        fontSize="10" fill="#666" fontFamily="monospace">
                    {i * 10}'
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Left ruler (vertical) */}
        <div className="absolute -left-11 top-0 pointer-events-none" style={{ height: canvasHeight }}>
          <svg width="44" height={canvasHeight}>
            {Array.from({ length: Math.floor(property.length / 10) + 1 }).map((_, i) => {
              const position = i * 10 * scale;
              return (
                <g key={`v-tick-${i}`}>
                  <line x1="32" y1={position} x2="40" y2={position}
                        stroke="#666" strokeWidth="1" />
                  <text x="28" y={position + 4} textAnchor="end"
                        fontSize="10" fill="#666" fontFamily="monospace">
                    {i * 10}'
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Dimensions label */}
        <div className="absolute -bottom-8 left-0 right-0 text-center text-sm text-gray-600">
          {property.width}' × {property.length}' property
        </div>
      </div>
    );
  };

  // Component for draggable structure card
  const DraggableStructureCard: React.FC<{ structure: Structure, icon: string }> = ({ structure, icon }) => {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
      id: structure.id,
      data: { structure },
    });

    return (
      <div
        ref={setNodeRef}
        {...listeners}
        {...attributes}
        className={`bg-gray-50 hover:bg-gray-100 rounded-lg p-3 text-center cursor-grab transition-all ${
          isDragging ? 'opacity-50 cursor-grabbing' : ''
        }`}
      >
        <StructureIcon
          structureId={structure.id}
          structureIcon={icon}
          size={40}
          className="mb-1"
        />
        <div className="text-xs font-medium text-gray-800">{structure.name}</div>
        <div className="text-xs text-gray-500">{structure.width}' × {structure.length}'</div>
      </div>
    );
  };

  // Component for draggable tree card
  const DraggableTreeCard: React.FC<{ tree: Plant }> = ({ tree }) => {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
      id: `tree-${tree.id}`,  // Unique ID for trees
      data: {
        type: 'tree',
        plant: tree
      },
    });

    const spacingFeet = Math.round(tree.spacing / 12);  // Convert inches to feet
    const yearsToMaturity = tree.daysToMaturity ? Math.round(tree.daysToMaturity / 365) : 0;

    return (
      <div
        ref={setNodeRef}
        {...listeners}
        {...attributes}
        className={`bg-green-50 hover:bg-green-100 rounded-lg p-3 text-center cursor-grab transition-all border border-green-200 ${
          isDragging ? 'opacity-50 cursor-grabbing' : ''
        }`}
      >
        <StructureIcon
          structureId={tree.id}
          structureIcon={tree.icon || '🌳'}
          size={40}
          className="mb-1"
        />
        <div className="text-xs font-medium text-gray-800">{tree.name}</div>
        <div className="text-xs text-gray-500">{spacingFeet}' spacing</div>
        {yearsToMaturity > 0 && (
          <div className="text-xs text-green-600 mt-1">{yearsToMaturity}yr harvest</div>
        )}
      </div>
    );
  };

  const structureCategories = Array.from(new Set(structures.map(s => s.category)));

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Property Designer</h2>
            <span className="inline-block bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-xs font-semibold mt-2">
              ⭐ NEW FEATURE
            </span>
          </div>
        </div>
        <p className="text-gray-600 mb-6">
          Master homestead layout designer! Place coops, greenhouses, orchards, sheds, and all structures on your entire property.
        </p>

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-6 border border-green-200">
            <div className="text-3xl font-bold text-green-700 mb-2">{properties.length}</div>
            <div className="text-sm text-green-600 font-medium">Properties</div>
          </div>

          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-6 border border-blue-200">
            <div className="text-3xl font-bold text-blue-700 mb-2">
              {properties.reduce((sum, prop) => sum + (prop.placedStructures?.length || 0), 0)}
            </div>
            <div className="text-sm text-blue-600 font-medium">Structures</div>
          </div>

          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-6 border border-purple-200">
            <div className="text-3xl font-bold text-purple-700 mb-2">{structures.length}</div>
            <div className="text-sm text-purple-600 font-medium">Available Types</div>
          </div>

          <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-lg p-6 border border-amber-200">
            <div className="text-3xl font-bold text-amber-700 mb-2">
              {properties.reduce((sum, prop) => sum + (prop.width * prop.length), 0).toLocaleString()}
            </div>
            <div className="text-sm text-amber-600 font-medium">Total Sq Ft</div>
          </div>
        </div>

        {/* Property Selector */}
        {properties.length > 0 && (
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Select Property:
              </label>
              <button
                onClick={() => {
                  setModalMode('add');
                  setIsModalOpen(true);
                }}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors text-sm"
              data-testid="btn-create-property"
              >
                + Create New Property
              </button>
            </div>
            <select
              data-testid="property-selector"
              value={selectedProperty?.id || ''}
              onChange={(e) => {
                const prop = properties.find(p => p.id === parseInt(e.target.value));
                setSelectedProperty(prop || null);
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              {properties.map(prop => (
                <option key={prop.id} value={prop.id}>
                  {prop.name} ({prop.width}' × {prop.length}')
                </option>
              ))}
            </select>
          </div>
        )}

        <p className="text-sm text-gray-500">
          Full drag-and-drop functionality coming soon. Currently displaying existing property layouts from backend.
        </p>
      </div>

      {/* Main Layout: Structures Sidebar (Left) + Designer Canvas (Right) */}
      <div className="flex flex-col md:flex-row gap-6">
        {/* Left Sidebar: Available Structures & Trees */}
        {(structures.length > 0 || treePlants.length > 0) && (
          <div className="w-full md:w-80 bg-white rounded-lg shadow-md p-6 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 300px)' }}>
            <h3 className="text-xl font-bold text-gray-800 mb-4 sticky top-0 bg-white pb-2">Available Items</h3>
            <div className="space-y-6">
              {/* Trees & Shrubs Section */}
              {treePlants.length > 0 && (
                <div>
                  <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <span className="text-2xl">🌳</span>
                    Trees & Shrubs
                    <span className="text-sm font-normal text-gray-500">({treePlants.length})</span>
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    {treePlants.map(tree => (
                      <DraggableTreeCard key={tree.id} tree={tree} />
                    ))}
                  </div>
                </div>
              )}

              {/* Structures by Category */}
              {structures.length > 0 && (
                <>
                  <div className="border-t border-gray-200 pt-4">
                    <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                      <span className="text-2xl">🏗️</span>
                      Structures
                      <span className="text-sm font-normal text-gray-500">({structures.length})</span>
                    </h4>
                  </div>
                  {structureCategories.map(category => {
                    const categoryStructures = structures.filter(s => s.category === category);
                    return (
                      <div key={category}>
                        <h5 className="font-medium text-gray-600 mb-2 capitalize text-sm">{category}</h5>
                        <div className="grid grid-cols-2 gap-2">
                          {categoryStructures.map(structure => (
                            <DraggableStructureCard
                              key={structure.id}
                              structure={structure}
                              icon={getStructureIcon(structure.id)}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          </div>
        )}

        {/* Right: Designer Canvas */}
        <div className="flex-1 bg-white rounded-lg shadow-md p-6">
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
              <p className="mt-4 text-gray-600">Loading property designer...</p>
            </div>
          ) : properties.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <div className="text-6xl mb-4">🗺️</div>
              <p className="text-lg">No properties created yet.</p>
              <p className="text-sm mt-2">Create your first property to start designing your homestead layout!</p>
              <button
                onClick={() => {
                  setModalMode('add');
                  setIsModalOpen(true);
                }}
                className="mt-6 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors"
              >
                Create Property
              </button>
            </div>
          ) : selectedProperty ? (
            <div>
              <div className="flex justify-between items-center mb-6">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-bold text-gray-800">{selectedProperty.name}</h3>
                    <button
                      onClick={() => handleEdit(selectedProperty)}
                      className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                      title="Edit Property"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDeleteClick(selectedProperty)}
                      className="p-1 text-red-600 hover:bg-red-50 rounded"
                      title="Delete Property"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                  <div className="text-sm text-gray-600 mt-1 space-y-1">
                    {selectedProperty.address && <div>📍 {selectedProperty.address}</div>}
                    {selectedProperty.zone && <div>🌡️ Zone: {selectedProperty.zone}</div>}
                    {selectedProperty.soilType && <div>🌱 Soil: {selectedProperty.soilType}</div>}
                    {selectedProperty.slope && <div>⛰️ Slope: {selectedProperty.slope}</div>}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setIsStructureModalOpen(true)}
                    data-testid="btn-add-structure"
                    className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
                  >
                    Add Structure
                  </button>
                  <button
                    onClick={() => setIsTrellisManagerOpen(true)}
                    data-testid="btn-manage-trellises"
                    className="bg-amber-600 text-white px-4 py-2 rounded-lg hover:bg-amber-700 transition-colors"
                  >
                    Manage Trellises
                  </button>
                </div>
              </div>

              {/* Grid Controls */}
              <div className="flex gap-2 mb-4 text-sm">
                <button
                  onClick={() => setShowGrid(!showGrid)}
                  className={`px-3 py-1 rounded border transition-colors ${
                    showGrid
                      ? 'bg-green-100 border-green-600 text-green-700'
                      : 'bg-gray-100 border-gray-300 text-gray-600'
                  }`}
                >
                  {showGrid ? '✓' : '○'} Grid
                </button>
                {showGrid && selectedProperty.width <= 200 && selectedProperty.length <= 200 && (
                  <button
                    onClick={() => setShowMinorGridToggle(!showMinorGridToggle)}
                    className={`px-3 py-1 rounded border transition-colors ${
                      showMinorGridToggle
                        ? 'bg-green-100 border-green-600 text-green-700'
                        : 'bg-gray-100 border-gray-300 text-gray-600'
                    }`}
                  >
                    {showMinorGridToggle ? '✓' : '○'} Fine Grid (1ft)
                  </button>
                )}
                <span className="text-gray-500 px-2 py-1">
                  Snap: 1ft precision
                </span>
              </div>

              {/* Property Map */}
              <div className="overflow-auto pb-12 relative">
                <div className="flex justify-center">
                  <DroppablePropertyMap property={selectedProperty} />
                </div>

                {/* Real-time coordinate display during drag */}
                <CoordinateDisplay
                  dragCursorPosition={dragCursorPosition}
                  draggedStructure={draggedStructure}
                />
              </div>

              {/* Tree Nutrition Summary Card */}
              {treeNutritionData && treeNutritionData.tree_summary.length > 0 && (
                <div className="mt-6 bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-6 border border-green-200">
                  <h4 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <span>🌳</span>
                    Tree Yield & Nutrition Estimates
                  </h4>

                  {treeNutritionLoading ? (
                    <div className="text-center py-4">
                      <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Tree Summary */}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {treeNutritionData.tree_summary.map((tree) => (
                          <div key={tree.tree_type} className="bg-white rounded-lg p-4 shadow-sm">
                            <div className="font-semibold text-gray-800 capitalize">
                              {tree.tree_type.replace('-', ' ')}
                            </div>
                            <div className="text-sm text-gray-600">
                              {tree.count} {tree.count === 1 ? 'tree' : 'trees'}
                            </div>
                            <div className="text-sm text-green-700 font-medium mt-2">
                              → {Math.round(tree.annual_yield_lbs)} lbs/year
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Nutritional Totals */}
                      <div className="bg-white rounded-lg p-4 shadow-sm">
                        <div className="font-semibold text-gray-800 mb-3">Total Annual Nutrition:</div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div>
                            <div className="text-2xl font-bold text-green-600">
                              {treeNutritionData.totals.calories.toLocaleString()}
                            </div>
                            <div className="text-xs text-gray-600">Calories</div>
                            <div className="text-xs text-gray-500 mt-1">
                              ≈ {Math.round(treeNutritionData.totals.calories / 2000)} person-days
                            </div>
                          </div>
                          <div>
                            <div className="text-2xl font-bold text-blue-600">
                              {Math.round(treeNutritionData.totals.protein_g).toLocaleString()}g
                            </div>
                            <div className="text-xs text-gray-600">Protein</div>
                            <div className="text-xs text-gray-500 mt-1">
                              ≈ {Math.round(treeNutritionData.totals.protein_g / 50)} person-days
                            </div>
                          </div>
                          <div>
                            <div className="text-2xl font-bold text-purple-600">
                              {Math.round(treeNutritionData.totals.carbs_g).toLocaleString()}g
                            </div>
                            <div className="text-xs text-gray-600">Carbs</div>
                          </div>
                          <div>
                            <div className="text-2xl font-bold text-amber-600">
                              {Math.round(treeNutritionData.totals.fat_g).toLocaleString()}g
                            </div>
                            <div className="text-xs text-gray-600">Fat</div>
                          </div>
                        </div>
                      </div>

                      {/* Breakdown by Tree Type */}
                      {Object.keys(treeNutritionData.by_tree_type).length > 0 && (
                        <details className="bg-white rounded-lg p-4 shadow-sm">
                          <summary className="font-semibold text-gray-800 cursor-pointer hover:text-green-600">
                            View Breakdown by Tree Type →
                          </summary>
                          <div className="mt-4 space-y-3">
                            {Object.entries(treeNutritionData.by_tree_type).map(([treeType, nutrition]) => (
                              <div key={treeType} className="border-l-4 border-green-500 pl-4">
                                <div className="font-medium text-gray-800 capitalize">{treeType.replace('-', ' ')}</div>
                                <div className="text-sm text-gray-600 mt-1">
                                  {nutrition.calories.toLocaleString()} cal • {Math.round(nutrition.protein_g)}g protein • {Math.round(nutrition.carbs_g)}g carbs • {Math.round(nutrition.fat_g)}g fat
                                </div>
                              </div>
                            ))}
                          </div>
                        </details>
                      )}

                      <div className="text-xs text-gray-500 italic mt-2">
                        * Estimates based on mature trees under average conditions. Actual yields vary by variety, age, climate, soil, and management practices.
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Structures List */}
              {selectedProperty.placedStructures && selectedProperty.placedStructures.length > 0 && (
                <div className="mt-8 pt-6 border-t border-gray-200">
                  <h4 className="text-lg font-semibold text-gray-800 mb-3">Structures on Property:</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {selectedProperty.placedStructures.map((placed) => {
                      const treeYield = getTreeYieldInfo(placed.structureId);
                      return (
                        <div key={placed.id} className="flex items-center gap-3 bg-gray-50 rounded-lg p-4">
                          <StructureIcon
                            structureId={placed.structureId}
                            structureIcon={getStructureIcon(placed.structureId)}
                            size={48}
                          />
                          <div className="flex-1">
                            <div className="font-medium text-gray-800">
                              {placed.name || getStructureName(placed.structureId)}
                            </div>
                            <div className="text-xs text-gray-600">
                              Position: ({placed.positionX}', {placed.positionY}')
                              {placed.cost && ` • Cost: $${placed.cost.toLocaleString()}`}
                            </div>
                            {treeYield.isTree && treeYield.yieldInfo && (
                              <div className="text-xs text-green-700 font-medium mt-1">
                                🍎 ~{Math.round(treeYield.yieldInfo.annual_yield_lbs)} lbs/year
                              </div>
                            )}
                            {placed.notes && (
                              <div className="text-xs text-gray-500 mt-1">{placed.notes}</div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {selectedProperty.notes && (
                <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <h4 className="font-semibold text-blue-900 mb-2">Property Notes:</h4>
                  <p className="text-sm text-blue-800">{selectedProperty.notes}</p>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>

      {/* Info Card */}
      <div className="bg-yellow-50 rounded-lg p-6 border border-yellow-200">
        <h3 className="text-lg font-semibold text-yellow-900 mb-2">Property Design Features</h3>
        <ul className="space-y-2 text-sm text-yellow-800">
          <li>✓ 35+ homestead structures including coops, greenhouses, sheds, orchards, and more</li>
          <li>✓ 33 fruit and nut trees with automatic timeline integration</li>
          <li>✓ Master layout view of your entire property at scale</li>
          <li>✓ Drag-and-drop trees to visualize canopy coverage and spacing</li>
          <li>✓ Track multi-year tree maturity and harvest dates</li>
          <li>✓ Plan zones (annual garden, perennial orchard, livestock, storage, etc.)</li>
          <li>✓ Export property maps for contractors and planning permits</li>
        </ul>
      </div>

      {/* Property Form Modal */}
      <PropertyFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {
          loadData(); // Refresh properties list
          setIsModalOpen(false);
        }}
        mode={modalMode}
        propertyData={modalMode === 'edit' ? selectedProperty : null}
      />

      {/* Structure Form Modal */}
      {selectedProperty && (
        <StructureFormModal
          isOpen={isStructureModalOpen}
          onClose={() => {
            setIsStructureModalOpen(false);
            setEditingStructure(null);
          }}
          onSuccess={() => {
            loadData(); // Refresh property data including structures
            setIsStructureModalOpen(false);
            setEditingStructure(null);
          }}
          onDelete={(id: number) => {
            loadData(); // Refresh after delete
          }}
          propertyId={selectedProperty.id}
          mode={editingStructure ? 'edit' : 'add'}
          structureData={editingStructure ? {
            id: editingStructure.id,
            propertyId: selectedProperty.id,
            structureId: editingStructure.structureId,
            name: editingStructure.name,
            position: {
              x: editingStructure.positionX,
              y: editingStructure.positionY
            },
            rotation: editingStructure.rotation,
            notes: editingStructure.notes,
            cost: editingStructure.cost
          } : null}
          availableStructures={structures}
        />
      )}

      {/* Trellis Manager Modal */}
      {selectedProperty && (
        <TrellisManager
          isOpen={isTrellisManagerOpen}
          onClose={() => setIsTrellisManagerOpen(false)}
          onSuccess={() => {
            loadTrellises(); // Refresh trellis structures
            setIsTrellisManagerOpen(false);
          }}
          propertyId={selectedProperty.id}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, propertyId: null, propertyName: '' })}
        onConfirm={handleDeleteConfirm}
        title="Delete Property"
        message={`Are you sure you want to delete "${deleteConfirm.propertyName}"? This will also delete all structures placed on this property. This action cannot be undone.`}
        confirmText="Delete Property"
        variant="danger"
      />
    </div>

    {/* Drag Overlay for visual feedback */}
    <DragOverlay>
      {draggedStructure && (
        draggedStructure.shapeType === 'circle' ? (
          // Tree overlay (circle)
          <div className="bg-green-500 opacity-80 rounded-full p-8 text-white text-center shadow-lg flex flex-col items-center justify-center" style={{ width: '100px', height: '100px' }}>
            <StructureIcon
              structureId={draggedStructure.id}
              structureIcon={draggedStructure.icon || '🌳'}
              size={48}
            />
            <div className="text-xs font-medium mt-1">{draggedStructure.name}</div>
            <div className="text-xs">{Math.round(draggedStructure.width)}'</div>
          </div>
        ) : (
          // Structure overlay (rectangle)
          <div className="bg-blue-500 opacity-80 rounded-lg p-4 text-white text-center shadow-lg">
            <StructureIcon
              structureId={draggedStructure.id}
              structureIcon={getStructureIcon(draggedStructure.id)}
              size={48}
              className="mb-1"
            />
            <div className="text-sm font-medium">{draggedStructure.name}</div>
            <div className="text-xs">{draggedStructure.width}' × {draggedStructure.length}'</div>
          </div>
        )
      )}
    </DragOverlay>
  </DndContext>
  );
};

export default PropertyDesigner;
