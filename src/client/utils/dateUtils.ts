export function localDayStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

export function formatLocalDate(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

export interface WeekBounds {
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

export function getWeekBounds(today: Date): WeekBounds {
  const dow = today.getDay();
  const daysSinceMonday = dow === 0 ? 6 : dow - 1;
  const thisMonday = addDays(today, -daysSinceMonday);
  return {
    thisWeekFriday: addDays(thisMonday, 4),
    thisSaturday: addDays(thisMonday, 5),
    thisSunday: addDays(thisMonday, 6),
    nextMonday: addDays(thisMonday, 7),
    nextFriday: addDays(thisMonday, 11),
    nextSaturday: addDays(thisMonday, 12),
    nextSunday: addDays(thisMonday, 13),
    nextNextMonday: addDays(thisMonday, 14),
    nextNextFriday: addDays(thisMonday, 18),
  };
}
