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

// Tests run with TZ=UTC. now = 2026-04-01T12:00:00Z (a Wednesday).
// Calendar: Mon 2026-03-30, Tue 2026-03-31, Wed 2026-04-01 (today), Thu 2026-04-02 (tomorrow),
//           ...Wed 2026-04-08 (7 days out), Thu 2026-04-09 (8 days out — todo-dated).
describe('getTodoVirtualColumn', () => {
  const NOW = new Date('2026-04-01T12:00:00Z');

  function todoCard(id: string, due?: Date, dueHasTime?: boolean): Card {
    return { ...base, id, uid: id, due, dueHasTime };
  }

  it('returns "todo" for a card with no due date', () => {
    expect(getTodoVirtualColumn(todoCard('x'), NOW)).toBe('todo');
  });

  it('returns "todo-today" for a card due today (date-only)', () => {
    const due = new Date(Date.UTC(2026, 3, 1)); // 2026-04-01
    expect(getTodoVirtualColumn(todoCard('x', due, false), NOW)).toBe('todo-today');
  });

  it('returns "todo-today" for an overdue card (date-only)', () => {
    const due = new Date(Date.UTC(2026, 2, 30)); // 2026-03-30 (yesterday)
    expect(getTodoVirtualColumn(todoCard('x', due, false), NOW)).toBe('todo-today');
  });

  it('returns "todo-today" for a card with datetime earlier today', () => {
    const due = new Date('2026-04-01T09:00:00Z');
    expect(getTodoVirtualColumn(todoCard('x', due, true), NOW)).toBe('todo-today');
  });

  it('returns "todo-today" for a card with datetime later today', () => {
    const due = new Date('2026-04-01T18:00:00Z');
    expect(getTodoVirtualColumn(todoCard('x', due, true), NOW)).toBe('todo-today');
  });

  it('returns "todo-tomorrow" for a card due tomorrow (date-only)', () => {
    const due = new Date(Date.UTC(2026, 3, 2)); // 2026-04-02
    expect(getTodoVirtualColumn(todoCard('x', due, false), NOW)).toBe('todo-tomorrow');
  });

  it('returns "todo-tomorrow" for a card with datetime tomorrow', () => {
    const due = new Date('2026-04-02T10:00:00Z');
    expect(getTodoVirtualColumn(todoCard('x', due, true), NOW)).toBe('todo-tomorrow');
  });

  it('returns "todo-this-week" for a card due in 2 days (date-only)', () => {
    const due = new Date(Date.UTC(2026, 3, 3)); // 2026-04-03
    expect(getTodoVirtualColumn(todoCard('x', due, false), NOW)).toBe('todo-this-week');
  });

  it('returns "todo-this-week" for a card due 6 days from now', () => {
    const due = new Date(Date.UTC(2026, 3, 7)); // 2026-04-07 (today+6)
    expect(getTodoVirtualColumn(todoCard('x', due, false), NOW)).toBe('todo-this-week');
  });

  it('returns "todo-this-week" for a card due exactly 7 days from now (<=7 boundary)', () => {
    const due = new Date(Date.UTC(2026, 3, 8)); // 2026-04-08 (today+7)
    expect(getTodoVirtualColumn(todoCard('x', due, false), NOW)).toBe('todo-this-week');
  });

  it('returns "todo-dated" for a card due 8 days from now (>7 days)', () => {
    const due = new Date(Date.UTC(2026, 3, 9)); // 2026-04-09 (today+8)
    expect(getTodoVirtualColumn(todoCard('x', due, false), NOW)).toBe('todo-dated');
  });

  it('returns "todo-dated" for a card due far in the future', () => {
    const due = new Date(Date.UTC(2027, 0, 1)); // 2027-01-01 (clearly >7 days)
    expect(getTodoVirtualColumn(todoCard('x', due, false), NOW)).toBe('todo-dated');
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

// Tests run with TZ=UTC.
describe('computeVirtualColumnUpdates', () => {
  const NOW = new Date('2026-04-09T12:00:00Z');

  it('sets due to today (UTC midnight) for todo-today', () => {
    const result = computeVirtualColumnUpdates('todo-today', NOW);
    expect(result).not.toBe('unchanged');
    const updates = result as Partial<Card>;
    expect(updates.column).toBe('todo');
    expect(updates.dueHasTime).toBe(false);
    expect(updates.due).toEqual(new Date(Date.UTC(2026, 3, 9)));
  });

  it('sets due to tomorrow (UTC midnight) for todo-tomorrow', () => {
    const result = computeVirtualColumnUpdates('todo-tomorrow', NOW);
    expect(result).not.toBe('unchanged');
    const updates = result as Partial<Card>;
    expect(updates.column).toBe('todo');
    expect(updates.dueHasTime).toBe(false);
    expect(updates.due).toEqual(new Date(Date.UTC(2026, 3, 10)));
  });

  it('sets due to today+2 (UTC midnight) for todo-this-week', () => {
    const result = computeVirtualColumnUpdates('todo-this-week', NOW);
    expect(result).not.toBe('unchanged');
    const updates = result as Partial<Card>;
    expect(updates.column).toBe('todo');
    expect(updates.dueHasTime).toBe(false);
    expect(updates.due).toEqual(new Date(Date.UTC(2026, 3, 11)));
  });

  it('returns "unchanged" for todo-dated', () => {
    expect(computeVirtualColumnUpdates('todo-dated', NOW)).toBe('unchanged');
  });

  it('clears due date for todo (no date)', () => {
    const result = computeVirtualColumnUpdates('todo', NOW);
    expect(result).not.toBe('unchanged');
    const updates = result as Partial<Card>;
    expect(updates.column).toBe('todo');
    expect(updates.due).toBeUndefined();
    expect(updates.dueHasTime).toBeUndefined();
  });
});
