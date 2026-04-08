import { mkdtemp, rm, readFile } from 'fs/promises';
import { readdirSync } from 'fs';
import { tmpdir } from 'os';
import * as nodePath from 'path';
import { parseVTODO, cardToVTODO, createCard, updateCard, moveCard, readCard, deleteCard, writeCard } from '../storage/vtodo';
import { Card } from '../types';

function makeICS(
  uid: string,
  extra: string[] = [],
  { summary = 'Test Task', lastModified = '20260212T100000Z' }: { summary?: string; lastModified?: string } = {}
): string {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Quikan//Kanban Board//EN',
    'BEGIN:VTODO',
    `UID:${uid}`,
    `SUMMARY:${summary}`,
    'CREATED:20260212T100000Z',
    `LAST-MODIFIED:${lastModified}`,
    'DTSTAMP:20260212T100000Z',
    ...extra,
    'END:VTODO',
    'END:VCALENDAR',
  ].join('\n');
}

describe('VTODO Storage', () => {
  describe('parseVTODO', () => {
    it('parses id, summary, and column', () => {
      const card = parseVTODO(makeICS('test-card-1', ['X-QUIKAN-COLUMN:todo'], { summary: 'Test Card' }), 'test-card-1.ics');
      expect(card.id).toBe('test-card-1');
      expect(card.summary).toBe('Test Card');
      expect(card.column).toBe('todo');
    });

    it('defaults column to "todo" when no STATUS or X-QUIKAN-COLUMN', () => {
      const card = parseVTODO(makeICS('test-card-2'), 'test-card-2.ics');
      expect(card.column).toBe('todo');
    });

    it('maps STATUS:COMPLETED to the "done" column', () => {
      const card = parseVTODO(makeICS('test-completed', ['STATUS:COMPLETED']), 'test-completed.ics');
      expect(card.column).toBe('done');
    });

    it('STATUS:COMPLETED overrides X-QUIKAN-COLUMN', () => {
      const card = parseVTODO(
        makeICS('test-completed-override', ['STATUS:COMPLETED', 'X-QUIKAN-COLUMN:in-progress']),
        'test-completed-override.ics'
      );
      expect(card.column).toBe('done');
    });

    it('maps STATUS:IN-PROCESS to "in-progress"', () => {
      const card = parseVTODO(makeICS('test-in-process', ['STATUS:IN-PROCESS']), 'test-in-process.ics');
      expect(card.column).toBe('in-progress');
    });

    it('STATUS:IN-PROCESS overrides X-QUIKAN-COLUMN', () => {
      const card = parseVTODO(
        makeICS('test-in-process-conflict', ['STATUS:IN-PROCESS', 'X-QUIKAN-COLUMN:todo']),
        'test-in-process-conflict.ics'
      );
      expect(card.column).toBe('in-progress');
    });

    it('falls back to X-QUIKAN-COLUMN when STATUS is absent', () => {
      const card = parseVTODO(makeICS('test-fallback', ['X-QUIKAN-COLUMN:in-progress']), 'test-fallback.ics');
      expect(card.column).toBe('in-progress');
    });

    it('defaults column to "todo" for STATUS:NEEDS-ACTION without X-QUIKAN-COLUMN', () => {
      const card = parseVTODO(makeICS('test-needs-action', ['STATUS:NEEDS-ACTION']), 'test-needs-action.ics');
      expect(card.column).toBe('todo');
    });

    it('parses a date-only DUE property', () => {
      const card = parseVTODO(makeICS('test-due-date', ['DUE;VALUE=DATE:20260401']), 'test-due-date.ics');
      expect(card.due).toBeInstanceOf(Date);
      expect(card.dueHasTime).toBe(false);
      // Stored as UTC midnight
      expect(card.due!.toISOString()).toBe('2026-04-01T00:00:00.000Z');
    });

    it('parses a datetime DUE property', () => {
      const card = parseVTODO(makeICS('test-due-datetime', ['DUE:20260401T150000Z']), 'test-due-datetime.ics');
      expect(card.due).toBeInstanceOf(Date);
      expect(card.dueHasTime).toBe(true);
      expect(card.due!.toISOString()).toBe('2026-04-01T15:00:00.000Z');
    });

    it('leaves due undefined when no DUE property is present', () => {
      const card = parseVTODO(makeICS('test-no-due'), 'test-no-due.ics');
      expect(card.due).toBeUndefined();
      expect(card.dueHasTime).toBeUndefined();
    });
  });

  describe('cardToVTODO', () => {
    it('writes STATUS:NEEDS-ACTION and X-QUIKAN-COLUMN for a todo card', () => {
      const card: Card = {
        id: 'test-card-3',
        uid: 'test-card-3',
        summary: 'Test Card 3',
        column: 'todo',
        created: new Date('2026-02-12T10:00:00Z'),
        modified: new Date('2026-02-12T11:00:00Z'),
      };

      const icsContent = cardToVTODO(card);

      expect(icsContent).toContain('BEGIN:VCALENDAR');
      expect(icsContent).toContain('BEGIN:VTODO');
      expect(icsContent).toContain('UID:test-card-3');
      expect(icsContent).toContain('SUMMARY:Test Card 3');
      expect(icsContent).toContain('X-QUIKAN-COLUMN:todo');
      expect(icsContent).toContain('STATUS:NEEDS-ACTION');
      expect(icsContent).not.toContain('STATUS:COMPLETED');
      expect(icsContent).toContain('END:VTODO');
      expect(icsContent).toContain('END:VCALENDAR');
    });

    it('writes STATUS:COMPLETED and X-QUIKAN-COLUMN:done for a done card', () => {
      const card: Card = {
        id: 'test-done',
        uid: 'test-done',
        summary: 'Done Task',
        column: 'done',
        created: new Date('2026-02-12T10:00:00Z'),
        modified: new Date('2026-02-12T11:00:00Z'),
      };

      const icsContent = cardToVTODO(card);

      expect(icsContent).toContain('STATUS:COMPLETED');
      expect(icsContent).not.toContain('STATUS:NEEDS-ACTION');
      expect(icsContent).toContain('X-QUIKAN-COLUMN:done');
    });

    it('writes STATUS:IN-PROCESS and X-QUIKAN-COLUMN:in-progress for an in-progress card', () => {
      const card: Card = {
        id: 'test-in-progress',
        uid: 'test-in-progress',
        summary: 'In Progress Task',
        column: 'in-progress',
        created: new Date('2026-02-12T10:00:00Z'),
        modified: new Date('2026-02-12T11:00:00Z'),
      };

      const icsContent = cardToVTODO(card);

      expect(icsContent).toContain('STATUS:IN-PROCESS');
      expect(icsContent).not.toContain('STATUS:NEEDS-ACTION');
      expect(icsContent).toContain('X-QUIKAN-COLUMN:in-progress');
    });

    it('includes a date-only DUE when dueHasTime is false', () => {
      const card: Card = {
        id: 'test-due-out',
        uid: 'test-due-out',
        summary: 'Has date-only due',
        column: 'todo',
        created: new Date('2026-02-12T10:00:00Z'),
        modified: new Date('2026-02-12T10:00:00Z'),
        due: new Date('2026-04-01T00:00:00.000Z'),
        dueHasTime: false,
      };

      const icsContent = cardToVTODO(card);

      expect(icsContent).toContain('DUE');
      expect(icsContent).toContain('20260401');
      expect(icsContent).not.toMatch(/DUE.*T\d{6}/);
    });

    it('includes a datetime DUE when dueHasTime is true', () => {
      const card: Card = {
        id: 'test-datetime-out',
        uid: 'test-datetime-out',
        summary: 'Has datetime due',
        column: 'todo',
        created: new Date('2026-02-12T10:00:00Z'),
        modified: new Date('2026-02-12T10:00:00Z'),
        due: new Date('2026-04-01T15:00:00.000Z'),
        dueHasTime: true,
      };

      const icsContent = cardToVTODO(card);

      expect(icsContent).toContain('DUE');
      expect(icsContent).toContain('20260401T150000');
    });

    it('omits DUE when due is undefined', () => {
      const card: Card = {
        id: 'test-no-due-out',
        uid: 'test-no-due-out',
        summary: 'No due',
        column: 'todo',
        created: new Date('2026-02-12T10:00:00Z'),
        modified: new Date('2026-02-12T10:00:00Z'),
      };

      expect(cardToVTODO(card)).not.toContain('DUE');
    });

    it('round-trips a date-only due through serialize and parse', () => {
      const original: Card = {
        id: 'roundtrip-date',
        uid: 'roundtrip-date',
        summary: 'Round-trip date',
        column: 'todo',
        created: new Date('2026-02-12T10:00:00Z'),
        modified: new Date('2026-02-12T10:00:00Z'),
        due: new Date('2026-06-15T00:00:00.000Z'),
        dueHasTime: false,
      };

      const parsed = parseVTODO(cardToVTODO(original), 'roundtrip-date.ics');

      expect(parsed.dueHasTime).toBe(false);
      expect(parsed.due!.toISOString()).toBe('2026-06-15T00:00:00.000Z');
    });

    it('round-trips a datetime due through serialize and parse', () => {
      const original: Card = {
        id: 'roundtrip-datetime',
        uid: 'roundtrip-datetime',
        summary: 'Round-trip datetime',
        column: 'todo',
        created: new Date('2026-02-12T10:00:00Z'),
        modified: new Date('2026-02-12T10:00:00Z'),
        due: new Date('2026-06-15T09:30:00.000Z'),
        dueHasTime: true,
      };

      const parsed = parseVTODO(cardToVTODO(original), 'roundtrip-datetime.ics');

      expect(parsed.dueHasTime).toBe(true);
      expect(parsed.due!.toISOString()).toBe('2026-06-15T09:30:00.000Z');
    });

    it('includes a PRIORITY property when priority is set', () => {
      const card: Card = {
        id: 'test-priority',
        uid: 'test-priority',
        summary: 'Priority task',
        column: 'todo',
        priority: 8,
        created: new Date('2026-02-12T10:00:00Z'),
        modified: new Date('2026-02-12T10:00:00Z'),
      };

      expect(cardToVTODO(card)).toContain('PRIORITY:8');
    });

    it('omits PRIORITY when priority is undefined', () => {
      const card: Card = {
        id: 'test-no-priority',
        uid: 'test-no-priority',
        summary: 'No priority',
        column: 'todo',
        created: new Date('2026-02-12T10:00:00Z'),
        modified: new Date('2026-02-12T10:00:00Z'),
      };

      expect(cardToVTODO(card)).not.toContain('PRIORITY');
    });
  });

  describe('parseVTODO priority', () => {
    it('parses a high priority (7-9)', () => {
      const card = parseVTODO(makeICS('test-high', ['PRIORITY:8']), 'test-high.ics');
      expect(card.priority).toBe(8);
    });

    it('parses a low priority (1-3)', () => {
      const card = parseVTODO(makeICS('test-low', ['PRIORITY:2']), 'test-low.ics');
      expect(card.priority).toBe(2);
    });

    it('leaves priority undefined when no PRIORITY property', () => {
      const card = parseVTODO(makeICS('test-no-prio'), 'test-no-prio.ics');
      expect(card.priority).toBeUndefined();
    });

    it('round-trips priority through serialize and parse', () => {
      const original: Card = {
        id: 'roundtrip-priority',
        uid: 'roundtrip-priority',
        summary: 'Priority roundtrip',
        column: 'todo',
        priority: 5,
        created: new Date('2026-02-12T10:00:00Z'),
        modified: new Date('2026-02-12T10:00:00Z'),
      };

      expect(parseVTODO(cardToVTODO(original), 'roundtrip-priority.ics').priority).toBe(5);
    });
  });

  describe('isRecurring', () => {
    it('sets isRecurringChild to false and rrule to the rule string when RRULE is present', () => {
      const card = parseVTODO(makeICS('test-recurring', ['RRULE:FREQ=WEEKLY;BYDAY=MO']), 'test-recurring.ics');
      expect(card.rrule).toBe('FREQ=WEEKLY;BYDAY=MO');
      expect(card.rruleSupported).toBe(true);
      expect(card.isRecurringChild).toBe(false);
    });

    it('leaves rrule undefined when no RRULE is present', () => {
      const card = parseVTODO(makeICS('test-not-recurring'), 'test-not-recurring.ics');
      expect(card.rrule).toBeUndefined();
      expect(card.isRecurringChild).toBe(false);
    });
  });

  describe('completed date parsing', () => {
    it('parses the COMPLETED datetime for a done card', () => {
      const card = parseVTODO(
        makeICS('test-completed-date', ['STATUS:COMPLETED', 'COMPLETED:20260301T150000Z'], { lastModified: '20260301T100000Z' }),
        'test-completed-date.ics'
      );
      expect(card.column).toBe('done');
      expect(card.completed).toBeInstanceOf(Date);
      expect(card.completed!.toISOString()).toBe('2026-03-01T15:00:00.000Z');
    });

    it('falls back to LAST-MODIFIED when COMPLETED is absent', () => {
      const card = parseVTODO(
        makeICS('test-completed-fallback', ['STATUS:COMPLETED'], { lastModified: '20260301T100000Z' }),
        'test-completed-fallback.ics'
      );
      expect(card.completed).toBeInstanceOf(Date);
      expect(card.completed!.toISOString()).toBe('2026-03-01T10:00:00.000Z');
    });

    it('leaves completed undefined for non-done cards', () => {
      const card = parseVTODO(makeICS('test-not-completed', ['X-QUIKAN-COLUMN:todo']), 'test-not-completed.ics');
      expect(card.completed).toBeUndefined();
    });
  });

  describe('description', () => {
    it('parses a DESCRIPTION property', () => {
      const card = parseVTODO(
        makeICS('test-desc-1', ['DESCRIPTION:This is the description.', 'X-QUIKAN-COLUMN:todo']),
        'test-desc-1.ics'
      );
      expect(card.description).toBe('This is the description.');
    });

    it('leaves description undefined when absent', () => {
      const card = parseVTODO(makeICS('test-nodesc', ['X-QUIKAN-COLUMN:todo']), 'test-nodesc.ics');
      expect(card.description).toBeUndefined();
    });

    it('serialises description into the VTODO', () => {
      const card: Card = {
        id: 'test-desc-write',
        uid: 'test-desc-write',
        summary: 'Task',
        description: 'Some notes here.',
        column: 'todo',
        created: new Date('2026-02-12T10:00:00Z'),
        modified: new Date('2026-02-12T11:00:00Z'),
      };

      expect(cardToVTODO(card)).toContain('DESCRIPTION:Some notes here.');
    });

    it('omits DESCRIPTION when description is absent', () => {
      const card: Card = {
        id: 'test-nodesc-write',
        uid: 'test-nodesc-write',
        summary: 'Task',
        column: 'todo',
        created: new Date('2026-02-12T10:00:00Z'),
        modified: new Date('2026-02-12T11:00:00Z'),
      };

      expect(cardToVTODO(card)).not.toContain('DESCRIPTION');
    });
  });

  describe('metadata serialisation', () => {
    it('writes LAST-MODIFIED matching card.modified', () => {
      const card: Card = {
        id: 'meta-1',
        uid: 'meta-1',
        summary: 'Task',
        column: 'todo',
        created: new Date('2026-01-01T00:00:00Z'),
        modified: new Date('2026-03-15T09:30:00Z'),
      };
      expect(cardToVTODO(card)).toContain('LAST-MODIFIED:20260315T093000');
    });

    it('writes a DTSTAMP on every cardToVTODO call', () => {
      const before = Date.now();
      const card: Card = {
        id: 'meta-2',
        uid: 'meta-2',
        summary: 'Task',
        column: 'todo',
        created: new Date(),
        modified: new Date(),
      };
      const ics = cardToVTODO(card);
      const after = Date.now();
      expect(ics).toMatch(/DTSTAMP:\d{8}T\d{6}/);
      const match = ics.match(/DTSTAMP:(\d{8}T\d{6}Z?)/);
      expect(match).toBeTruthy();
      const stampMs = new Date(
        match![1].replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/, '$1-$2-$3T$4:$5:$6Z')
      ).getTime();
      expect(stampMs).toBeGreaterThanOrEqual(before - 1000);
      expect(stampMs).toBeLessThanOrEqual(after + 1000);
    });

    it('writes COMPLETED for done cards', () => {
      const card: Card = {
        id: 'meta-done',
        uid: 'meta-done',
        summary: 'Done Task',
        column: 'done',
        created: new Date('2026-01-01T00:00:00Z'),
        modified: new Date('2026-03-20T14:00:00Z'),
        completed: new Date('2026-03-20T14:00:00Z'),
      };
      const ics = cardToVTODO(card);
      expect(ics).toContain('COMPLETED:');
      expect(ics).toContain('STATUS:COMPLETED');
    });

    it('does not write COMPLETED for todo cards', () => {
      const card: Card = {
        id: 'meta-todo',
        uid: 'meta-todo',
        summary: 'Todo Task',
        column: 'todo',
        created: new Date('2026-01-01T00:00:00Z'),
        modified: new Date('2026-03-20T14:00:00Z'),
      };
      const ics = cardToVTODO(card);
      expect(ics).not.toContain('COMPLETED:');
      expect(ics).not.toContain('STATUS:COMPLETED');
    });

    it('does not write COMPLETED for in-progress cards', () => {
      const card: Card = {
        id: 'meta-inprog',
        uid: 'meta-inprog',
        summary: 'In Progress Task',
        column: 'in-progress',
        created: new Date('2026-01-01T00:00:00Z'),
        modified: new Date('2026-03-20T14:00:00Z'),
      };
      const ics = cardToVTODO(card);
      expect(ics).not.toContain('COMPLETED:');
      expect(ics).toContain('STATUS:IN-PROCESS');
    });
  });

  describe('file operation metadata', () => {
    let tempDir: string;
    const savedDataDir = process.env.QUIKAN_DATA;

    beforeEach(async () => {
      tempDir = await mkdtemp(nodePath.join(tmpdir(), 'quikan-test-'));
      process.env.QUIKAN_DATA = tempDir;
    });

    afterEach(async () => {
      await rm(tempDir, { recursive: true, force: true });
      if (savedDataDir !== undefined) {
        process.env.QUIKAN_DATA = savedDataDir;
      } else {
        delete process.env.QUIKAN_DATA;
      }
    });

    it('createCard writes CREATED and LAST-MODIFIED close to now', async () => {
      const before = Date.now();
      const card = await createCard('New Card', 'todo');
      const after = Date.now();

      expect(card.created.getTime()).toBeGreaterThanOrEqual(before - 100);
      expect(card.created.getTime()).toBeLessThanOrEqual(after + 100);
      expect(card.modified.getTime()).toBeGreaterThanOrEqual(before - 100);
      expect(card.modified.getTime()).toBeLessThanOrEqual(after + 100);

      const read = await readCard(card.id);
      expect(read).not.toBeNull();
      expect(Math.abs(read!.created.getTime() - card.created.getTime())).toBeLessThan(1000);
      expect(Math.abs(read!.modified.getTime() - card.modified.getTime())).toBeLessThan(1000);
    });

    it('updateCard updates LAST-MODIFIED and persists it', async () => {
      const card = await createCard('Update Test', 'todo');
      const originalModified = card.modified.getTime();

      await new Promise((r) => setTimeout(r, 10));

      const updated = await updateCard(card.id, { summary: 'Updated Summary' });
      expect(updated).not.toBeNull();
      expect(updated!.modified.getTime()).toBeGreaterThan(originalModified);

      const read = await readCard(card.id);
      expect(Math.abs(read!.modified.getTime() - updated!.modified.getTime())).toBeLessThan(1000);
      expect(read!.summary).toBe('Updated Summary');
    });

    it('moveCard to done sets completed and writes COMPLETED to disk', async () => {
      const card = await createCard('To Done', 'todo');
      expect(card.completed).toBeUndefined();

      const moved = await moveCard(card.id, 'done');
      expect(moved).not.toBeNull();
      expect(moved!.completed).toBeInstanceOf(Date);
      expect(moved!.column).toBe('done');

      const read = await readCard(card.id);
      expect(read!.completed).toBeInstanceOf(Date);
      const ics = await readFile(nodePath.join(tempDir, `${card.id}.ics`), 'utf-8');
      expect(ics).toContain('COMPLETED:');
      expect(ics).toContain('STATUS:COMPLETED');
    });

    it('moveCard away from done clears completed and removes COMPLETED from disk', async () => {
      const card = await createCard('Back To Todo', 'done');
      await updateCard(card.id, { column: 'done' });

      const moved = await moveCard(card.id, 'todo');
      expect(moved).not.toBeNull();
      expect(moved!.completed).toBeUndefined();
      expect(moved!.column).toBe('todo');

      const read = await readCard(card.id);
      expect(read!.completed).toBeUndefined();

      const ics = await readFile(nodePath.join(tempDir, `${card.id}.ics`), 'utf-8');
      expect(ics).not.toContain('COMPLETED:');
      expect(ics).toContain('STATUS:NEEDS-ACTION');
    });

    it('updateCard without column change preserves completed', async () => {
      const card = await createCard('Preserve Completed', 'todo');
      const movedToDone = await moveCard(card.id, 'done');
      const completedAt = movedToDone!.completed!;

      await new Promise((r) => setTimeout(r, 10));

      const updated = await updateCard(card.id, { summary: 'New Title' });
      expect(updated!.completed).toBeInstanceOf(Date);
      // completed is round-tripped through .ics (second precision); allow <1s difference
      expect(Math.abs(updated!.completed!.getTime() - completedAt.getTime())).toBeLessThan(1000);
      expect(updated!.column).toBe('done');
    });

    it('LAST-MODIFIED in .ics matches the returned card.modified after update', async () => {
      const card = await createCard('Metadata Sync', 'todo');
      await new Promise((r) => setTimeout(r, 10));

      const updated = await updateCard(card.id, { summary: 'Synced' });
      const read = await readCard(card.id);

      // Round-trip through .ics serialization: times should match within 1 second
      expect(Math.abs(read!.modified.getTime() - updated!.modified.getTime())).toBeLessThan(1000);
    });

    it('deleteCard removes the card from disk', async () => {
      const card = await createCard('To Delete', 'todo');
      const filePath = nodePath.join(tempDir, `${card.id}.ics`);

      await deleteCard(card.id);

      expect(await readCard(card.id)).toBeNull();
      await expect(readFile(filePath, 'utf-8')).rejects.toThrow();
    });
  });
});

