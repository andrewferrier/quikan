import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
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
import {
  ALL_VIRTUAL_TODO_COL_IDS,
  buildColumns,
  computeVirtualColumnUpdates,
  getTodoVirtualColumn,
} from './columns.js';

function getGitVersion(): string {
  try {
    return execSync('git describe --tags --always', { encoding: 'utf8' }).trim();
  } catch {
    try {
      const versionFile = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'version.txt');
      return readFileSync(versionFile, 'utf8').trim();
    } catch {
      return 'unknown';
    }
  }
}

const GIT_VERSION = getGitVersion();

let testNow: Date | null = null;

export function getNow(): Date {
  return testNow ?? new Date();
}

export function formatDueField(card: Card): string | null {
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
      await createCardStorage({
        summary,
        column,
        due: dueDate,
        dueHasTime,
        priority,
        description,
        rrule,
        rdates: parseRdatesInput(rdates),
        exdates: parseRdatesInput(exdates),
      });
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
        const existing = await readCard(id);
        const result = computeVirtualColumnUpdates(targetColumn, getNow(), existing ?? undefined);
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
