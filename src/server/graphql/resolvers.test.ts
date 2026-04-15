import {
  sortCardsByDue,
  filterOldCompletedCards,
  sortDoneCards,
  getTodoVirtualColumn,
  parseDueInput,
  parseRdatesInput,
  computeVirtualColumnUpdates,
} from './resolvers';
import { Card } from '../types';

const base: Omit<Card, 'id' | 'uid' | 'due' | 'dueHasTime'> = {
  summary: 'Test',
  column: 'todo',
  created: new Date('2026-01-01T00:00:00Z'),
  modified: new Date('2026-01-01T00:00:00Z'),
};

function card(id: string, summary: string, due?: Date, dueHasTime?: boolean): Card {
  return { ...base, id, uid: id, summary, due, dueHasTime };
}

describe('sortCardsByDue', () => {
  it('sorts cards by due date, oldest first', () => {
    const cards = [
      card('c', 'C', new Date('2026-04-03T10:00:00Z'), true),
      card('a', 'A', new Date('2026-04-01T10:00:00Z'), true),
      card('b', 'B', new Date('2026-04-02T10:00:00Z'), true),
    ];
    const sorted = sortCardsByDue(cards);
    expect(sorted.map((c) => c.id)).toEqual(['a', 'b', 'c']);
  });

  it('places cards without a due date last', () => {
    const cards = [
      card('no-due', 'No due'),
      card('has-due', 'Has due', new Date('2026-04-01T10:00:00Z'), true),
    ];
    const sorted = sortCardsByDue(cards);
    expect(sorted[0].id).toBe('has-due');
    expect(sorted[1].id).toBe('no-due');
  });

  it('sorts alphabetically when multiple cards lack a due date', () => {
    const cards = [card('3', 'Zebra'), card('1', 'Apple'), card('2', 'Mango')];
    const sorted = sortCardsByDue(cards);
    expect(sorted.map((c) => c.summary)).toEqual(['Apple', 'Mango', 'Zebra']);
  });

  it('sorts alphabetically when cards share the same due date', () => {
    const sharedDue = new Date('2026-04-01T10:00:00Z');
    const cards = [
      card('3', 'Zebra', sharedDue, true),
      card('1', 'Apple', sharedDue, true),
      card('2', 'Mango', sharedDue, true),
    ];
    const sorted = sortCardsByDue(cards);
    expect(sorted.map((c) => c.summary)).toEqual(['Apple', 'Mango', 'Zebra']);
  });

  it('alphabetical sort is case-insensitive', () => {
    const sharedDue = new Date('2026-04-01T00:00:00Z');
    const cards = [card('2', 'banana', sharedDue, false), card('1', 'Apple', sharedDue, false)];
    const sorted = sortCardsByDue(cards);
    expect(sorted.map((c) => c.summary)).toEqual(['Apple', 'banana']);
  });

  it('handles a mix of due and no-due cards', () => {
    const cards = [
      card('no-due-2', 'Beta'),
      card('later', 'Beta', new Date('2026-06-01T00:00:00Z'), false),
      card('no-due-1', 'Alpha'),
      card('earlier', 'Alpha', new Date('2026-04-01T00:00:00Z'), false),
    ];
    const sorted = sortCardsByDue(cards);
    expect(sorted.map((c) => c.id)).toEqual(['earlier', 'later', 'no-due-1', 'no-due-2']);
  });

  it('returns a new array, does not mutate the input', () => {
    const cards = [
      card('b', 'B', new Date('2026-04-02T00:00:00Z'), false),
      card('a', 'A', new Date('2026-04-01T00:00:00Z'), false),
    ];
    const original = [...cards];
    sortCardsByDue(cards);
    expect(cards.map((c) => c.id)).toEqual(original.map((c) => c.id));
  });

  it('handles an empty array', () => {
    expect(sortCardsByDue([])).toEqual([]);
  });

  it('handles a single card', () => {
    const cards = [card('only', 'Only', new Date('2026-04-01T00:00:00Z'), false)];
    expect(sortCardsByDue(cards).map((c) => c.id)).toEqual(['only']);
  });
});

