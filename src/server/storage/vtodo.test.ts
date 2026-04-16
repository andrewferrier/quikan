import { mkdtemp, rm, readFile, writeFile } from 'fs/promises';
import { readdirSync } from 'fs';
import { tmpdir } from 'os';
import * as nodePath from 'path';
import {
  parseVTODO,
  cardToVTODO,
  createCard,
  updateCard,
  moveCard,
  readCard,
  readAllCards,
  deleteCard,
  writeCard,
} from '../storage/vtodo';
import { Card } from '../types';

function makeICS(
  uid: string,
  extra: string[] = [],
  {
    summary = 'Test Task',
    lastModified = '20260212T100000Z',
  }: { summary?: string; lastModified?: string } = {}
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
      const card = parseVTODO(
        makeICS('test-card-1', ['X-QUIKAN-COLUMN:todo'], { summary: 'Test Card' }),
        'test-card-1.ics'
      );
      expect(card.id).toBe('test-card-1');
      expect(card.summary).toBe('Test Card');
      expect(card.column).toBe('todo');
    });

    it('defaults column to "todo" when no STATUS or X-QUIKAN-COLUMN', () => {
      const card = parseVTODO(makeICS('test-card-2'), 'test-card-2.ics');
      expect(card.column).toBe('todo');
    });

    it('maps STATUS:COMPLETED to the "done" column', () => {
      const card = parseVTODO(
        makeICS('test-completed', ['STATUS:COMPLETED']),
        'test-completed.ics'
      );
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
      const card = parseVTODO(
        makeICS('test-in-process', ['STATUS:IN-PROCESS']),
        'test-in-process.ics'
      );
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
      const card = parseVTODO(
        makeICS('test-fallback', ['X-QUIKAN-COLUMN:in-progress']),
        'test-fallback.ics'
      );
      expect(card.column).toBe('in-progress');
    });

    it('defaults column to "todo" for STATUS:NEEDS-ACTION without X-QUIKAN-COLUMN', () => {
      const card = parseVTODO(
        makeICS('test-needs-action', ['STATUS:NEEDS-ACTION']),
        'test-needs-action.ics'
      );
      expect(card.column).toBe('todo');
    });

    it('parses a date-only DUE property', () => {
      const card = parseVTODO(
        makeICS('test-due-date', ['DUE;VALUE=DATE:20260401']),
        'test-due-date.ics'
      );
      expect(card.due).toBeInstanceOf(Date);
      expect(card.dueHasTime).toBe(false);
      // Stored as UTC midnight
      expect(card.due!.toISOString()).toBe('2026-04-01T00:00:00.000Z');
    });

    it('parses a datetime DUE property', () => {
      const card = parseVTODO(
        makeICS('test-due-datetime', ['DUE:20260401T150000Z']),
        'test-due-datetime.ics'
      );
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
    it('sets quikanRecurrenceId to undefined and rrule to the rule string when RRULE is present', () => {
      const card = parseVTODO(
        makeICS('test-recurring', ['RRULE:FREQ=WEEKLY;BYDAY=MO']),
        'test-recurring.ics'
      );
      expect(card.rrule).toBe('FREQ=WEEKLY;BYDAY=MO');
      expect(card.rruleSupported).toBe(true);
      expect(card.quikanRecurrenceId).toBeUndefined();
    });

    it('leaves rrule and quikanRecurrenceId undefined when no recurrence present', () => {
      const card = parseVTODO(makeICS('test-not-recurring'), 'test-not-recurring.ics');
      expect(card.rrule).toBeUndefined();
      expect(card.quikanRecurrenceId).toBeUndefined();
    });
  });

  describe('completed date parsing', () => {
    it('parses the COMPLETED datetime for a done card', () => {
      const card = parseVTODO(
        makeICS('test-completed-date', ['STATUS:COMPLETED', 'COMPLETED:20260301T150000Z'], {
          lastModified: '20260301T100000Z',
        }),
        'test-completed-date.ics'
      );
      expect(card.column).toBe('done');
      expect(card.completed).toBeInstanceOf(Date);
      expect(card.completed!.toISOString()).toBe('2026-03-01T15:00:00.000Z');
    });

    it('falls back to LAST-MODIFIED when COMPLETED is absent', () => {
      const card = parseVTODO(
        makeICS('test-completed-fallback', ['STATUS:COMPLETED'], {
          lastModified: '20260301T100000Z',
        }),
        'test-completed-fallback.ics'
      );
      expect(card.completed).toBeInstanceOf(Date);
      expect(card.completed!.toISOString()).toBe('2026-03-01T10:00:00.000Z');
    });

    it('leaves completed undefined for non-done cards', () => {
      const card = parseVTODO(
        makeICS('test-not-completed', ['X-QUIKAN-COLUMN:todo']),
        'test-not-completed.ics'
      );
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
      const card = await createCard({ summary: 'New Card', column: 'todo' });
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
      const card = await createCard({ summary: 'Update Test', column: 'todo' });
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
      const card = await createCard({ summary: 'To Done', column: 'todo' });
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
      const card = await createCard({ summary: 'Back To Todo', column: 'done' });
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
      const card = await createCard({ summary: 'Preserve Completed', column: 'todo' });
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
      const card = await createCard({ summary: 'Metadata Sync', column: 'todo' });
      await new Promise((r) => setTimeout(r, 10));

      const updated = await updateCard(card.id, { summary: 'Synced' });
      const read = await readCard(card.id);

      // Round-trip through .ics serialization: times should match within 1 second
      expect(Math.abs(read!.modified.getTime() - updated!.modified.getTime())).toBeLessThan(1000);
    });

    it('deleteCard removes the card from disk', async () => {
      const card = await createCard({ summary: 'To Delete', column: 'todo' });
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
  createCompletedClone,
  readClonesOf,
  readParentOf,
  formatRruleText,
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
      id: 'clone-file',
      uid: 'clone-file',
      summary: 'Completed clone',
      column: 'done',
      created: new Date('2026-01-01T00:00:00Z'),
      modified: new Date('2026-01-01T00:00:00Z'),
      completed: new Date('2026-04-01T00:00:00Z'),
      quikanRecurrenceId: 'master-uid',
    };
    const ics = cardToVTODO(card);
    const parsed = parseVTODO(ics, 'clone-file.ics');
    expect(parsed.uid).toBe('clone-file');
    expect(parsed.id).toBe('clone-file');
    expect(parsed.quikanRecurrenceId).toBe('master-uid');
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

describe('RECURRENCE-ID validation (rejection)', () => {
  it('throws when RECURRENCE-ID property is present', () => {
    expect(() =>
      parseVTODO(
        makeICS('child-1', [
          'RECURRENCE-ID;VALUE=DATE:20260401',
          'STATUS:COMPLETED',
          'DTSTART;VALUE=DATE:20260401',
        ]),
        'child-file.ics'
      )
    ).toThrow(/RECURRENCE-ID/);
  });

  it('throws when RECURRENCE-ID is a datetime', () => {
    expect(() =>
      parseVTODO(
        makeICS('child-2', ['RECURRENCE-ID:20260401T100000Z', 'DTSTART:20260401T100000Z']),
        'child-file.ics'
      )
    ).toThrow(/RECURRENCE-ID/);
  });

  it('error message includes the filename', () => {
    expect(() =>
      parseVTODO(makeICS('child-3', ['RECURRENCE-ID;VALUE=DATE:20260401']), 'my-bad-file.ics')
    ).toThrow(/my-bad-file\.ics/);
  });

  it('does not throw when no RECURRENCE-ID is present', () => {
    expect(() => parseVTODO(makeICS('master-1'), 'master-1.ics')).not.toThrow();
  });
});

describe('multiple VCALENDAR/VTODO validation (rejection)', () => {
  it('throws when there are multiple VTODO components', () => {
    const raw = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Test//EN',
      'BEGIN:VTODO',
      'UID:todo-1',
      'SUMMARY:First',
      'END:VTODO',
      'BEGIN:VTODO',
      'UID:todo-2',
      'SUMMARY:Second',
      'END:VTODO',
      'END:VCALENDAR',
    ].join('\r\n');
    expect(() => parseVTODO(raw, 'multi-vtodo.ics')).toThrow(/multiple VTODO/);
  });

  it('error message includes the filename for multiple VTODO', () => {
    const raw = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Test//EN',
      'BEGIN:VTODO',
      'UID:todo-1',
      'SUMMARY:First',
      'END:VTODO',
      'BEGIN:VTODO',
      'UID:todo-2',
      'SUMMARY:Second',
      'END:VTODO',
      'END:VCALENDAR',
    ].join('\r\n');
    expect(() => parseVTODO(raw, 'bad-multi.ics')).toThrow(/bad-multi\.ics/);
  });
});

describe('X-QUIKAN-RECURRENCE-ID parsing and writing', () => {
  it('parses X-QUIKAN-RECURRENCE-ID into quikanRecurrenceId', () => {
    const card = parseVTODO(
      makeICS('clone-1', [
        'STATUS:COMPLETED',
        'COMPLETED:20260401T100000Z',
        'X-QUIKAN-RECURRENCE-ID:master-uid-abc',
      ]),
      'clone-1.ics'
    );
    expect(card.quikanRecurrenceId).toBe('master-uid-abc');
  });

  it('leaves quikanRecurrenceId undefined when not present', () => {
    const card = parseVTODO(makeICS('regular-1'), 'regular-1.ics');
    expect(card.quikanRecurrenceId).toBeUndefined();
  });

  it('writes X-QUIKAN-RECURRENCE-ID when quikanRecurrenceId is set', () => {
    const card: Card = {
      id: 'clone-file',
      uid: 'clone-file',
      summary: 'Completed clone',
      column: 'done',
      created: new Date('2026-01-01T00:00:00Z'),
      modified: new Date('2026-04-01T00:00:00Z'),
      completed: new Date('2026-04-01T00:00:00Z'),
      due: new Date('2026-04-01T00:00:00.000Z'),
      dueHasTime: false,
      quikanRecurrenceId: 'master-uid-xyz',
    };
    const ics = cardToVTODO(card);
    expect(ics).toContain('X-QUIKAN-RECURRENCE-ID:master-uid-xyz');
    expect(ics).not.toMatch(/^RECURRENCE-ID[;:]/m);
  });

  it('does not write X-QUIKAN-RECURRENCE-ID when quikanRecurrenceId is absent', () => {
    const card: Card = {
      id: 'regular',
      uid: 'regular',
      summary: 'Regular task',
      column: 'todo',
      created: new Date('2026-01-01T00:00:00Z'),
      modified: new Date('2026-01-01T00:00:00Z'),
    };
    const ics = cardToVTODO(card);
    expect(ics).not.toContain('X-QUIKAN-RECURRENCE-ID');
    expect(ics).not.toMatch(/^RECURRENCE-ID[;:]/m);
  });

  it('round-trips X-QUIKAN-RECURRENCE-ID through serialize and parse', () => {
    const card: Card = {
      id: 'clone-roundtrip',
      uid: 'clone-roundtrip',
      summary: 'Clone',
      column: 'done',
      created: new Date('2026-01-01T00:00:00Z'),
      modified: new Date('2026-04-01T00:00:00Z'),
      completed: new Date('2026-04-01T00:00:00Z'),
      due: new Date('2026-04-01T00:00:00.000Z'),
      dueHasTime: false,
      quikanRecurrenceId: 'master-roundtrip',
    };
    const parsed = parseVTODO(cardToVTODO(card), 'clone-roundtrip.ics');
    expect(parsed.quikanRecurrenceId).toBe('master-roundtrip');
    expect(parsed.uid).toBe('clone-roundtrip');
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
    const card = parseVTODO(makeICS('test-exdate', ['EXDATE:20260415T100000Z']), 'test-exdate.ics');
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

  it('skips dates that are already covered by existing completed clones', () => {
    const jan12Clone: Card = {
      id: 'clone-jan12',
      uid: 'clone-jan12',
      summary: 'Completed instance',
      column: 'done',
      created: new Date('2026-01-05T00:00:00.000Z'),
      modified: new Date('2026-01-12T00:00:00.000Z'),
      due: new Date('2026-01-12T00:00:00.000Z'),
      quikanRecurrenceId: 'master',
    };
    // Next should skip Jan 12 (already cloned) and return Jan 19
    const next = computeNextOccurrence(masterBase, [jan12Clone]);
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
    const clones: Card[] = [
      {
        ...masterBase,
        id: 'c1',
        uid: 'c1',
        due: new Date('2026-01-12T00:00:00.000Z'),
        quikanRecurrenceId: 'master',
      },
      {
        ...masterBase,
        id: 'c2',
        uid: 'c2',
        due: new Date('2026-01-19T00:00:00.000Z'),
        quikanRecurrenceId: 'master',
      },
    ];
    const next = computeNextOccurrence(masterBase, clones);
    expect(next!.toISOString()).toBe('2026-01-26T00:00:00.000Z');
  });
});

describe('createCompletedClone', () => {
  let tempDir: string;
  const savedDataDir = process.env.QUIKAN_DATA;

  beforeEach(async () => {
    tempDir = await mkdtemp(nodePath.join(tmpdir(), 'quikan-clone-'));
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

  it('creates a clone with a new id AND new uid (not master uid)', async () => {
    const master = await createCard({
      summary: 'Weekly task',
      column: 'todo',
      due: new Date('2026-04-07T00:00:00.000Z'),
      dueHasTime: false,
      rrule: 'FREQ=WEEKLY;BYDAY=MO',
    });
    const clone = await createCompletedClone(master, 'done');

    expect(clone.id).not.toBe(master.id);
    expect(clone.uid).not.toBe(master.uid);
    expect(clone.quikanRecurrenceId).toBe(master.uid);
    expect(clone.due!.toISOString()).toBe('2026-04-07T00:00:00.000Z');
    expect(clone.column).toBe('done');
    expect(clone.completed).toBeInstanceOf(Date);
  });

  it('clone created for in-progress target is not completed', async () => {
    const master = await createCard({
      summary: 'Weekly task',
      column: 'todo',
      due: new Date('2026-04-07T00:00:00.000Z'),
      dueHasTime: false,
      rrule: 'FREQ=WEEKLY;BYDAY=MO',
    });
    const clone = await createCompletedClone(master, 'in-progress');

    expect(clone.column).toBe('in-progress');
    expect(clone.completed).toBeUndefined();
  });

  it('clone is persisted to disk with correct fields', async () => {
    const master = await createCard({
      summary: 'Weekly task',
      column: 'todo',
      due: new Date('2026-04-07T00:00:00.000Z'),
      dueHasTime: false,
      rrule: 'FREQ=WEEKLY;BYDAY=MO',
    });
    const clone = await createCompletedClone(master, 'done');

    const read = await readCard(clone.id);
    expect(read).not.toBeNull();
    expect(read!.uid).toBe(clone.uid);
    expect(read!.uid).not.toBe(master.uid);
    expect(read!.quikanRecurrenceId).toBe(master.uid);
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

  it('creates a completed clone and advances master DUE when moved to done', async () => {
    const master = await createCard({
      summary: 'Weekly standup',
      column: 'todo',
      due: new Date('2026-04-06T00:00:00.000Z'),
      dueHasTime: false,
      rrule: 'FREQ=WEEKLY;BYDAY=MO',
    });

    const result = await moveCard(master.id, 'done');

    // Returns the clone in the target column
    expect(result).not.toBeNull();
    expect(result!.quikanRecurrenceId).toBe(master.uid);
    expect(result!.uid).not.toBe(master.uid);
    expect(result!.column).toBe('done');

    // Master should still exist with an advanced DUE
    const updatedMaster = await readCard(master.id);
    expect(updatedMaster!.column).toBe('todo');
    expect(updatedMaster!.due!.toISOString()).toBe('2026-04-13T00:00:00.000Z'); // next Monday
  });

  it('creates a clone in in-progress and advances master DUE', async () => {
    const master = await createCard({
      summary: 'Weekly standup',
      column: 'todo',
      due: new Date('2026-04-06T00:00:00.000Z'),
      dueHasTime: false,
      rrule: 'FREQ=WEEKLY;BYDAY=MO',
    });

    const result = await moveCard(master.id, 'in-progress');
    expect(result!.column).toBe('in-progress');
    expect(result!.quikanRecurrenceId).toBe(master.uid);

    const updatedMaster = await readCard(master.id);
    expect(updatedMaster!.column).toBe('todo');
    expect(updatedMaster!.due!.toISOString()).toBe('2026-04-13T00:00:00.000Z');
  });

  it('moves a clone card normally (no clone-of-clone)', async () => {
    const master = await createCard({
      summary: 'Weekly standup',
      column: 'todo',
      due: new Date('2026-04-06T00:00:00.000Z'),
      dueHasTime: false,
      rrule: 'FREQ=WEEKLY;BYDAY=MO',
    });

    // Trigger master → clone creation via moveCard (also advances master DUE)
    const clone = await moveCard(master.id, 'in-progress');
    expect(clone!.quikanRecurrenceId).toBe(master.uid);

    const masterAfterFirst = await readCard(master.id);
    expect(masterAfterFirst!.due!.toISOString()).toBe('2026-04-13T00:00:00.000Z');

    // Now move the clone itself — no clone-of-clone should be created
    const moved = await moveCard(clone!.id, 'done');
    expect(moved!.quikanRecurrenceId).toBe(master.uid);
    expect(moved!.column).toBe('done');

    // Master DUE unchanged — only the clone was moved
    const updatedMaster = await readCard(master.id);
    expect(updatedMaster!.due!.toISOString()).toBe('2026-04-13T00:00:00.000Z');
  });

  it('completes master when series is exhausted', async () => {
    // COUNT=1 means only one instance; after completing it, no next instance
    const master = await createCard({
      summary: 'One-time recurring',
      column: 'todo',
      due: new Date('2026-04-06T00:00:00.000Z'),
      dueHasTime: false,
      rrule: 'FREQ=WEEKLY;COUNT=1;BYDAY=MO',
    });

    await moveCard(master.id, 'done');

    // Master should be completed (series exhausted)
    const updatedMaster = await readCard(master.id);
    expect(updatedMaster!.column).toBe('done');
  });

  it('non-recurring card is moved normally (no clone created)', async () => {
    const plain = await createCard({ summary: 'Plain task', column: 'todo' });
    const result = await moveCard(plain.id, 'done');

    expect(result!.id).toBe(plain.id);
    expect(result!.column).toBe('done');
    expect(result!.quikanRecurrenceId).toBeFalsy();

    // No extra card files created
    const files = readdirSync(tempDir).filter((f: string) => f.endsWith('.ics'));
    expect(files).toHaveLength(1);
  });

  it('unsupported RRULE causes master to move normally (no clone created)', async () => {
    // Create master with unsupported RRULE manually
    const master = await createCard({ summary: 'Hourly task', column: 'todo' });
    // Patch in an unsupported rrule by directly updating the card object
    await writeCard({ ...master, rrule: 'FREQ=HOURLY', rruleSupported: false });

    const result = await moveCard(master.id, 'done');
    expect(result!.id).toBe(master.id); // master itself moved, no clone
    expect(result!.quikanRecurrenceId).toBeFalsy();
  });
});

describe('readClonesOf and readParentOf', () => {
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

  it('readClonesOf returns clones with matching quikanRecurrenceId', async () => {
    const master = await createCard({
      summary: 'Weekly',
      column: 'todo',
      due: new Date('2026-04-06T00:00:00.000Z'),
      dueHasTime: false,
      rrule: 'FREQ=WEEKLY;BYDAY=MO',
    });
    await createCompletedClone(master, 'done');
    await createCompletedClone(master, 'done');
    // Also create an unrelated card
    await createCard({ summary: 'Unrelated', column: 'todo' });

    const clones = await readClonesOf(master.uid);
    expect(clones).toHaveLength(2);
    expect(clones.every((c) => c.quikanRecurrenceId === master.uid)).toBe(true);
    expect(clones.every((c) => c.uid !== master.uid)).toBe(true);
  });

  it('readClonesOf returns empty array when no clones exist', async () => {
    const master = await createCard({ summary: 'Solo task', column: 'todo' });
    const clones = await readClonesOf(master.uid);
    expect(clones).toHaveLength(0);
  });

  it('readParentOf returns the master (card without quikanRecurrenceId, matching uid)', async () => {
    const master = await createCard({
      summary: 'Weekly',
      column: 'todo',
      due: new Date('2026-04-06T00:00:00.000Z'),
      dueHasTime: false,
      rrule: 'FREQ=WEEKLY;BYDAY=MO',
    });
    await createCompletedClone(master, 'done');

    const found = await readParentOf(master.uid);
    expect(found).not.toBeNull();
    expect(found!.id).toBe(master.id);
    expect(found!.quikanRecurrenceId).toBeUndefined();
  });

  it('readParentOf returns null when no master exists for uid', async () => {
    expect(await readParentOf('non-existent-uid')).toBeNull();
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
    const card = await createCard({
      summary: 'Weekly',
      column: 'todo',
      due,
      dueHasTime: false,
      rrule: 'FREQ=WEEKLY;BYDAY=MO',
    });

    expect(card.dtstart!.toISOString()).toBe(due.toISOString());
    expect(card.rrule).toBe('FREQ=WEEKLY;BYDAY=MO');
    expect(card.uid).toBe(card.id);
  });

  it('persists RRULE and DTSTART to disk', async () => {
    const due = new Date('2026-04-06T00:00:00.000Z');
    const card = await createCard({
      summary: 'Weekly',
      column: 'todo',
      due,
      dueHasTime: false,
      rrule: 'FREQ=WEEKLY;BYDAY=MO',
    });

    const read = await readCard(card.id);
    expect(read!.rrule).toBe('FREQ=WEEKLY;BYDAY=MO');
    expect(read!.dtstart!.toISOString()).toBe(due.toISOString());
  });

  it('does not set dtstart when no rrule is provided', async () => {
    const card = await createCard({ summary: 'Plain task', column: 'todo' });
    expect(card.dtstart).toBeUndefined();
  });
});

describe('formatRruleText', () => {
  const base: Card = {
    id: 'test',
    uid: 'test',
    summary: 'Test',
    column: 'todo',
    created: new Date(),
    modified: new Date(),
    dtstart: new Date('2026-01-01T00:00:00.000Z'),
    due: new Date('2026-01-01T00:00:00.000Z'),
  };

  it('returns null for a non-recurring card', () => {
    expect(formatRruleText({ ...base })).toBeNull();
  });

  it('formats a simple weekly recurrence', () => {
    expect(formatRruleText({ ...base, rrule: 'FREQ=WEEKLY' })).toBe('Every week');
  });

  it('formats every 2 weeks', () => {
    expect(formatRruleText({ ...base, rrule: 'FREQ=WEEKLY;INTERVAL=2' })).toBe('Every 2 weeks');
  });

  it('formats every 3 months', () => {
    expect(formatRruleText({ ...base, rrule: 'FREQ=MONTHLY;INTERVAL=3' })).toBe('Every 3 months');
  });

  it('formats daily', () => {
    expect(formatRruleText({ ...base, rrule: 'FREQ=DAILY' })).toBe('Every day');
  });

  it('formats yearly', () => {
    expect(formatRruleText({ ...base, rrule: 'FREQ=YEARLY;INTERVAL=2' })).toBe('Every 2 years');
  });

  it('appends until date when UNTIL is present', () => {
    expect(formatRruleText({ ...base, rrule: 'FREQ=WEEKLY;UNTIL=20260601T000000Z' })).toBe(
      'Every week, until 2026-06-01'
    );
  });

  it('appends occurrences remaining when COUNT is present and on first occurrence', () => {
    const card: Card = {
      ...base,
      rrule: 'FREQ=WEEKLY;COUNT=5',
      dtstart: new Date('2026-01-01T00:00:00.000Z'),
      due: new Date('2026-01-01T00:00:00.000Z'),
    };
    expect(formatRruleText(card)).toBe('Every week (4 occurrences remaining)');
  });

  it('shows 1 occurrence remaining correctly (singular)', () => {
    const card: Card = {
      ...base,
      rrule: 'FREQ=WEEKLY;COUNT=2',
      dtstart: new Date('2026-01-01T00:00:00.000Z'),
      due: new Date('2026-01-01T00:00:00.000Z'),
    };
    expect(formatRruleText(card)).toBe('Every week (1 occurrence remaining)');
  });

  it('shows no count suffix when on the final occurrence', () => {
    const card: Card = {
      ...base,
      rrule: 'FREQ=WEEKLY;COUNT=3',
      dtstart: new Date('2026-01-01T00:00:00.000Z'),
      due: new Date('2026-01-15T00:00:00.000Z'), // 3rd occurrence = last
    };
    expect(formatRruleText(card)).toBe('Every week');
  });

  it('returns null for an unparseable rrule', () => {
    expect(formatRruleText({ ...base, rrule: 'NOT_VALID_GARBAGE' })).toBeNull();
  });

  it('weekly with a single BYDAY', () => {
    expect(formatRruleText({ ...base, rrule: 'FREQ=WEEKLY;BYDAY=MO' })).toBe(
      'Every week on Monday'
    );
  });

  it('weekly with multiple BYDAY days', () => {
    expect(formatRruleText({ ...base, rrule: 'FREQ=WEEKLY;INTERVAL=3;BYDAY=MO,TH,SU' })).toBe(
      'Every 3 weeks on Monday, Thursday, and Sunday'
    );
  });

  it('weekly with two BYDAY days', () => {
    expect(formatRruleText({ ...base, rrule: 'FREQ=WEEKLY;BYDAY=TU,FR' })).toBe(
      'Every week on Tuesday and Friday'
    );
  });

  it('monthly with positional BYDAY (2nd Monday)', () => {
    expect(formatRruleText({ ...base, rrule: 'FREQ=MONTHLY;BYDAY=2MO' })).toBe(
      'Every month on the 2nd Monday'
    );
  });

  it('monthly with positional BYDAY (last Friday)', () => {
    expect(formatRruleText({ ...base, rrule: 'FREQ=MONTHLY;BYDAY=-1FR' })).toBe(
      'Every month on the last Friday'
    );
  });

  it('monthly with BYMONTHDAY', () => {
    expect(formatRruleText({ ...base, rrule: 'FREQ=MONTHLY;BYMONTHDAY=2' })).toBe(
      'Every month on the 2nd'
    );
  });

  it('monthly with BYMONTHDAY (3rd)', () => {
    expect(formatRruleText({ ...base, rrule: 'FREQ=MONTHLY;BYMONTHDAY=3' })).toBe(
      'Every month on the 3rd'
    );
  });

  it('yearly with BYMONTH and BYMONTHDAY', () => {
    expect(formatRruleText({ ...base, rrule: 'FREQ=YEARLY;BYMONTH=1;BYMONTHDAY=9' })).toBe(
      'Every year on 9th January'
    );
  });

  it('yearly with BYMONTH and BYMONTHDAY (1st March)', () => {
    expect(formatRruleText({ ...base, rrule: 'FREQ=YEARLY;BYMONTH=3;BYMONTHDAY=1' })).toBe(
      'Every year on 1st March'
    );
  });

  it('qualifier plus UNTIL', () => {
    expect(formatRruleText({ ...base, rrule: 'FREQ=WEEKLY;BYDAY=MO;UNTIL=20260601T000000Z' })).toBe(
      'Every week on Monday, until 2026-06-01'
    );
  });
});

describe('readAllCards validation', () => {
  let tempDir: string;
  const savedDataDir = process.env.QUIKAN_DATA;

  beforeEach(async () => {
    tempDir = await mkdtemp(nodePath.join(tmpdir(), 'quikan-validate-'));
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

  it('returns all cards when all files are valid', async () => {
    await createCard({ summary: 'Task A', column: 'todo' });
    await createCard({ summary: 'Task B', column: 'in-progress' });
    const cards = await readAllCards();
    expect(cards).toHaveLength(2);
  });

  it('throws when a file contains RECURRENCE-ID', async () => {
    await createCard({ summary: 'Normal task', column: 'todo' });
    const badIcs = makeICS('bad-1', ['RECURRENCE-ID;VALUE=DATE:20260401', 'STATUS:COMPLETED']);
    await writeFile(nodePath.join(tempDir, 'bad-1.ics'), badIcs, 'utf-8');

    await expect(readAllCards()).rejects.toThrow(/RECURRENCE-ID/);
  });

  it('throws an aggregated error listing all bad filenames', async () => {
    const bad1 = makeICS('bad-a', ['RECURRENCE-ID;VALUE=DATE:20260401']);
    const bad2 = makeICS('bad-b', ['RECURRENCE-ID;VALUE=DATE:20260402']);
    await writeFile(nodePath.join(tempDir, 'bad-a.ics'), bad1, 'utf-8');
    await writeFile(nodePath.join(tempDir, 'bad-b.ics'), bad2, 'utf-8');

    let error: Error | null = null;
    try {
      await readAllCards();
    } catch (e) {
      error = e as Error;
    }
    expect(error).not.toBeNull();
    expect(error!.message).toContain('bad-a.ics');
    expect(error!.message).toContain('bad-b.ics');
  });

  it('throws when a file contains multiple VTODO components', async () => {
    const badIcs = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Test//EN',
      'BEGIN:VTODO',
      'UID:todo-1',
      'SUMMARY:First',
      'END:VTODO',
      'BEGIN:VTODO',
      'UID:todo-2',
      'SUMMARY:Second',
      'END:VTODO',
      'END:VCALENDAR',
    ].join('\r\n');
    await writeFile(nodePath.join(tempDir, 'multi-vtodo.ics'), badIcs, 'utf-8');

    await expect(readAllCards()).rejects.toThrow(/multiple VTODO/);
  });
});