// ---------------------------------------------------------------------------
// New RRULE / recurrence tests
// ---------------------------------------------------------------------------

import {
  computeNextOccurrence,
  createChildOverride,
  readChildrenOf,
  readMasterOf,
} from '../storage/vtodo';

describe('uid handling', () => {
  it('parses uid from the UID property (same as id for regular cards)', () => {
    const card = parseVTODO(makeICS('my-uid-123', ['X-QUIKAN-COLUMN:todo']), 'my-uid-123.ics');
    expect(card.uid).toBe('my-uid-123');
    expect(card.id).toBe('my-uid-123');
  });

  it('writes uid to UID property using card.uid', () => {
    const card: Card = {
      id: 'file-stem',
      uid: 'shared-uid',
      summary: 'Test',
      column: 'todo',
      created: new Date('2026-01-01T00:00:00Z'),
      modified: new Date('2026-01-01T00:00:00Z'),
    };
    const ics = cardToVTODO(card);
    expect(ics).toContain('UID:shared-uid');
    expect(ics).not.toContain('UID:file-stem');
  });

  it('round-trips uid through parse and serialize', () => {
    const card: Card = {
      id: 'child-file',
      uid: 'master-uid',
      summary: 'Child card',
      column: 'done',
      created: new Date('2026-01-01T00:00:00Z'),
      modified: new Date('2026-01-01T00:00:00Z'),
      completed: new Date('2026-04-01T00:00:00Z'),
      recurrenceId: new Date('2026-04-01T00:00:00.000Z'),
      isRecurringChild: true,
    };
    const ics = cardToVTODO(card);
    const parsed = parseVTODO(ics, 'child-file.ics');
    expect(parsed.uid).toBe('master-uid');
    expect(parsed.id).toBe('child-file');
  });
});