describe('filterOldCompletedCards', () => {
  const now = new Date('2026-04-01T12:00:00Z');
  const recentDate = new Date('2026-03-15T12:00:00Z'); // 17 days ago
  const oldDate = new Date('2026-02-01T12:00:00Z'); // 59 days ago
  const exactlyThirtyDays = new Date('2026-03-02T12:00:00Z'); // 30 days ago

  function doneCard(id: string, completed?: Date, modified?: Date): Card {
    return {
      id,
      uid: id,
      summary: id,
      column: 'done',
      created: new Date('2026-01-01T00:00:00Z'),
      modified: modified ?? completed ?? new Date('2026-01-01T00:00:00Z'),
      completed,
    };
  }

  function todoCard(id: string): Card {
    return {
      id,
      uid: id,
      summary: id,
      column: 'todo',
      created: new Date('2026-01-01T00:00:00Z'),
      modified: new Date('2026-01-01T00:00:00Z'),
    };
  }

  it('keeps non-done cards regardless of age', () => {
    const cards = [todoCard('t1')];
    expect(filterOldCompletedCards(cards, now)).toHaveLength(1);
  });

  it('keeps recently completed cards (within 30 days)', () => {
    const cards = [doneCard('d1', recentDate)];
    expect(filterOldCompletedCards(cards, now)).toHaveLength(1);
  });

  it('removes completed cards older than 30 days', () => {
    const cards = [doneCard('d2', oldDate)];
    expect(filterOldCompletedCards(cards, now)).toHaveLength(0);
  });

  it('keeps cards completed exactly 30 days ago', () => {
    const cards = [doneCard('d3', exactlyThirtyDays)];
    expect(filterOldCompletedCards(cards, now)).toHaveLength(1);
  });

  it('falls back to modified date when completed is absent', () => {
    const recentModified = doneCard('d4', undefined, recentDate);
    const oldModified = doneCard('d5', undefined, oldDate);
    const result = filterOldCompletedCards([recentModified, oldModified], now);
    expect(result.map((c) => c.id)).toEqual(['d4']);
  });

  it('mixes done and non-done cards correctly', () => {
    const cards = [
      todoCard('todo'),
      doneCard('recent-done', recentDate),
      doneCard('old-done', oldDate),
    ];
    const result = filterOldCompletedCards(cards, now);
    expect(result.map((c) => c.id)).toEqual(['todo', 'recent-done']);
  });
});

describe('sortDoneCards', () => {
  const t = (iso: string) => new Date(iso);

  const card = (id: string, completed?: Date, modified?: Date): Card => ({
    ...base,
    id,
    uid: id,
    column: 'done',
    completed,
    modified: modified ?? new Date('2026-01-01T00:00:00Z'),
  });

  it('sorts most recently completed first', () => {
    const cards = [
      card('a', t('2026-01-01T10:00:00Z')),
      card('b', t('2026-03-01T10:00:00Z')),
      card('c', t('2026-02-01T10:00:00Z')),
    ];
    const sorted = sortDoneCards(cards);
    expect(sorted.map((c) => c.id)).toEqual(['b', 'c', 'a']);
  });

  it('uses modified date as fallback when completed is absent', () => {
    const cards = [
      card('a', undefined, t('2026-01-01T00:00:00Z')),
      card('b', undefined, t('2026-03-01T00:00:00Z')),
    ];
    const sorted = sortDoneCards(cards);
    expect(sorted.map((c) => c.id)).toEqual(['b', 'a']);
  });

  it('breaks ties alphabetically', () => {
    const same = t('2026-03-01T00:00:00Z');
    const cards = [
      { ...card('z', same), summary: 'Zebra' },
      { ...card('a', same), summary: 'Apple' },
    ];
    const sorted = sortDoneCards(cards);
    expect(sorted.map((c) => c.id)).toEqual(['a', 'z']);
  });

  it('returns an empty array unchanged', () => {
    expect(sortDoneCards([])).toEqual([]);
  });

  it('does not mutate the input array', () => {
    const cards = [card('b', t('2026-01-01T00:00:00Z')), card('a', t('2026-03-01T00:00:00Z'))];
    const original = [...cards];
    sortDoneCards(cards);
    expect(cards).toEqual(original);
  });
});

