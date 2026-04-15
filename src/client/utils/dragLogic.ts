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

function localDayStart(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function addLocalDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

interface WeekBounds {
  thisSaturday: Date;
  thisSunday: Date;
  nextMonday: Date;
  nextSaturday: Date;
  nextNextMonday: Date;
}

function getWeekBounds(today: Date): WeekBounds {
  const dow = today.getDay();
  const daysToMonday = dow === 0 ? -6 : 1 - dow;
  const thisMonday = addLocalDays(today, daysToMonday);
  return {
    thisSaturday: addLocalDays(thisMonday, 5),
    thisSunday: addLocalDays(thisMonday, 6),
    nextMonday: addLocalDays(thisMonday, 7),
    nextSaturday: addLocalDays(thisMonday, 12),
    nextNextMonday: addLocalDays(thisMonday, 14),
  };
}

function toUTCDate(local: Date): Date {
  return new Date(Date.UTC(local.getFullYear(), local.getMonth(), local.getDate()));
}

/**
 * Computes the optimistic pending move for a card drag.
 * Returns null when the server behaviour is too complex to predict locally
 * (e.g. recurring master dragged to Done, or todo-this-weekend on Sat/Sun which is a no-op).
 */
export function computePendingMove(
  card: CardForPendingMove,
  targetColumn: string,
  now: Date = new Date()
): PendingMove | null {
  if (card.isRecurring && !card.isRecurringChild && targetColumn === 'done') return null;

  const today = localDayStart(now);
  const dow = today.getDay();
  const bounds = getWeekBounds(today);

  // On Sat/Sun, the weekend is already covered by Today/Tomorrow — server no-ops
  if (targetColumn === 'todo-this-weekend' && (dow === 6 || dow === 0)) return null;

  let dueUpdate: DueUpdate;

  if (targetColumn === 'todo-today') {
    dueUpdate = { kind: 'set', due: formatDateOnly(toUTCDate(today)), dueHasTime: false };
  } else if (targetColumn === 'todo-tomorrow') {
    dueUpdate = {
      kind: 'set',
      due: formatDateOnly(toUTCDate(addLocalDays(today, 1))),
      dueHasTime: false,
    };
  } else if (targetColumn === 'todo-this-week') {
    dueUpdate = {
      kind: 'set',
      due: formatDateOnly(toUTCDate(addLocalDays(today, 2))),
      dueHasTime: false,
    };
  } else if (targetColumn === 'todo-this-weekend') {
    const target = dow === 5 ? bounds.thisSunday : bounds.thisSaturday;
    dueUpdate = { kind: 'set', due: formatDateOnly(toUTCDate(target)), dueHasTime: false };
  } else if (targetColumn === 'todo-next-week' || targetColumn === 'todo-coming-week') {
    dueUpdate = {
      kind: 'set',
      due: formatDateOnly(toUTCDate(bounds.nextMonday)),
      dueHasTime: false,
    };
  } else if (targetColumn === 'todo-next-weekend') {
    dueUpdate = {
      kind: 'set',
      due: formatDateOnly(toUTCDate(bounds.nextSaturday)),
      dueHasTime: false,
    };
  } else if (targetColumn === 'todo-following-week') {
    dueUpdate = {
      kind: 'set',
      due: formatDateOnly(toUTCDate(bounds.nextNextMonday)),
      dueHasTime: false,
    };
  } else if (targetColumn === 'todo-future') {
    dueUpdate = {
      kind: 'set',
      due: formatDateOnly(toUTCDate(addLocalDays(today, 21))),
      dueHasTime: false,
    };
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