describe('RRULE parsing and writing', () => {
  it('parses RRULE string and marks it supported', () => {
    const card = parseVTODO(
      makeICS('test-rrule', ['DTSTART:20260401T100000Z', 'RRULE:FREQ=WEEKLY;BYDAY=MO,WE']),
      'test-rrule.ics'
    );
    expect(card.rrule).toBe('FREQ=WEEKLY;BYDAY=MO,WE');
    expect(card.rruleSupported).toBe(true);
  });

  it('marks RRULE as unsupported when FREQ is HOURLY', () => {
    const card = parseVTODO(
      makeICS('test-hourly', ['RRULE:FREQ=HOURLY;INTERVAL=2']),
      'test-hourly.ics'
    );
    expect(card.rrule).toBeDefined();
    expect(card.rruleSupported).toBe(false);
  });

  it('marks RRULE as unsupported when BYYEARDAY is used', () => {
    const card = parseVTODO(
      makeICS('test-byyearday', ['DTSTART:20260101T000000Z', 'RRULE:FREQ=YEARLY;BYYEARDAY=1']),
      'test-byyearday.ics'
    );
    expect(card.rruleSupported).toBe(false);
  });

  it('marks RRULE as unsupported when BYWEEKNO is used', () => {
    const card = parseVTODO(
      makeICS('test-byweekno', ['DTSTART:20260101T000000Z', 'RRULE:FREQ=YEARLY;BYWEEKNO=2']),
      'test-byweekno.ics'
    );
    expect(card.rruleSupported).toBe(false);
  });

  it('writes RRULE and DTSTART when card.rrule is set', () => {
    const card: Card = {
      id: 'recurring-master',
      uid: 'recurring-master',
      summary: 'Weekly task',
      column: 'todo',
      created: new Date('2026-01-01T00:00:00Z'),
      modified: new Date('2026-01-01T00:00:00Z'),
      due: new Date('2026-04-07T00:00:00.000Z'),
      dueHasTime: false,
      dtstart: new Date('2026-04-07T00:00:00.000Z'),
      rrule: 'FREQ=WEEKLY;BYDAY=MO',
      rruleSupported: true,
    };
    const ics = cardToVTODO(card);
    expect(ics).toContain('RRULE:FREQ=WEEKLY;BYDAY=MO');
    expect(ics).toContain('DTSTART');
  });

  it('does not write DTSTART for non-recurring cards', () => {
    const card: Card = {
      id: 'plain',
      uid: 'plain',
      summary: 'Plain task',
      column: 'todo',
      created: new Date('2026-01-01T00:00:00Z'),
      modified: new Date('2026-01-01T00:00:00Z'),
      due: new Date('2026-04-01T00:00:00.000Z'),
    };
    expect(cardToVTODO(card)).not.toContain('DTSTART');
  });

  it('round-trips RRULE through serialize and parse', () => {
    const card: Card = {
      id: 'roundtrip-rrule',
      uid: 'roundtrip-rrule',
      summary: 'Monthly task',
      column: 'todo',
      created: new Date('2026-01-01T00:00:00Z'),
      modified: new Date('2026-01-01T00:00:00Z'),
      due: new Date('2026-04-01T00:00:00.000Z'),
      dueHasTime: false,
      dtstart: new Date('2026-04-01T00:00:00.000Z'),
      rrule: 'FREQ=MONTHLY;BYMONTHDAY=1',
      rruleSupported: true,
    };
    const parsed = parseVTODO(cardToVTODO(card), 'roundtrip-rrule.ics');
    expect(parsed.rrule).toBe('FREQ=MONTHLY;BYMONTHDAY=1');
    expect(parsed.rruleSupported).toBe(true);
  });
});