// Tests run with TZ=UTC.
// NOW_WED = 2026-04-01 (Wednesday), week: Mon Mar 30 – Fri Apr 3 – Sat Apr 4 – Sun Apr 5
// NOW_THU = 2026-04-02 (Thursday)
// NOW_FRI = 2026-04-03 (Friday)
// NOW_SAT = 2026-04-04 (Saturday)
// NOW_SUN = 2026-04-05 (Sunday)
describe('getTodoVirtualColumn', () => {
  const NOW_WED = new Date('2026-04-01T12:00:00Z'); // Wednesday
  const NOW_THU = new Date('2026-04-02T12:00:00Z'); // Thursday
  const NOW_FRI = new Date('2026-04-03T12:00:00Z'); // Friday
  const NOW_SAT = new Date('2026-04-04T12:00:00Z'); // Saturday
  const NOW_SUN = new Date('2026-04-05T12:00:00Z'); // Sunday

  function todoCard(id: string, due?: Date, dueHasTime?: boolean): Card {
    return { ...base, id, uid: id, due, dueHasTime };
  }

  it('returns "todo" for a card with no due date', () => {
    expect(getTodoVirtualColumn(todoCard('x'), NOW_WED)).toBe('todo');
  });

  describe('today / overdue (all days)', () => {
    it('returns "todo-today" for a card due today (date-only)', () => {
      const due = new Date(Date.UTC(2026, 3, 1)); // Apr 1
      expect(getTodoVirtualColumn(todoCard('x', due, false), NOW_WED)).toBe('todo-today');
    });

    it('returns "todo-today" for an overdue card', () => {
      const due = new Date(Date.UTC(2026, 2, 28)); // Mar 28
      expect(getTodoVirtualColumn(todoCard('x', due, false), NOW_WED)).toBe('todo-today');
    });

    it('returns "todo-today" for a card with datetime earlier today', () => {
      const due = new Date('2026-04-01T09:00:00Z');
      expect(getTodoVirtualColumn(todoCard('x', due, true), NOW_WED)).toBe('todo-today');
    });

    it('returns "todo-today" for a card with datetime later today', () => {
      const due = new Date('2026-04-01T18:00:00Z');
      expect(getTodoVirtualColumn(todoCard('x', due, true), NOW_WED)).toBe('todo-today');
    });
  });

  describe('tomorrow (all days)', () => {
    it('returns "todo-tomorrow" for a card due tomorrow from Wednesday', () => {
      const due = new Date(Date.UTC(2026, 3, 2)); // Apr 2
      expect(getTodoVirtualColumn(todoCard('x', due, false), NOW_WED)).toBe('todo-tomorrow');
    });

    it('returns "todo-tomorrow" for a card due tomorrow from Friday (Saturday)', () => {
      const due = new Date(Date.UTC(2026, 3, 4)); // Apr 4 = Saturday
      expect(getTodoVirtualColumn(todoCard('x', due, false), NOW_FRI)).toBe('todo-tomorrow');
    });

    it('returns "todo-tomorrow" for a card due tomorrow from Saturday (Sunday)', () => {
      const due = new Date(Date.UTC(2026, 3, 5)); // Apr 5 = Sunday
      expect(getTodoVirtualColumn(todoCard('x', due, false), NOW_SAT)).toBe('todo-tomorrow');
    });
  });

  describe('Mon–Wed layout', () => {
    // thisWeekFriday = Apr 3 (Mon+4 from Mar 30)
    // thisSaturday = Apr 4, thisSunday = Apr 5
    // nextMonday = Apr 6, nextFriday = Apr 10

    it('returns "todo-this-week" for a card due on thisWeekFriday (Apr 3)', () => {
      const due = new Date(Date.UTC(2026, 3, 3));
      expect(getTodoVirtualColumn(todoCard('x', due, false), NOW_WED)).toBe('todo-this-week');
    });

    it('returns "todo-this-weekend" for a card due on Saturday (Apr 4)', () => {
      const due = new Date(Date.UTC(2026, 3, 4));
      expect(getTodoVirtualColumn(todoCard('x', due, false), NOW_WED)).toBe('todo-this-weekend');
    });

    it('returns "todo-this-weekend" for a card due on Sunday (Apr 5)', () => {
      const due = new Date(Date.UTC(2026, 3, 5));
      expect(getTodoVirtualColumn(todoCard('x', due, false), NOW_WED)).toBe('todo-this-weekend');
    });

    it('returns "todo-next-week" for a card due on nextMonday (Apr 6)', () => {
      const due = new Date(Date.UTC(2026, 3, 6));
      expect(getTodoVirtualColumn(todoCard('x', due, false), NOW_WED)).toBe('todo-next-week');
    });

    it('returns "todo-next-week" for a card due on nextFriday (Apr 10)', () => {
      const due = new Date(Date.UTC(2026, 3, 10));
      expect(getTodoVirtualColumn(todoCard('x', due, false), NOW_WED)).toBe('todo-next-week');
    });

    it('returns "todo-future" for a card due Apr 11 (after nextFriday)', () => {
      const due = new Date(Date.UTC(2026, 3, 11));
      expect(getTodoVirtualColumn(todoCard('x', due, false), NOW_WED)).toBe('todo-future');
    });

    it('returns "todo-this-week" from Monday (Mar 30), due Wednesday (Apr 1)', () => {
      const NOW_MON = new Date('2026-03-30T12:00:00Z');
      const due = new Date(Date.UTC(2026, 3, 1)); // Apr 1 (2 days after Monday)
      expect(getTodoVirtualColumn(todoCard('x', due, false), NOW_MON)).toBe('todo-this-week');
    });
  });

  describe('Thu–Fri layout', () => {
    // Thursday Apr 2: tomorrow = Apr 3 (Friday = thisWeekFriday)
    // thisSaturday = Apr 4, thisSunday = Apr 5, nextFriday = Apr 10

    it('does not return "todo-this-week" for Thu — Apr 3 goes to todo-tomorrow', () => {
      const due = new Date(Date.UTC(2026, 3, 3)); // Apr 3 = tomorrow
      expect(getTodoVirtualColumn(todoCard('x', due, false), NOW_THU)).toBe('todo-tomorrow');
    });

    it('returns "todo-this-weekend" for Apr 4 (Saturday) from Thursday', () => {
      const due = new Date(Date.UTC(2026, 3, 4));
      expect(getTodoVirtualColumn(todoCard('x', due, false), NOW_THU)).toBe('todo-this-weekend');
    });

    it('returns "todo-this-weekend" for Apr 5 (Sunday) from Thursday', () => {
      const due = new Date(Date.UTC(2026, 3, 5));
      expect(getTodoVirtualColumn(todoCard('x', due, false), NOW_THU)).toBe('todo-this-weekend');
    });

    it('returns "todo-this-weekend" for Apr 5 (Sunday) from Friday (Saturday is Tomorrow)', () => {
      const due = new Date(Date.UTC(2026, 3, 5)); // Sunday only (Saturday=Tomorrow)
      expect(getTodoVirtualColumn(todoCard('x', due, false), NOW_FRI)).toBe('todo-this-weekend');
    });

    it('returns "todo-next-week" for Apr 6 (nextMonday) from Thursday', () => {
      const due = new Date(Date.UTC(2026, 3, 6));
      expect(getTodoVirtualColumn(todoCard('x', due, false), NOW_THU)).toBe('todo-next-week');
    });

    it('returns "todo-next-week" for Apr 10 (nextFriday) from Thursday', () => {
      const due = new Date(Date.UTC(2026, 3, 10));
      expect(getTodoVirtualColumn(todoCard('x', due, false), NOW_THU)).toBe('todo-next-week');
    });

    it('returns "todo-future" for Apr 11 from Thursday', () => {
      const due = new Date(Date.UTC(2026, 3, 11));
      expect(getTodoVirtualColumn(todoCard('x', due, false), NOW_THU)).toBe('todo-future');
    });
  });

  describe('Sat–Sun layout', () => {
    // Saturday Apr 4: today=thisSaturday, tomorrow=thisSunday (Apr 5)
    // nextMonday=Apr 6, nextFriday=Apr 10, nextSaturday=Apr 11, nextSunday=Apr 12
    // nextNextFriday=Apr 17

    it('returns "todo-this-weekend" for a card due on Sunday (Apr 5) from Saturday — but Tomorrow takes priority', () => {
      // Apr 5 = tomorrow from Saturday, so this should be todo-tomorrow, not todo-this-weekend
      const due = new Date(Date.UTC(2026, 3, 5));
      expect(getTodoVirtualColumn(todoCard('x', due, false), NOW_SAT)).toBe('todo-tomorrow');
    });

    it('returns "todo-coming-week" for Apr 6 (nextMonday) from Saturday', () => {
      const due = new Date(Date.UTC(2026, 3, 6));
      expect(getTodoVirtualColumn(todoCard('x', due, false), NOW_SAT)).toBe('todo-coming-week');
    });

    it('returns "todo-coming-week" for Apr 10 (nextFriday) from Saturday', () => {
      const due = new Date(Date.UTC(2026, 3, 10));
      expect(getTodoVirtualColumn(todoCard('x', due, false), NOW_SAT)).toBe('todo-coming-week');
    });

    it('returns "todo-next-weekend" for Apr 11 (nextSaturday) from Saturday', () => {
      const due = new Date(Date.UTC(2026, 3, 11));
      expect(getTodoVirtualColumn(todoCard('x', due, false), NOW_SAT)).toBe('todo-next-weekend');
    });

    it('returns "todo-next-weekend" for Apr 12 (nextSunday) from Saturday', () => {
      const due = new Date(Date.UTC(2026, 3, 12));
      expect(getTodoVirtualColumn(todoCard('x', due, false), NOW_SAT)).toBe('todo-next-weekend');
    });

    it('returns "todo-following-week" for Apr 13 (nextNextMonday) from Saturday', () => {
      const due = new Date(Date.UTC(2026, 3, 13));
      expect(getTodoVirtualColumn(todoCard('x', due, false), NOW_SAT)).toBe('todo-following-week');
    });

    it('returns "todo-following-week" for Apr 17 (nextNextFriday) from Saturday', () => {
      const due = new Date(Date.UTC(2026, 3, 17));
      expect(getTodoVirtualColumn(todoCard('x', due, false), NOW_SAT)).toBe('todo-following-week');
    });

    it('returns "todo-future" for Apr 18 from Saturday', () => {
      const due = new Date(Date.UTC(2026, 3, 18));
      expect(getTodoVirtualColumn(todoCard('x', due, false), NOW_SAT)).toBe('todo-future');
    });

    it('returns "todo-coming-week" for Apr 7 from Sunday', () => {
      // Sunday: today=Apr5, tomorrow=Apr6(nextMonday), coming-week=Apr7–Apr10
      const due = new Date(Date.UTC(2026, 3, 7));
      expect(getTodoVirtualColumn(todoCard('x', due, false), NOW_SUN)).toBe('todo-coming-week');
    });
  });
});

