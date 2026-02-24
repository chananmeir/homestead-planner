/**
 * Canonical completion check for PlantingEvents.
 * Mirrors backend PlantingEvent.is_complete property.
 *
 * Prefers quantityCompleted >= quantity when both are set,
 * falls back to completed boolean.
 */
export function isEventComplete(
  event: { completed?: boolean; quantityCompleted?: number; quantity?: number }
): boolean {
  if (event.quantity != null && event.quantityCompleted != null) {
    return event.quantityCompleted >= event.quantity;
  }
  return Boolean(event.completed);
}