describe('RECURRENCE-ID parsing and writing', () => {
  it('parses RECURRENCE-ID as a date', () => {
    const card = parseVTODO(
      makeICS('child-1', [
        'RECURRENCE-ID;VALUE=DATE:20260401',
        'STATUS:COMPLETED',
        'DTSTART;VALUE=DATE:20260401',
      ]),
      'child-file.ics'
    );
    expect(card.recurrenceId).toBeInstanceOf(Date);
    expect(card.recurrenceId!.toISOString()).toBe('2026-04-01T00:00:00.000Z');
    expect(card.isRecurringChild).toBe(true);
  });

  it('parses RECURRENCE-ID as a datetime', () => {
    const card = parseVTODO(
      makeICS('child-2', ['RECURRENCE-ID:20260401T100000Z', 'DTSTART:20260401T100000Z']),
      'child-file.ics'
    );
    expect(card.recurrenceId!.toISOString()).toBe('2026-04-01T10:00:00.000Z');
    expect(card.isRecurringChild).toBe(true);
  });

  it('leaves recurrenceId undefined when not present', () => {
    const card = parseVTODO(makeICS('master-1'), 'master-1.ics');
    expect(card.recurrenceId).toBeUndefined();
    expect(card.isRecurringChild).toBe(false);
  });

  it('writes RECURRENCE-ID for child cards', () => {
    const card: Card = {
      id: 'child-file',
      uid: 'master-uid',
      summary: 'Override',
      column: 'done',
      created: new Date('2026-01-01T00:00:00Z'),
      modified: new Date('2026-01-01T00:00:00Z'),
      completed: new Date('2026-04-01T10:00:00Z'),
      due: new Date('2026-04-01T00:00:00.000Z'),
      dueHasTime: false,
      dtstart: new Date('2026-04-01T00:00:00.000Z'),
      recurrenceId: new Date('2026-04-01T00:00:00.000Z'),
      isRecurringChild: true,
    };
    const ics = cardToVTODO(card);
    expect(ics).toContain('RECURRENCE-ID');
    expect(ics).toContain('20260401');
  });

  it('round-trips RECURRENCE-ID through serialize and parse', () => {
    const card: Card = {
      id: 'child-roundtrip',
      uid: 'master-roundtrip',
      summary: 'Child',
      column: 'done',
      created: new Date('2026-01-01T00:00:00Z'),
      modified: new Date('2026-04-01T00:00:00Z'),
      completed: new Date('2026-04-01T00:00:00Z'),
      due: new Date('2026-04-01T00:00:00.000Z'),
      dueHasTime: false,
      dtstart: new Date('2026-04-01T00:00:00.000Z'),
      recurrenceId: new Date('2026-04-01T00:00:00.000Z'),
      isRecurringChild: true,
    };
    const parsed = parseVTODO(cardToVTODO(card), 'child-roundtrip.ics');
    expect(parsed.recurrenceId!.toISOString()).toBe('2026-04-01T00:00:00.000Z');
    expect(parsed.isRecurringChild).toBe(true);
    expect(parsed.uid).toBe('master-roundtrip');
  });
});

