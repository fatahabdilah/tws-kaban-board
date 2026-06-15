// Fractional positioning for drag-and-drop ordering.
// Positions are `numeric` in Postgres; we read/write them as JS numbers
// (safe for the depth a Kanban board reaches) and place items by midpoint.

export const POSITION_GAP = 65536;

/** Position for appending after the current max (or first item). */
export function appendPosition(maxPosition: number | null | undefined): number {
  if (maxPosition == null) return POSITION_GAP;
  return maxPosition + POSITION_GAP;
}

/**
 * Compute a position that sorts between `before` and `after`.
 * - before == null  -> insert at the very start
 * - after  == null  -> append at the end
 */
export function positionBetween(
  before: number | null | undefined,
  after: number | null | undefined
): number {
  if (before == null && after == null) return POSITION_GAP;
  if (before == null) return after! / 2;
  if (after == null) return before + POSITION_GAP;
  return (before + after) / 2;
}
