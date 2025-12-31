/**
 * Grid Coordinate Utilities
 *
 * Converts between numeric grid coordinates (0-indexed) and user-friendly
 * grid labels (A1, B2, C3, etc.) for garden bed layouts.
 *
 * Coordinate System:
 * - Database: position_x (column), position_y (row) - zero-indexed
 * - Grid Label: Column Letter (A-Z) + Row Number (1-based)
 *
 * Examples:
 * - (0, 0) → "A1"
 * - (1, 2) → "B3"
 * - "A1" → { x: 0, y: 0 }
 * - "D4" → { x: 3, y: 3 }
 */

export interface GridCoordinate {
  x: number;
  y: number;
}

export interface GridValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Convert numeric grid coordinates to grid label (e.g., A1, B2)
 *
 * @param x - Column index (0-indexed)
 * @param y - Row index (0-indexed)
 * @returns Grid label string (e.g., "A1", "B2")
 *
 * @example
 * coordinateToGridLabel(0, 0) // "A1"
 * coordinateToGridLabel(1, 2) // "B3"
 * coordinateToGridLabel(25, 0) // "Z1"
 */
export function coordinateToGridLabel(x: number, y: number): string {
  // Column: A-Z for 0-25, AA-AZ for 26-51, etc. (like Excel)
  let colLabel = '';
  let colNum = x;

  while (colNum >= 0) {
    colLabel = String.fromCharCode(65 + (colNum % 26)) + colLabel;
    colNum = Math.floor(colNum / 26) - 1;
  }

  // Row: 1-based (y=0 → "1", y=1 → "2")
  const rowLabel = (y + 1).toString();

  return colLabel + rowLabel;
}

/**
 * Convert grid label to numeric coordinates
 *
 * @param label - Grid label (e.g., "A1", "B2", "AA1")
 * @returns Coordinate object { x, y } or null if invalid format
 *
 * @example
 * gridLabelToCoordinate("A1") // { x: 0, y: 0 }
 * gridLabelToCoordinate("B3") // { x: 1, y: 2 }
 * gridLabelToCoordinate("invalid") // null
 */
export function gridLabelToCoordinate(label: string): GridCoordinate | null {
  if (!label || typeof label !== 'string') {
    return null;
  }

  // Normalize: trim whitespace, convert to uppercase
  const normalized = label.trim().toUpperCase();

  // Match pattern: Letters followed by numbers (e.g., "A1", "AB12", "Z99")
  const match = normalized.match(/^([A-Z]+)(\d+)$/);

  if (!match) {
    return null; // Invalid format
  }

  const colPart = match[1];
  const rowPart = match[2];

  // Convert column letters to x coordinate (A=0, B=1, ..., Z=25, AA=26, etc.)
  let x = 0;
  for (let i = 0; i < colPart.length; i++) {
    const charCode = colPart.charCodeAt(i) - 65; // A=0, B=1, etc.
    x = x * 26 + charCode + (i > 0 ? 1 : 0);
  }

  // Convert row number to y coordinate (1-based to 0-indexed)
  const y = parseInt(rowPart, 10) - 1;

  // Validate row number is positive
  if (y < 0) {
    return null; // Row must be >= 1
  }

  return { x, y };
}

/**
 * Validate a grid label against bed dimensions
 *
 * @param label - Grid label to validate (e.g., "A1", "B2")
 * @param gridWidth - Number of columns in bed
 * @param gridHeight - Number of rows in bed
 * @returns Validation result with error message if invalid
 *
 * @example
 * isValidGridLabel("A1", 4, 4) // { valid: true }
 * isValidGridLabel("E1", 4, 4) // { valid: false, error: "Column E is out of bounds..." }
 * isValidGridLabel("A5", 4, 4) // { valid: false, error: "Row 5 is out of bounds..." }
 */
export function isValidGridLabel(
  label: string,
  gridWidth: number,
  gridHeight: number
): GridValidationResult {
  // Parse the label
  const coord = gridLabelToCoordinate(label);

  if (!coord) {
    return {
      valid: false,
      error: `"${label}" is not a valid grid label. Use format like "A1" (column letter + row number).`
    };
  }

  // Check column bounds
  if (coord.x < 0 || coord.x >= gridWidth) {
    const maxCol = coordinateToGridLabel(gridWidth - 1, 0).replace(/\d+$/, '');
    return {
      valid: false,
      error: `Column "${label.match(/^[A-Z]+/)?.[0]}" is out of bounds. This bed has columns A-${maxCol}.`
    };
  }

  // Check row bounds
  if (coord.y < 0 || coord.y >= gridHeight) {
    return {
      valid: false,
      error: `Row ${coord.y + 1} is out of bounds. This bed has rows 1-${gridHeight}.`
    };
  }

  return { valid: true };
}

/**
 * Get maximum column label for a bed (e.g., "D" for 4 columns)
 *
 * @param gridWidth - Number of columns in bed
 * @returns Maximum column label
 *
 * @example
 * getMaxColumnLabel(4) // "D"
 * getMaxColumnLabel(26) // "Z"
 * getMaxColumnLabel(27) // "AA"
 */
export function getMaxColumnLabel(gridWidth: number): string {
  if (gridWidth <= 0) return '';
  return coordinateToGridLabel(gridWidth - 1, 0).replace(/\d+$/, '');
}

/**
 * Get grid bounds description for error messages
 *
 * @param gridWidth - Number of columns
 * @param gridHeight - Number of rows
 * @returns Human-readable bounds description
 *
 * @example
 * getGridBoundsDescription(4, 3) // "columns A-D and rows 1-3"
 */
export function getGridBoundsDescription(gridWidth: number, gridHeight: number): string {
  const maxCol = getMaxColumnLabel(gridWidth);
  return `columns A-${maxCol} and rows 1-${gridHeight}`;
}