describe('RDATE and EXDATE parsing and writing', () => {
  it('parses RDATE properties', () => {
    const card = parseVTODO(
      makeICS('test-rdate', ['RDATE:20260415T100000Z', 'RDATE:20260501T100000Z']),
      'test-rdate.ics'
    );
    expect(card.rdates).toHaveLength(2);
    expect(card.rdates![0].toISOString()).toBe('2026-04-15T10:00:00.000Z');
    expect(card.rdates![1].toISOString()).toBe('2026-05-01T10:00:00.000Z');
  });

  it('parses EXDATE properties', () => {
    const card = parseVTODO(
      makeICS('test-exdate', ['EXDATE:20260415T100000Z']),
      'test-exdate.ics'
    );
    expect(card.exdates).toHaveLength(1);
    expect(card.exdates![0].toISOString()).toBe('2026-04-15T10:00:00.000Z');
  });

  it('leaves rdates and exdates undefined when absent', () => {
    const card = parseVTODO(makeICS('plain'), 'plain.ics');
    expect(card.rdates).toBeUndefined();
    expect(card.exdates).toBeUndefined();
  });

  it('writes RDATE and EXDATE lists', () => {
    const card: Card = {
      id: 'rdate-out',
      uid: 'rdate-out',
      summary: 'Recurring with extras',
      column: 'todo',
      created: new Date('2026-01-01T00:00:00Z'),
      modified: new Date('2026-01-01T00:00:00Z'),
      rrule: 'FREQ=WEEKLY;BYDAY=MO',
      rruleSupported: true,
      rdates: [new Date('2026-04-15T10:00:00Z')],
      exdates: [new Date('2026-04-22T10:00:00Z')],
    };
    const ics = cardToVTODO(card);
    expect(ics).toContain('RDATE');
    expect(ics).toContain('EXDATE');
    expect(ics).toContain('20260415');
    expect(ics).toContain('20260422');
  });
});

