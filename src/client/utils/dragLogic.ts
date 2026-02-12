/**
 * Pure drag-and-drop logic — extracted for testability.
 */

export interface DraggableCard {
  id: string;
  column: string;
}

/**
 * Returns true if the drag should result in a move mutation.
 * Moves are only performed when the card is dropped onto a *different* column.
 */
export function shouldPerformMove(
  cards: DraggableCard[],
  activeId: string,
  targetColumnId: string | undefined | null
): boolean {
  if (!targetColumnId) return false;
  const card = cards.find((c) => c.id === activeId);
  if (!card) return false;
  return card.column !== targetColumnId;
}
