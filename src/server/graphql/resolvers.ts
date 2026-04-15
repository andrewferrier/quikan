import { execSync } from 'child_process';
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

function getGitVersion(): string {
  try {
    return execSync('git describe --tags --always', { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

const GIT_VERSION = getGitVersion();

let testNow: Date | null = null;

export function getNow(): Date {
  return testNow ?? new Date();
}

function localDayStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addLocalDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

interface WeekBounds {
  thisWeekFriday: Date;
  thisSaturday: Date;
  thisSunday: Date;
  nextMonday: Date;
  nextFriday: Date;
  nextSaturday: Date;
  nextSunday: Date;
  nextNextMonday: Date;
  nextNextFriday: Date;
}

function getWeekBounds(today: Date): WeekBounds {
  const dow = today.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const daysSinceMonday = dow === 0 ? 6 : dow - 1;
  const thisMonday = addLocalDays(today, -daysSinceMonday);
  return {
    thisWeekFriday: addLocalDays(thisMonday, 4),
    thisSaturday: addLocalDays(thisMonday, 5),
    thisSunday: addLocalDays(thisMonday, 6),
    nextMonday: addLocalDays(thisMonday, 7),
    nextFriday: addLocalDays(thisMonday, 11),
    nextSaturday: addLocalDays(thisMonday, 12),
    nextSunday: addLocalDays(thisMonday, 13),
    nextNextMonday: addLocalDays(thisMonday, 14),
    nextNextFriday: addLocalDays(thisMonday, 18),
  };
}

interface VirtualColumnDef {
  id: string;
  name: string;
}

/**
 * Returns the ordered list of virtual todo columns for the given day.
 * Order is from least urgent (leftmost / No Due Date) to most urgent (Today).
 */
function getDayColumns(now: Date): VirtualColumnDef[] {
  const today = localDayStart(now);
  const dow = today.getDay();
  const isWeekend = dow === 0 || dow === 6;
  const isMonToWed = dow >= 1 && dow <= 3;

  return [
    { id: 'todo', name: 'Todo (No Due Date)' },
    { id: 'todo-future', name: 'Todo (Future)' },
    ...(isWeekend
      ? [
          { id: 'todo-following-week', name: 'Following Week' },
          { id: 'todo-next-weekend', name: 'Next Weekend' },
          { id: 'todo-coming-week', name: 'Coming Week' },
        ]
      : [{ id: 'todo-next-week', name: 'Todo (Next Week)' }]),
    { id: 'todo-this-weekend', name: 'Todo (This Weekend)' },
    ...(isMonToWed ? [{ id: 'todo-this-week', name: 'Todo (This Week)' }] : []),
    { id: 'todo-tomorrow', name: 'Todo (Tomorrow)' },
    { id: 'todo-today', name: 'Todo (Today)' },
  ];
}

const ALL_VIRTUAL_TODO_COL_IDS = new Set([
  'todo',
  'todo-today',
  'todo-tomorrow',
  'todo-this-week',
  'todo-this-weekend',
  'todo-next-week',
  'todo-future',
  'todo-coming-week',
  'todo-next-weekend',
  'todo-following-week',
]);

/**
 * Compute which virtual todo sub-column a todo card belongs to based on its due date
 * and the current day of week. The column set changes based on the day.
 *
 * - Mon–Wed: Today | Tomorrow | This Week | This Weekend | Next Week | Future | No Due Date
 * - Thu–Fri: Today | Tomorrow | This Weekend | Next Week | Future | No Due Date
 * - Sat–Sun: Today | Tomorrow | This Weekend | Coming Week | Next Weekend | Following Week | Future | No Due Date
 */
export function getTodoVirtualColumn(card: Card, now: Date): string {
  if (!card.due) return 'todo';

  const today = localDayStart(now);
  const tomorrow = addLocalDays(today, 1);
  const dow = today.getDay();
  const bounds = getWeekBounds(today);

  const dueLocalDay = card.dueHasTime
    ? localDayStart(card.due)
    : new Date(card.due.getUTCFullYear(), card.due.getUTCMonth(), card.due.getUTCDate());

  const dueTime = dueLocalDay.getTime();

  if (dueTime <= today.getTime()) return 'todo-today';
  if (dueTime === tomorrow.getTime()) return 'todo-tomorrow';

  if (dow >= 1 && dow <= 3) {
    // Mon–Wed
    if (dueTime <= bounds.thisWeekFriday.getTime()) return 'todo-this-week';
    if (dueTime <= bounds.thisSunday.getTime()) return 'todo-this-weekend';
    if (dueTime <= bounds.nextFriday.getTime()) return 'todo-next-week';
    return 'todo-future';
  }

  if (dow === 4 || dow === 5) {
    // Thu–Fri
    if (dueTime <= bounds.thisSunday.getTime()) return 'todo-this-weekend';
    if (dueTime <= bounds.nextFriday.getTime()) return 'todo-next-week';
    return 'todo-future';
  }

  // Sat (6) or Sun (0)
  if (dueTime <= bounds.thisSunday.getTime()) return 'todo-this-weekend';
  if (dueTime <= bounds.nextFriday.getTime()) return 'todo-coming-week';
  if (dueTime <= bounds.nextSunday.getTime()) return 'todo-next-weekend';
  if (dueTime <= bounds.nextNextFriday.getTime()) return 'todo-following-week';
  return 'todo-future';
}

/**
 * Compute the card field updates needed when dragging to a virtual todo column.
 * Returns 'unchanged' for columns where the due date cannot be meaningfully set
 * (e.g. todo-this-weekend on Saturday/Sunday when the weekend is already today/tomorrow).
 */
export function computeVirtualColumnUpdates(
  targetColumn: string,
  now: Date
): Partial<Card> | 'unchanged' {
  const updates: Partial<Card> = { column: 'todo' };
  const today = localDayStart(now);
  const dow = today.getDay();
  const bounds = getWeekBounds(today);

  const setUTCDate = (d: Date) => {
    updates.due = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    updates.dueHasTime = false;
  };

  if (targetColumn === 'todo-today') {
    setUTCDate(today);
  } else if (targetColumn === 'todo-tomorrow') {
    setUTCDate(addLocalDays(today, 1));
  } else if (targetColumn === 'todo-this-week') {
    // today+2 always falls within the Mon–Wed "this week" range
    setUTCDate(addLocalDays(today, 2));
  } else if (targetColumn === 'todo-this-weekend') {
    // On Sat/Sun the weekend is already covered by Today/Tomorrow, so no-op
    if (dow === 6 || dow === 0) return 'unchanged';
    // On Friday thisSaturday = tomorrow, so use Sunday instead
    setUTCDate(dow === 5 ? bounds.thisSunday : bounds.thisSaturday);
  } else if (targetColumn === 'todo-next-week' || targetColumn === 'todo-coming-week') {
    setUTCDate(bounds.nextMonday);
  } else if (targetColumn === 'todo-next-weekend') {
    setUTCDate(bounds.nextSaturday);
  } else if (targetColumn === 'todo-following-week') {
    setUTCDate(bounds.nextNextMonday);
  } else if (targetColumn === 'todo-future') {
    setUTCDate(addLocalDays(today, 21));
  } else if (targetColumn === 'todo') {
    updates.due = undefined;
    updates.dueHasTime = undefined;
  } else {
    return 'unchanged';
  }

  return updates;
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

async function buildColumns(now: Date): Promise<Column[]> {
  const allCards = await readAllCards();
  const visibleCards = filterOldCompletedCards(allCards, now);

  const todoCards = visibleCards.filter((c) => c.column === 'todo');
  const inProgressCards = visibleCards.filter((c) => c.column === 'in-progress');
  const doneCards = visibleCards.filter((c) => c.column === 'done');

  const totalDone = allCards.filter((c) => c.column === 'done').length;
  const hiddenDoneCount = totalDone - doneCards.length;

  const dayColumns = getDayColumns(now);
  const virtualTodoCols: Column[] = dayColumns.map(({ id, name }) => ({
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
}

export const resolvers = {
  Card: {
    column: (card: Card) => {
      if (card.column !== 'todo') return card.column;
      return getTodoVirtualColumn(card, getNow());
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
      return buildColumns(getNow());
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

    version: (): string => {
      return GIT_VERSION;
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
    ): Promise<Column[]> => {
      const { due: dueDate, dueHasTime } = parseDueInput(due);
      await createCardStorage(
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
      return buildColumns(getNow());
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
    ): Promise<Column[]> => {
      const updates: Partial<Card> = {};
      if (summary !== undefined) updates.summary = summary;
      if (column !== undefined) {
        updates.column = ALL_VIRTUAL_TODO_COL_IDS.has(column) ? 'todo' : column;
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
      await updateCardStorage(id, updates);
      return buildColumns(getNow());
    },

    moveCard: async (
      _: unknown,
      { id, targetColumn }: { id: string; targetColumn: string }
    ): Promise<Column[]> => {
      if (ALL_VIRTUAL_TODO_COL_IDS.has(targetColumn)) {
        const result = computeVirtualColumnUpdates(targetColumn, getNow());
        if (result !== 'unchanged') {
          await updateCardStorage(id, result);
        }
      } else {
        await moveCardStorage(id, targetColumn);
      }
      return buildColumns(getNow());
    },

    deleteCard: async (_: unknown, { id }: { id: string }): Promise<Column[]> => {
      await deleteCardStorage(id);
      return buildColumns(getNow());
    },

    setTestNow: async (_: unknown, { iso }: { iso: string }): Promise<Column[]> => {
      testNow = new Date(iso);
      return buildColumns(getNow());
    },

    clearTestNow: async (): Promise<Column[]> => {
      testNow = null;
      return buildColumns(getNow());
    },
  },
};