describe('computeNextOccurrence', () => {
  const masterBase: Card = {
    id: 'master',
    uid: 'master',
    summary: 'Weekly task',
    column: 'todo',
    created: new Date('2026-01-05T00:00:00.000Z'),
    modified: new Date('2026-01-05T00:00:00.000Z'),
    dtstart: new Date('2026-01-05T00:00:00.000Z'), // first Monday of 2026
    due: new Date('2026-01-05T00:00:00.000Z'),
    dueHasTime: false,
    rrule: 'FREQ=WEEKLY;BYDAY=MO',
    rruleSupported: true,
  };

  it('returns the next weekly occurrence after master.due', () => {
    const next = computeNextOccurrence(masterBase, []);
    expect(next).not.toBeNull();
    expect(next!.toISOString()).toBe('2026-01-12T00:00:00.000Z');
  });

  it('returns null when the series has a COUNT and all instances are covered', () => {
    const master: Card = {
      ...masterBase,
      dtstart: new Date('2026-01-05T00:00:00.000Z'),
      due: new Date('2026-01-05T00:00:00.000Z'),
      rrule: 'FREQ=WEEKLY;COUNT=1;BYDAY=MO',
    };
    // COUNT=1 means only one instance (Jan 5). There is no "next" beyond Jan 5.
    const next = computeNextOccurrence(master, []);
    expect(next).toBeNull();
  });

  it('returns null when UNTIL has already passed', () => {
    const master: Card = {
      ...masterBase,
      rrule: 'FREQ=WEEKLY;UNTIL=20260106T000000Z;BYDAY=MO',
    };
    const next = computeNextOccurrence(master, []);
    expect(next).toBeNull();
  });

  it('skips dates that are already overridden by existing children', () => {
    const jan12Child: Card = {
      id: 'child-jan12',
      uid: 'master',
      summary: 'Override',
      column: 'done',
      created: new Date('2026-01-05T00:00:00.000Z'),
      modified: new Date('2026-01-12T00:00:00.000Z'),
      recurrenceId: new Date('2026-01-12T00:00:00.000Z'),
      isRecurringChild: true,
    };
    // Next should skip Jan 12 (already overridden) and return Jan 19
    const next = computeNextOccurrence(masterBase, [jan12Child]);
    expect(next!.toISOString()).toBe('2026-01-19T00:00:00.000Z');
  });

  it('returns null when master has no rrule', () => {
    const plain: Card = { ...masterBase, rrule: undefined, rruleSupported: undefined };
    expect(computeNextOccurrence(plain, [])).toBeNull();
  });

  it('returns null when master has no dtstart or due', () => {
    const noAnchor: Card = { ...masterBase, dtstart: undefined, due: undefined };
    expect(computeNextOccurrence(noAnchor, [])).toBeNull();
  });

  it('advances through multiple already-covered occurrences', () => {
    const children: Card[] = [
      { ...masterBase, id: 'c1', recurrenceId: new Date('2026-01-12T00:00:00.000Z'), isRecurringChild: true },
      { ...masterBase, id: 'c2', recurrenceId: new Date('2026-01-19T00:00:00.000Z'), isRecurringChild: true },
    ];
    const next = computeNextOccurrence(masterBase, children);
    expect(next!.toISOString()).toBe('2026-01-26T00:00:00.000Z');
  });
});