describe('parseDueInput', () => {
  it('returns undefined fields for null input', () => {
    expect(parseDueInput(null)).toEqual({ due: undefined, dueHasTime: undefined });
  });

  it('returns undefined fields for undefined input', () => {
    expect(parseDueInput(undefined)).toEqual({ due: undefined, dueHasTime: undefined });
  });

  it('returns undefined fields for empty string', () => {
    expect(parseDueInput('')).toEqual({ due: undefined, dueHasTime: undefined });
  });

  it('parses a date-only string as UTC midnight with dueHasTime=false', () => {
    const result = parseDueInput('2026-06-15');
    expect(result.dueHasTime).toBe(false);
    expect(result.due).toEqual(new Date(Date.UTC(2026, 5, 15)));
  });

  it('parses a datetime ISO string with dueHasTime=true', () => {
    const result = parseDueInput('2026-06-15T10:30:00.000Z');
    expect(result.dueHasTime).toBe(true);
    expect(result.due).toEqual(new Date('2026-06-15T10:30:00.000Z'));
  });
});

describe('parseRdatesInput', () => {
  it('returns undefined for null', () => {
    expect(parseRdatesInput(null)).toBeUndefined();
  });

  it('returns undefined for undefined', () => {
    expect(parseRdatesInput(undefined)).toBeUndefined();
  });

  it('returns undefined for empty array', () => {
    expect(parseRdatesInput([])).toBeUndefined();
  });

  it('parses an array of ISO strings into Dates', () => {
    const result = parseRdatesInput(['2026-04-01T00:00:00.000Z', '2026-05-01T00:00:00.000Z']);
    expect(result).toEqual([
      new Date('2026-04-01T00:00:00.000Z'),
      new Date('2026-05-01T00:00:00.000Z'),
    ]);
  });
});

