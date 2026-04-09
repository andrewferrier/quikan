import {
  readAllCards,
  readCard,
  readClonesOf,
  readParentOf,
  createCard as createCardStorage,
  updateCard as updateCardStorage,
  moveCard as moveCardStorage,
  deleteCard as deleteCardStorage,
  formatRruleText,
} from '../storage/vtodo.js';
import { Card, Column } from '../types.js';

const VIRTUAL_TODO_COLUMNS = [
  { id: 'todo', name: 'Todo (No Due Date)' },
  { id: 'todo-dated', name: 'Todo (Dated)' },
  { id: 'todo-this-week', name: 'Todo (This Week)' },
  { id: 'todo-tomorrow', name: 'Todo (Tomorrow)' },
  { id: 'todo-today', name: 'Todo (Today)' },
] as const;

const VIRTUAL_TODO_COL_IDS = new Set<string>(VIRTUAL_TODO_COLUMNS.map((c) => c.id));

/**
 * Compute which virtual todo sub-column a todo card belongs to based on its due date.
 * Cards are categorised by how far their due date is from today (local time).
 */
export function getTodoVirtualColumn(card: Card, now: Date): string {
  if (!card.due) return 'todo';

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  // "This week" = today+2 through today+7 inclusive; "Future" = today+8+
  const weekEndExclusive = new Date(todayStart);
  weekEndExclusive.setDate(weekEndExclusive.getDate() + 8);

  // For datetime cards use local date components; for date-only use UTC (stored as UTC midnight)
  const dueLocalDay = card.dueHasTime
    ? new Date(card.due.getFullYear(), card.due.getMonth(), card.due.getDate())
    : new Date(card.due.getUTCFullYear(), card.due.getUTCMonth(), card.due.getUTCDate());

  if (dueLocalDay < tomorrowStart) return 'todo-today';
  if (dueLocalDay.getTime() === tomorrowStart.getTime()) return 'todo-tomorrow';
  if (dueLocalDay < weekEndExclusive) return 'todo-this-week';
  return 'todo-dated';
}