describe('createChildOverride', () => {
  let tempDir: string;
  const savedDataDir = process.env.QUIKAN_DATA;

  beforeEach(async () => {
    tempDir = await mkdtemp(nodePath.join(tmpdir(), 'quikan-child-'));
    process.env.QUIKAN_DATA = tempDir;
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
    if (savedDataDir !== undefined) {
      process.env.QUIKAN_DATA = savedDataDir;
    } else {
      delete process.env.QUIKAN_DATA;
    }
  });

  it('creates a child with a new id, master uid, and recurrenceId = master.due', async () => {
    const master = await createCard('Weekly task', 'todo', new Date('2026-04-07T00:00:00.000Z'), false, undefined, undefined, 'FREQ=WEEKLY;BYDAY=MO');
    const child = await createChildOverride(master, 'done');

    expect(child.id).not.toBe(master.id);
    expect(child.uid).toBe(master.uid);
    expect(child.isRecurringChild).toBe(true);
    expect(child.recurrenceId!.toISOString()).toBe('2026-04-07T00:00:00.000Z');
    expect(child.due!.toISOString()).toBe('2026-04-07T00:00:00.000Z');
    expect(child.column).toBe('done');
    expect(child.completed).toBeInstanceOf(Date);
  });

  it('child created for in-progress target is not completed', async () => {
    const master = await createCard('Weekly task', 'todo', new Date('2026-04-07T00:00:00.000Z'), false, undefined, undefined, 'FREQ=WEEKLY;BYDAY=MO');
    const child = await createChildOverride(master, 'in-progress');

    expect(child.column).toBe('in-progress');
    expect(child.completed).toBeUndefined();
  });

  it('child is persisted to disk', async () => {
    const master = await createCard('Weekly task', 'todo', new Date('2026-04-07T00:00:00.000Z'), false, undefined, undefined, 'FREQ=WEEKLY;BYDAY=MO');
    const child = await createChildOverride(master, 'done');

    const read = await readCard(child.id);
    expect(read).not.toBeNull();
    expect(read!.uid).toBe(master.uid);
    expect(read!.isRecurringChild).toBe(true);
  });
});