// Tests run with TZ=UTC. Wednesday April 1, 2026 is used as the reference day.
// Week: Mon Mar 30 – thisWeekFri Apr 3 – Sat Apr 4 – Sun Apr 5
// nextMonday=Apr 6, nextFriday=Apr 10, nextSaturday=Apr 11, nextNextMonday=Apr 13
describe('computeVirtualColumnUpdates', () => {
  const NOW_WED = new Date('2026-04-01T12:00:00Z'); // Wednesday
  const NOW_SAT = new Date('2026-04-04T12:00:00Z'); // Saturday
  const NOW_SUN = new Date('2026-04-05T12:00:00Z'); // Sunday
  const NOW_FRI = new Date('2026-04-03T12:00:00Z'); // Friday

  it('sets due to today (UTC midnight) for todo-today', () => {
    const result = computeVirtualColumnUpdates('todo-today', NOW_WED);
    expect(result).not.toBe('unchanged');
    const updates = result as Partial<Card>;
    expect(updates.column).toBe('todo');
    expect(updates.dueHasTime).toBe(false);
    expect(updates.due).toEqual(new Date(Date.UTC(2026, 3, 1))); // Apr 1
  });

  it('sets due to tomorrow (UTC midnight) for todo-tomorrow', () => {
    const result = computeVirtualColumnUpdates('todo-tomorrow', NOW_WED);
    expect(result).not.toBe('unchanged');
    const updates = result as Partial<Card>;
    expect(updates.dueHasTime).toBe(false);
    expect(updates.due).toEqual(new Date(Date.UTC(2026, 3, 2))); // Apr 2
  });

  it('sets due to today+2 for todo-this-week', () => {
    const result = computeVirtualColumnUpdates('todo-this-week', NOW_WED);
    expect(result).not.toBe('unchanged');
    const updates = result as Partial<Card>;
    expect(updates.dueHasTime).toBe(false);
    expect(updates.due).toEqual(new Date(Date.UTC(2026, 3, 3))); // Apr 3
  });

  it('sets due to thisSaturday for todo-this-weekend on Wednesday', () => {
    const result = computeVirtualColumnUpdates('todo-this-weekend', NOW_WED);
    expect(result).not.toBe('unchanged');
    const updates = result as Partial<Card>;
    expect(updates.dueHasTime).toBe(false);
    expect(updates.due).toEqual(new Date(Date.UTC(2026, 3, 4))); // Apr 4 (Saturday)
  });

  it('sets due to thisSunday for todo-this-weekend on Friday (Saturday is Tomorrow)', () => {
    const result = computeVirtualColumnUpdates('todo-this-weekend', NOW_FRI);
    expect(result).not.toBe('unchanged');
    const updates = result as Partial<Card>;
    expect(updates.due).toEqual(new Date(Date.UTC(2026, 3, 5))); // Apr 5 (Sunday)
  });

  it('returns "unchanged" for todo-this-weekend on Saturday', () => {
    expect(computeVirtualColumnUpdates('todo-this-weekend', NOW_SAT)).toBe('unchanged');
  });

  it('returns "unchanged" for todo-this-weekend on Sunday', () => {
    expect(computeVirtualColumnUpdates('todo-this-weekend', NOW_SUN)).toBe('unchanged');
  });

  it('sets due to nextMonday for todo-next-week', () => {
    const result = computeVirtualColumnUpdates('todo-next-week', NOW_WED);
    expect(result).not.toBe('unchanged');
    const updates = result as Partial<Card>;
    expect(updates.due).toEqual(new Date(Date.UTC(2026, 3, 6))); // Apr 6
  });

  it('sets due to nextMonday for todo-coming-week', () => {
    const result = computeVirtualColumnUpdates('todo-coming-week', NOW_WED);
    expect(result).not.toBe('unchanged');
    const updates = result as Partial<Card>;
    expect(updates.due).toEqual(new Date(Date.UTC(2026, 3, 6))); // Apr 6
  });

  it('sets due to nextSaturday for todo-next-weekend', () => {
    const result = computeVirtualColumnUpdates('todo-next-weekend', NOW_WED);
    expect(result).not.toBe('unchanged');
    const updates = result as Partial<Card>;
    expect(updates.due).toEqual(new Date(Date.UTC(2026, 3, 11))); // Apr 11
  });

  it('sets due to nextNextMonday for todo-following-week', () => {
    const result = computeVirtualColumnUpdates('todo-following-week', NOW_WED);
    expect(result).not.toBe('unchanged');
    const updates = result as Partial<Card>;
    expect(updates.due).toEqual(new Date(Date.UTC(2026, 3, 13))); // Apr 13
  });

  it('sets due to today+21 for todo-future', () => {
    const result = computeVirtualColumnUpdates('todo-future', NOW_WED);
    expect(result).not.toBe('unchanged');
    const updates = result as Partial<Card>;
    expect(updates.due).toEqual(new Date(Date.UTC(2026, 3, 22))); // Apr 22
  });

  it('clears due date for todo (no date)', () => {
    const result = computeVirtualColumnUpdates('todo', NOW_WED);
    expect(result).not.toBe('unchanged');
    const updates = result as Partial<Card>;
    expect(updates.column).toBe('todo');
    expect(updates.due).toBeUndefined();
    expect(updates.dueHasTime).toBeUndefined();
  });

  it('returns "unchanged" for unknown column', () => {
    expect(computeVirtualColumnUpdates('todo-dated', NOW_WED)).toBe('unchanged');
  });
});