function formatDueField(card: Card): string | null {
  if (!card.due) return null;
  if (!card.dueHasTime) {
    const y = card.due.getUTCFullYear();
    const m = String(card.due.getUTCMonth() + 1).padStart(2, '0');
    const d = String(card.due.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return card.due.toISOString();
}

export function parseDueInput(due: string | null | undefined): {
  due?: Date;
  dueHasTime?: boolean;
} {
  if (!due) return { due: undefined, dueHasTime: undefined };
  const hasTime = due.includes('T');
  if (hasTime) {
    return { due: new Date(due), dueHasTime: true };
  }
  const [year, month, day] = due.split('-').map(Number);
  return { due: new Date(Date.UTC(year, month - 1, day)), dueHasTime: false };
}

export function parseRdatesInput(dates: string[] | null | undefined): Date[] | undefined {
  if (!dates || dates.length === 0) return undefined;
  return dates.map((d) => new Date(d));
}

/** Sort cards by due date (oldest first). No-due cards go last, then alphabetically. */
export function sortCardsByDue(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => {
    if (!a.due && !b.due) return a.summary.toLowerCase().localeCompare(b.summary.toLowerCase());
    if (!a.due) return 1;
    if (!b.due) return -1;
    const timeDiff = a.due.getTime() - b.due.getTime();
    if (timeDiff !== 0) return timeDiff;
    return a.summary.toLowerCase().localeCompare(b.summary.toLowerCase());
  });
}

/** Sort done cards by completed date, most recent first. */
export function sortDoneCards(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => {
    const aTime = (a.completed ?? a.modified).getTime();
    const bTime = (b.completed ?? b.modified).getTime();
    if (bTime !== aTime) return bTime - aTime;
    return a.summary.toLowerCase().localeCompare(b.summary.toLowerCase());
  });
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/** Filter out completed cards that were completed more than 30 days ago. */
export function filterOldCompletedCards(cards: Card[], now: Date = new Date()): Card[] {
  return cards.filter((card) => {
    if (card.column !== 'done') return true;
    const completionDate = card.completed ?? card.modified;
    return now.getTime() - completionDate.getTime() <= THIRTY_DAYS_MS;
  });
}

/**
 * Compute the card field updates needed when dragging to a virtual todo column.
 * Returns 'unchanged' for `todo-dated` (a date must be set explicitly via edit).
 */
export function computeVirtualColumnUpdates(
  targetColumn: string,
  now: Date
): Partial<Card> | 'unchanged' {
  const updates: Partial<Card> = { column: 'todo' };

  if (targetColumn === 'todo-today') {
    updates.due = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    updates.dueHasTime = false;
  } else if (targetColumn === 'todo-tomorrow') {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    updates.due = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    updates.dueHasTime = false;
  } else if (targetColumn === 'todo-this-week') {
    const d = new Date(now);
    d.setDate(d.getDate() + 2);
    updates.due = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    updates.dueHasTime = false;
  } else if (targetColumn === 'todo-dated') {
    return 'unchanged';
  } else {
    // 'todo' — no date
    updates.due = undefined;
    updates.dueHasTime = undefined;
  }

  return updates;
}

export const resolvers = {
  Card: {
    column: (card: Card) => {
      if (card.column !== 'todo') return card.column;
      return getTodoVirtualColumn(card, new Date());
    },
    due: (card: Card) => formatDueField(card),
    dueHasTime: (card: Card) => card.dueHasTime ?? null,
    completed: (card: Card) => card.completed?.toISOString() ?? null,
    priority: (card: Card) => card.priority ?? null,
    isRecurring: (card: Card) => !!(card.rrule || card.quikanRecurrenceId),
    isRecurringChild: (card: Card) => !!card.quikanRecurrenceId,
    quikanRecurrenceId: (card: Card) => card.quikanRecurrenceId ?? null,
    rrule: (card: Card) => card.rrule ?? null,
    rruleText: (card: Card) => formatRruleText(card),
    rruleSupported: (card: Card) => card.rruleSupported ?? null,
    rdates: (card: Card) => card.rdates?.map((d) => d.toISOString()) ?? [],
    exdates: (card: Card) => card.exdates?.map((d) => d.toISOString()) ?? [],
    uid: (card: Card) => card.uid,
  },

  Query: {
    cards: async (): Promise<Card[]> => {
      return await readAllCards();
    },

    card: async (_: unknown, { id }: { id: string }): Promise<Card | null> => {
      return await readCard(id);
    },

    columns: async (): Promise<Column[]> => {
      const now = new Date();
      const allCards = await readAllCards();
      const visibleCards = filterOldCompletedCards(allCards, now);

      const todoCards = visibleCards.filter((c) => c.column === 'todo');
      const inProgressCards = visibleCards.filter((c) => c.column === 'in-progress');
      const doneCards = visibleCards.filter((c) => c.column === 'done');

      const totalDone = allCards.filter((c) => c.column === 'done').length;
      const hiddenDoneCount = totalDone - doneCards.length;

      const virtualTodoCols: Column[] = VIRTUAL_TODO_COLUMNS.map(({ id, name }) => ({
        id,
        name,
        hiddenCount: 0,
        cards: sortCardsByDue(todoCards.filter((card) => getTodoVirtualColumn(card, now) === id)),
      }));

      return [
        ...virtualTodoCols,
        {
          id: 'in-progress',
          name: 'In Progress',
          hiddenCount: 0,
          cards: sortCardsByDue(inProgressCards),
        },
        { id: 'done', name: 'Done', hiddenCount: hiddenDoneCount, cards: sortDoneCards(doneCards) },
      ];
    },

    cardClones: async (_: unknown, { id }: { id: string }): Promise<Card[]> => {
      const card = await readCard(id);
      if (!card) return [];
      return await readClonesOf(card.uid);
    },

    cardParent: async (_: unknown, { id }: { id: string }): Promise<Card | null> => {
      const card = await readCard(id);
      if (!card?.quikanRecurrenceId) return null;
      return await readParentOf(card.quikanRecurrenceId);
    },
  },

  Mutation: {
    createCard: async (
      _: unknown,
      {
        summary,
        column,
        due,
        priority,
        description,
        rrule,
        rdates,
        exdates,
      }: {
        summary: string;
        column: string;
        due?: string;
        priority?: number;
        description?: string;
        rrule?: string;
        rdates?: string[];
        exdates?: string[];
      }
    ): Promise<Card> => {
      const { due: dueDate, dueHasTime } = parseDueInput(due);
      return await createCardStorage(
        summary,
        column,
        dueDate,
        dueHasTime,
        priority,
        description,
        rrule,
        parseRdatesInput(rdates),
        parseRdatesInput(exdates)
      );
    },

    updateCard: async (
      _: unknown,
      {
        id,
        summary,
        column,
        due,
        priority,
        description,
        rrule,
        rdates,
        exdates,
      }: {
        id: string;
        summary?: string;
        column?: string;
        due?: string | null;
        priority?: number | null;
        description?: string | null;
        rrule?: string | null;
        rdates?: string[] | null;
        exdates?: string[] | null;
      }
    ): Promise<Card | null> => {
      const updates: Partial<Card> = {};
      if (summary !== undefined) updates.summary = summary;
      if (column !== undefined) {
        updates.column = VIRTUAL_TODO_COL_IDS.has(column) ? 'todo' : column;
      }
      if (description !== undefined) {
        updates.description = description === null ? undefined : description;
      }
      if (due !== undefined) {
        if (due === null) {
          updates.due = undefined;
          updates.dueHasTime = undefined;
        } else {
          const parsed = parseDueInput(due);
          updates.due = parsed.due;
          updates.dueHasTime = parsed.dueHasTime;
        }
      }
      if (priority !== undefined) {
        updates.priority = priority === null ? undefined : priority;
      }
      if (rrule !== undefined) {
        updates.rrule = rrule === null ? undefined : rrule;
        updates.rruleSupported = rrule ? true : undefined;
      }
      if (rdates !== undefined) {
        updates.rdates = rdates === null ? undefined : parseRdatesInput(rdates);
      }
      if (exdates !== undefined) {
        updates.exdates = exdates === null ? undefined : parseRdatesInput(exdates);
      }
      return await updateCardStorage(id, updates);
    },

    moveCard: async (
      _: unknown,
      { id, targetColumn }: { id: string; targetColumn: string }
    ): Promise<Card | null> => {
      if (VIRTUAL_TODO_COL_IDS.has(targetColumn)) {
        const result = computeVirtualColumnUpdates(targetColumn, new Date());
        if (result === 'unchanged') {
          return await readCard(id);
        }
        return await updateCardStorage(id, result);
      }

      return await moveCardStorage(id, targetColumn);
    },

    deleteCard: async (_: unknown, { id }: { id: string }): Promise<boolean> => {
      try {
        await deleteCardStorage(id);
        return true;
      } catch (error) {
        console.error('Error deleting card:', error);
        return false;
      }
    },
  },
};
