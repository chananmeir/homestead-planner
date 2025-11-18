import React, { useState, useEffect } from 'react';
import { DndContext, DragStartEvent, DragEndEvent, DragMoveEvent, DragOverlay, useSensor, useSensors, PointerSensor, useDraggable, useDroppable } from '@dnd-kit/core';
import { PropertyFormModal } from './PropertyDesigner/PropertyFormModal';
import { StructureFormModal } from './PropertyDesigner/StructureFormModal';
import { ConfirmDialog, useToast } from './common';

import { API_BASE_URL } from '../config';
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
  const x = Math.round((dragCursorPosition.x - rect.left) / PROPERTY_SCALE);
  const y = Math.round((dragCursorPosition.y - rect.top) / PROPERTY_SCALE);

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
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [isStructureModalOpen, setIsStructureModalOpen] = useState(false);
  const [draggedStructure, setDraggedStructure] = useState<Structure | null>(null);
  const [dragCursorPosition, setDragCursorPosition] = useState<{x: number, y: number} | null>(null);
  const [prefilledPosition, setPrefilledPosition] = useState<{x: number, y: number, structureId: string, placedStructureId?: number} | null>(null);
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

  const loadData = async () => {
    try {
      setLoading(true);

      // Load properties
      const propResponse = await fetch(`${API_BASE_URL}/api/properties`);
      if (!propResponse.ok) {
        throw new Error('Failed to fetch properties');
      }
      const propData = await propResponse.json();
      setProperties(propData);

      // Load structures
      const structResponse = await fetch(`${API_BASE_URL}/api/structures`);
      if (!structResponse.ok) {
        throw new Error('Failed to fetch structures');
      }
      const structData = await structResponse.json();
      setStructures(structData.structures || []);

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

  // Collision detection rules - mirrors backend collision_rules.py
  const COLLISION_RULES: Record<string, {
    is_container: boolean;
    allowed_children?: string[];
    can_overlap: string[] | '*';
    must_not_overlap: string[];
  }> = {
    structures: {
      is_container: true,
      allowed_children: ['garden', 'compost', 'water'],
      can_overlap: ['infrastructure'],
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
    // Infrastructure special case - can overlap with anything
    if (categoryA === 'infrastructure' || categoryB === 'infrastructure') {
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
      const response = await fetch(
        `${API_BASE_URL}/api/properties/${deleteConfirm.propertyId}`,
        { method: 'DELETE' }
      );

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
    const structure = event.active.data.current?.structure;
    setDraggedStructure(structure || null);
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

      const response = await fetch(`${API_BASE_URL}/api/placed-structures`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

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

    // Clear dragging state and validation
    setDraggingPlacedStructure(null);
    const currentValidation = dragValidation;
    setDragValidation(null);

    // If we never passed the drag threshold, this was just a click - do nothing
    if (!isDragging) return;

    // Check if validation failed
    if (currentValidation && !currentValidation.isValid) {
      showError(`Cannot move structure: ${currentValidation.conflicts.join('; ')}`);
      loadData(); // Reload to reset position
      return;
    }

    const newX = structure.positionX;
    const newY = structure.positionY;

    // Only update if position changed
    if (newX !== startX || newY !== startY) {
      try {
        const response = await fetch(`${API_BASE_URL}/api/placed-structures/${structure.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            property_id: selectedProperty?.id,
            structure_id: structure.structureId,
            name: structure.name,
            position: { x: newX, y: newY },
            rotation: structure.rotation,
            notes: structure.notes,
            cost: structure.cost,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to update structure position');
        }

        showSuccess('Structure moved successfully!');
        loadData();
      } catch (error) {
        showError(error instanceof Error ? error.message : 'Failed to move structure');
        loadData(); // Reload to reset position
      }
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setDraggedStructure(null);

    if (event.over?.id === 'property-map' && selectedProperty) {
      const structure = event.active.data.current?.structure as Structure;
      const mapElement = document.getElementById('property-map-svg');

      if (!mapElement) {
        showError('Could not find property map');
        return;
      }

      const rect = mapElement.getBoundingClientRect();
      const scale = 10; // pixels per foot

      // Get the final drop position from tracked cursor or calculate from delta
      let clientX, clientY;
      if (dragCursorPosition) {
        clientX = dragCursorPosition.x;
        clientY = dragCursorPosition.y;
      } else {
        // Fallback: use activator + delta
        const activeEvent = event.activatorEvent as PointerEvent;
        clientX = activeEvent.clientX + (event.delta?.x || 0);
        clientY = activeEvent.clientY + (event.delta?.y || 0);
      }

      // Convert mouse position to property coordinates with snap-to-grid
      const gridSpacing = 1; // Snap to 1ft grid for precision
      const rawX = (clientX - rect.left) / scale;
      const rawY = (clientY - rect.top) / scale;
      const x = Math.round(rawX / gridSpacing) * gridSpacing;
      const y = Math.round(rawY / gridSpacing) * gridSpacing;

      // Clear cursor position
      setDragCursorPosition(null);

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

          {/* Placed structures */}
          {property.placedStructures?.map((placed) => {
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
            let opacity = "0.6";

            if (isDragging) {
              strokeWidth = "3";
              opacity = "0.8";

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
                <text
                  x={x + width / 2}
                  y={y + height / 2}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="white"
                  fontSize="14"
                  fontWeight="bold"
                  style={{ pointerEvents: 'none' }}
                >
                  {getStructureIcon(displayPlaced.structureId)}
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
        <div className="text-2xl mb-1">{icon}</div>
        <div className="text-xs font-medium text-gray-800">{structure.name}</div>
        <div className="text-xs text-gray-500">{structure.width}' × {structure.length}'</div>
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
              >
                + Create New Property
              </button>
            </div>
            <select
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
        {/* Left Sidebar: Available Structures */}
        {structures.length > 0 && (
          <div className="w-full md:w-80 bg-white rounded-lg shadow-md p-6 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 300px)' }}>
            <h3 className="text-xl font-bold text-gray-800 mb-4 sticky top-0 bg-white pb-2">Available Structures ({structures.length})</h3>
            <div className="space-y-4">
              {structureCategories.map(category => {
                const categoryStructures = structures.filter(s => s.category === category);
                return (
                  <div key={category}>
                    <h4 className="font-semibold text-gray-700 mb-2 capitalize">{category}</h4>
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
                <button
                  onClick={() => setIsStructureModalOpen(true)}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
                >
                  Add Structure
                </button>
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

              {/* Structures List */}
              {selectedProperty.placedStructures && selectedProperty.placedStructures.length > 0 && (
                <div className="mt-8 pt-6 border-t border-gray-200">
                  <h4 className="text-lg font-semibold text-gray-800 mb-3">Structures on Property:</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {selectedProperty.placedStructures.map((placed) => (
                      <div key={placed.id} className="flex items-center gap-3 bg-gray-50 rounded-lg p-4">
                        <div className="text-3xl">{getStructureIcon(placed.structureId)}</div>
                        <div className="flex-1">
                          <div className="font-medium text-gray-800">
                            {placed.name || getStructureName(placed.structureId)}
                          </div>
                          <div className="text-xs text-gray-600">
                            Position: ({placed.positionX}', {placed.positionY}')
                            {placed.cost && ` • Cost: $${placed.cost.toLocaleString()}`}
                          </div>
                          {placed.notes && (
                            <div className="text-xs text-gray-500 mt-1">{placed.notes}</div>
                          )}
                        </div>
                      </div>
                    ))}
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
          <li>✓ Master layout view of your entire property at scale</li>
          <li>✓ Track structure costs and build out your homestead incrementally</li>
          <li>✓ Consider sun exposure, water access, and slopes in your design</li>
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
            setPrefilledPosition(null);
            setEditingStructure(null);
          }}
          onSuccess={() => {
            loadData(); // Refresh property data including structures
            setIsStructureModalOpen(false);
            setPrefilledPosition(null);
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
          prefilledPosition={prefilledPosition}
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
        <div className="bg-blue-500 opacity-80 rounded-lg p-4 text-white text-center shadow-lg">
          <div className="text-3xl mb-1">{getStructureIcon(draggedStructure.id)}</div>
          <div className="text-sm font-medium">{draggedStructure.name}</div>
          <div className="text-xs">{draggedStructure.width}' × {draggedStructure.length}'</div>
        </div>
      )}
    </DragOverlay>
  </DndContext>
  );
};

export default PropertyDesigner;
