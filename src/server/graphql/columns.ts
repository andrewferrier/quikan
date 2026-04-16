import { readAllCards } from '../storage/vtodo.js';
import { Card, Column } from '../types.js';

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
export function getDayColumns(now: Date): VirtualColumnDef[] {
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

export const ALL_VIRTUAL_TODO_COL_IDS = new Set([
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
  now: Date,
  existingCard?: Card
): Partial<Card> | 'unchanged' {
  const updates: Partial<Card> = { column: 'todo' };
  const today = localDayStart(now);
  const dow = today.getDay();
  const bounds = getWeekBounds(today);

  const setDate = (d: Date) => {
    if (existingCard?.dueHasTime && existingCard?.due) {
      const existing = existingCard.due;
      updates.due = new Date(
        d.getFullYear(),
        d.getMonth(),
        d.getDate(),
        existing.getHours(),
        existing.getMinutes(),
        existing.getSeconds(),
        existing.getMilliseconds()
      );
      updates.dueHasTime = true;
    } else {
      updates.due = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
      updates.dueHasTime = false;
    }
  };

  if (targetColumn === 'todo-today') {
    setDate(today);
  } else if (targetColumn === 'todo-tomorrow') {
    setDate(addLocalDays(today, 1));
  } else if (targetColumn === 'todo-this-week') {
    // today+2 always falls within the Mon–Wed "this week" range
    setDate(addLocalDays(today, 2));
  } else if (targetColumn === 'todo-this-weekend') {
    // On Sat/Sun the weekend is already covered by Today/Tomorrow, so no-op
    if (dow === 6 || dow === 0) return 'unchanged';
    // On Friday thisSaturday = tomorrow, so use Sunday instead
    setDate(dow === 5 ? bounds.thisSunday : bounds.thisSaturday);
  } else if (targetColumn === 'todo-next-week' || targetColumn === 'todo-coming-week') {
    setDate(bounds.nextMonday);
  } else if (targetColumn === 'todo-next-weekend') {
    setDate(bounds.nextSaturday);
  } else if (targetColumn === 'todo-following-week') {
    setDate(bounds.nextNextMonday);
  } else if (targetColumn === 'todo-future') {
    setDate(addLocalDays(today, 21));
  } else if (targetColumn === 'todo') {
    updates.due = undefined;
    updates.dueHasTime = undefined;
  } else {
    return 'unchanged';
  }

  return updates;
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

export async function buildColumns(now: Date): Promise<Column[]> {
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
