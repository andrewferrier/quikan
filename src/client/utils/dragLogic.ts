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

export type DueUpdate =
  | { kind: 'unchanged' }
  | { kind: 'clear' }
  | { kind: 'set'; due: string; dueHasTime: boolean };

export interface PendingMove {
  cardId: string;
  targetColumn: string;
  dueUpdate: DueUpdate;
}

interface CardForPendingMove {
  id: string;
  isRecurring?: boolean | null;
  isRecurringChild?: boolean | null;
}

function formatDateOnly(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Computes the optimistic pending move for a card drag.
 * Returns null when the server behaviour is too complex to predict locally
 * (recurring master dragged to Done, or todo-dated which is a server no-op).
 */
export function computePendingMove(
  card: CardForPendingMove,
  targetColumn: string
): PendingMove | null {
  if (card.isRecurring && !card.isRecurringChild && targetColumn === 'done') return null;
  if (targetColumn === 'todo-dated') return null;

  const now = new Date();
  let dueUpdate: DueUpdate;

  if (targetColumn === 'todo-today') {
    const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    dueUpdate = { kind: 'set', due: formatDateOnly(d), dueHasTime: false };
  } else if (targetColumn === 'todo-tomorrow') {
    const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() + 1));
    dueUpdate = { kind: 'set', due: formatDateOnly(d), dueHasTime: false };
  } else if (targetColumn === 'todo-this-week') {
    const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() + 2));
    dueUpdate = { kind: 'set', due: formatDateOnly(d), dueHasTime: false };
  } else if (targetColumn === 'todo') {
    dueUpdate = { kind: 'clear' };
  } else {
    dueUpdate = { kind: 'unchanged' };
  }

  return { cardId: card.id, targetColumn, dueUpdate };
}

/**
 * Applies a list of pending optimistic moves to a snapshot of columns,
 * producing the columns array to display while mutations are in-flight.
 * Cards being moved appear in their target column with updated due/dueHasTime.
 */
export function applyPendingMoves<
  C extends { id: string; column: string; due?: string | null; dueHasTime?: boolean | null },
  Col extends { id: string; cards: C[] },
>(columns: Col[], pendingMoves: PendingMove[]): Col[] {
  if (pendingMoves.length === 0) return columns;

  const pendingById = new Map(pendingMoves.map((m) => [m.cardId, m]));

  const movingCards = new Map<string, C>();
  for (const col of columns) {
    for (const card of col.cards) {
      if (pendingById.has(card.id)) movingCards.set(card.id, card);
    }
  }

  return columns.map((col) => {
    const stayingCards = col.cards.filter((c) => !pendingById.has(c.id));
    const arrivingCards: C[] = pendingMoves
      .filter((m) => m.targetColumn === col.id)
      .map((m) => {
        const card = movingCards.get(m.cardId);
        if (!card) return null;
        let due = card.due;
        let dueHasTime = card.dueHasTime;
        if (m.dueUpdate.kind === 'clear') {
          due = null;
          dueHasTime = null;
        } else if (m.dueUpdate.kind === 'set') {
          due = m.dueUpdate.due;
          dueHasTime = m.dueUpdate.dueHasTime;
        }
        return { ...card, column: m.targetColumn, due, dueHasTime } as unknown as C;
      })
      .filter((c): c is C => c !== null);

    if (arrivingCards.length === 0 && stayingCards.length === col.cards.length) return col;
    return { ...col, cards: [...stayingCards, ...arrivingCards] };
  });
}
