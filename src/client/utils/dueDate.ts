export type DueColor = 'red' | 'green' | 'grey';

export interface DueDisplay {
  text: string;
  color: DueColor;
}

/**
 * Format a due date string for display.
 *
 * - Date-only strings ("YYYY-MM-DD") are treated as local calendar dates.
 * - DateTime strings ("YYYY-MM-DDTHH:mm:ss.sssZ") are converted to local time.
 * - Dates within the window [yesterday, today+7) are shown as a day of the week.
 * - All other dates are shown in ISO-8601 format.
 * - Past dates/times are red; today (not yet past) is green; future is grey.
 *
 * The `now` parameter exists for testability; defaults to the current time.
 */
export function formatDue(dueStr: string, dueHasTime: boolean, now = new Date()): DueDisplay {
  const dueDate = dueHasTime ? new Date(dueStr) : new Date(dueStr + 'T00:00:00'); // local midnight for date-only

  // If time is midnight (00:00 local), present as date-only
  const effectiveHasTime = dueHasTime && (dueDate.getHours() !== 0 || dueDate.getMinutes() !== 0);

  return {
    text: buildText(dueDate, effectiveHasTime, now),
    color: buildColor(dueDate, effectiveHasTime, now),
  };
}

function buildColor(dueDate: Date, hasTime: boolean, now: Date): DueColor {
  if (hasTime) {
    if (dueDate < now) return 'red';
    if (isSameLocalDay(dueDate, now)) return 'green';
    return 'grey';
  }
  const dueDay = localDayStart(dueDate);
  const todayDay = localDayStart(now);
  if (dueDay < todayDay) return 'red';
  if (dueDay.getTime() === todayDay.getTime()) return 'green';
  return 'grey';
}

function buildText(dueDate: Date, hasTime: boolean, now: Date): string {
  const todayStart = localDayStart(now);

  const windowStart = new Date(todayStart);
  windowStart.setDate(windowStart.getDate() - 1); // include yesterday

  const windowEnd = new Date(todayStart);
  windowEnd.setDate(windowEnd.getDate() + 7); // exclude today+7

  const dueDayStart = localDayStart(dueDate);
  const useDayOfWeek = dueDayStart >= windowStart && dueDayStart < windowEnd;

  const timeStr = hasTime
    ? ` ${String(dueDate.getHours()).padStart(2, '0')}:${String(dueDate.getMinutes()).padStart(2, '0')}`
    : '';

  if (useDayOfWeek) {
    const dayName = dueDate.toLocaleDateString('en-US', { weekday: 'long' });
    return dayName + timeStr;
  }

  const y = dueDate.getFullYear();
  const m = String(dueDate.getMonth() + 1).padStart(2, '0');
  const d = String(dueDate.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}${timeStr}`;
}

function localDayStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function dateToStr(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

/**
 * Returns the earliest YYYY-MM-DD due date that makes a task eligible for
 * the given virtual column, or undefined for the "no due date" column.
 * Mirrors the server's computeVirtualColumnUpdates logic.
 */
export function getEarliestDueForColumn(columnId: string, now = new Date()): string | undefined {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dow = today.getDay();
  const daysSinceMonday = dow === 0 ? 6 : dow - 1;
  const thisMonday = addDays(today, -daysSinceMonday);

  const bounds = {
    thisSunday: addDays(thisMonday, 6),
    nextMonday: addDays(thisMonday, 7),
    nextSaturday: addDays(thisMonday, 12),
    nextNextMonday: addDays(thisMonday, 14),
  };

  switch (columnId) {
    case 'todo-today':
    case 'in-progress':
      return dateToStr(today);
    case 'todo-tomorrow':
      return dateToStr(addDays(today, 1));
    case 'todo-this-week':
      return dateToStr(addDays(today, 2));
    case 'todo-this-weekend':
      // On Friday, thisSaturday === tomorrow, so use Sunday instead
      return dateToStr(dow === 5 ? bounds.thisSunday : addDays(thisMonday, 5));
    case 'todo-next-week':
    case 'todo-coming-week':
      return dateToStr(bounds.nextMonday);
    case 'todo-next-weekend':
      return dateToStr(bounds.nextSaturday);
    case 'todo-following-week':
      return dateToStr(bounds.nextNextMonday);
    case 'todo-future':
      return dateToStr(addDays(today, 21));
    default:
      return undefined;
  }
}