describe('moveCard for recurring masters', () => {
  let tempDir: string;
  const savedDataDir = process.env.QUIKAN_DATA;

  beforeEach(async () => {
    tempDir = await mkdtemp(nodePath.join(tmpdir(), 'quikan-move-'));
    process.env.QUIKAN_DATA = tempDir;
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
    if (savedDataDir !== undefined) {
      process.env.QUIKAN_DATA = savedDataDir;
    } else {
      delete process.env.QUIKAN_DATA;
    }
  });

  it('creates a child and advances master DUE when moved to done', async () => {
    const master = await createCard(
      'Weekly standup', 'todo',
      new Date('2026-04-06T00:00:00.000Z'), // Monday Apr 6
      false, undefined, undefined,
      'FREQ=WEEKLY;BYDAY=MO'
    );

    const result = await moveCard(master.id, 'done');

    // Returns the child card in the target column
    expect(result).not.toBeNull();
    expect(result!.isRecurringChild).toBe(true);
    expect(result!.column).toBe('done');
    expect(result!.uid).toBe(master.uid);

    // Master should still exist with an advanced DUE
    const updatedMaster = await readCard(master.id);
    expect(updatedMaster!.column).toBe('todo');
    expect(updatedMaster!.due!.toISOString()).toBe('2026-04-13T00:00:00.000Z'); // next Monday
  });

  it('creates a child in in-progress and advances master DUE', async () => {
    const master = await createCard(
      'Weekly standup', 'todo',
      new Date('2026-04-06T00:00:00.000Z'),
      false, undefined, undefined,
      'FREQ=WEEKLY;BYDAY=MO'
    );

    const result = await moveCard(master.id, 'in-progress');
    expect(result!.column).toBe('in-progress');
    expect(result!.isRecurringChild).toBe(true);

    const updatedMaster = await readCard(master.id);
    expect(updatedMaster!.column).toBe('todo');
    expect(updatedMaster!.due!.toISOString()).toBe('2026-04-13T00:00:00.000Z');
  });

  it('moves a child card normally (no child-of-child)', async () => {
    const master = await createCard(
      'Weekly standup', 'todo',
      new Date('2026-04-06T00:00:00.000Z'),
      false, undefined, undefined,
      'FREQ=WEEKLY;BYDAY=MO'
    );

    // Trigger master → child creation via moveCard (also advances master DUE)
    const child = await moveCard(master.id, 'in-progress');
    expect(child!.isRecurringChild).toBe(true);

    const masterAfterFirst = await readCard(master.id);
    expect(masterAfterFirst!.due!.toISOString()).toBe('2026-04-13T00:00:00.000Z');

    // Now move the child itself — no child-of-child should be created
    const moved = await moveCard(child!.id, 'done');
    expect(moved!.isRecurringChild).toBe(true);
    expect(moved!.column).toBe('done');

    // Master DUE unchanged — only the child was moved
    const updatedMaster = await readCard(master.id);
    expect(updatedMaster!.due!.toISOString()).toBe('2026-04-13T00:00:00.000Z');
  });

  it('completes master when series is exhausted', async () => {
    // COUNT=1 means only one instance; after completing it, no next instance
    const master = await createCard(
      'One-time recurring', 'todo',
      new Date('2026-04-06T00:00:00.000Z'),
      false, undefined, undefined,
      'FREQ=WEEKLY;COUNT=1;BYDAY=MO'
    );

    await moveCard(master.id, 'done');

    // Master should be completed (series exhausted)
    const updatedMaster = await readCard(master.id);
    expect(updatedMaster!.column).toBe('done');
  });

  it('non-recurring card is moved normally (no child created)', async () => {
    const plain = await createCard('Plain task', 'todo');
    const result = await moveCard(plain.id, 'done');

    expect(result!.id).toBe(plain.id);
    expect(result!.column).toBe('done');
    expect(result!.isRecurringChild).toBeFalsy();

    // No extra card files created
    const files = readdirSync(tempDir).filter((f: string) => f.endsWith('.ics'));
    expect(files).toHaveLength(1);
  });

  it('unsupported RRULE causes master to move normally (no child created)', async () => {
    // Create master with unsupported RRULE manually
    const master = await createCard('Hourly task', 'todo');
    // Patch in an unsupported rrule by directly updating the card object
    await writeCard({ ...master, rrule: 'FREQ=HOURLY', rruleSupported: false });

    const result = await moveCard(master.id, 'done');
    expect(result!.id).toBe(master.id); // master itself moved, no child
    expect(result!.isRecurringChild).toBeFalsy();
  });
});

describe('readChildrenOf and readMasterOf', () => {
  let tempDir: string;
  const savedDataDir = process.env.QUIKAN_DATA;

  beforeEach(async () => {
    tempDir = await mkdtemp(nodePath.join(tmpdir(), 'quikan-helpers-'));
    process.env.QUIKAN_DATA = tempDir;
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
    if (savedDataDir !== undefined) {
      process.env.QUIKAN_DATA = savedDataDir;
    } else {
      delete process.env.QUIKAN_DATA;
    }
  });

  it('readChildrenOf returns children with matching uid', async () => {
    const master = await createCard('Weekly', 'todo', new Date('2026-04-06T00:00:00.000Z'), false, undefined, undefined, 'FREQ=WEEKLY;BYDAY=MO');
    await createChildOverride(master, 'done');
    await createChildOverride(master, 'done');
    // Also create an unrelated card
    await createCard('Unrelated', 'todo');

    const children = await readChildrenOf(master.uid);
    expect(children).toHaveLength(2);
    expect(children.every((c) => c.uid === master.uid && c.isRecurringChild)).toBe(true);
  });

  it('readChildrenOf returns empty array when no children exist', async () => {
    const master = await createCard('Solo task', 'todo');
    const children = await readChildrenOf(master.uid);
    expect(children).toHaveLength(0);
  });

  it('readMasterOf returns the master (card without recurrenceId)', async () => {
    const master = await createCard('Weekly', 'todo', new Date('2026-04-06T00:00:00.000Z'), false, undefined, undefined, 'FREQ=WEEKLY;BYDAY=MO');
    await createChildOverride(master, 'done');

    const found = await readMasterOf(master.uid);
    expect(found).not.toBeNull();
    expect(found!.id).toBe(master.id);
    expect(found!.isRecurringChild).toBe(false);
  });

  it('readMasterOf returns null when no master exists for uid', async () => {
    expect(await readMasterOf('non-existent-uid')).toBeNull();
  });
});

describe('createCard with RRULE', () => {
  let tempDir: string;
  const savedDataDir = process.env.QUIKAN_DATA;

  beforeEach(async () => {
    tempDir = await mkdtemp(nodePath.join(tmpdir(), 'quikan-create-'));
    process.env.QUIKAN_DATA = tempDir;
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
    if (savedDataDir !== undefined) {
      process.env.QUIKAN_DATA = savedDataDir;
    } else {
      delete process.env.QUIKAN_DATA;
    }
  });

  it('sets dtstart = due when rrule is provided', async () => {
    const due = new Date('2026-04-06T00:00:00.000Z');
    const card = await createCard('Weekly', 'todo', due, false, undefined, undefined, 'FREQ=WEEKLY;BYDAY=MO');

    expect(card.dtstart!.toISOString()).toBe(due.toISOString());
    expect(card.rrule).toBe('FREQ=WEEKLY;BYDAY=MO');
    expect(card.uid).toBe(card.id);
  });

  it('persists RRULE and DTSTART to disk', async () => {
    const due = new Date('2026-04-06T00:00:00.000Z');
    const card = await createCard('Weekly', 'todo', due, false, undefined, undefined, 'FREQ=WEEKLY;BYDAY=MO');

    const read = await readCard(card.id);
    expect(read!.rrule).toBe('FREQ=WEEKLY;BYDAY=MO');
    expect(read!.dtstart!.toISOString()).toBe(due.toISOString());
  });

  it('does not set dtstart when no rrule is provided', async () => {
    const card = await createCard('Plain task', 'todo');
    expect(card.dtstart).toBeUndefined();
  });
});
