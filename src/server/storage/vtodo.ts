import ICAL from 'ical.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Card } from '../types.js';

/** Returns the data directory, reading QUIKAN_DATA from the environment at call time. */
function getDataDir(): string {
  return process.env.QUIKAN_DATA ?? 'data';
}

/** Maps iCalendar STATUS values to Quikan column IDs. */
const STATUS_TO_COLUMN: Record<string, string> = {
  COMPLETED: 'done',
  'IN-PROCESS': 'in-progress',
  'NEEDS-ACTION': 'todo',
};

/** Maps Quikan column IDs to iCalendar STATUS values. */
const COLUMN_TO_STATUS: Record<string, string> = {
  done: 'COMPLETED',
  'in-progress': 'IN-PROCESS',
};

/** RRULE parts that fall outside Quikan's supported subset. */
const UNSUPPORTED_RRULE_PARTS = new Set([
  'BYYEARDAY',
  'BYWEEKNO',
  'BYHOUR',
  'BYMINUTE',
  'BYSECOND',
]);
const UNSUPPORTED_RRULE_FREQS = new Set(['SECONDLY', 'MINUTELY', 'HOURLY']);

function isRruleSupported(recur: typeof ICAL.Recur.prototype): boolean {
  if (UNSUPPORTED_RRULE_FREQS.has(recur.freq?.toUpperCase())) return false;
  for (const part of Object.keys(recur.parts ?? {})) {
    if (UNSUPPORTED_RRULE_PARTS.has(part)) return false;
  }
  return true;
}

/**
 * Convert an ICAL.Time to a JS Date, preserving UTC midnight for date-only values.
 * ical.js .toJSDate() uses local midnight for date-only values, which would be wrong
 * in non-UTC environments — so we use Date.UTC() explicitly for dates.
 */
function icalTimeToDate(icalTime: typeof ICAL.Time.prototype): Date {
  if (icalTime.isDate) {
    return new Date(Date.UTC(icalTime.year, icalTime.month - 1, icalTime.day));
  }
  return icalTime.toJSDate();
}

/** Format a UTC Date as a date-only iCal date string YYYY-MM-DD. */
function formatDateUTCDash(d: Date): string {
  return [
    d.getUTCFullYear(),
    String(d.getUTCMonth() + 1).padStart(2, '0'),
    String(d.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

/** Build the ICAL.Time for a DUE/DTSTART/RECURRENCE-ID property. */
function dateToIcalTime(d: Date, hasTime: boolean | undefined): typeof ICAL.Time.prototype {
  if (!hasTime) {
    return ICAL.Time.fromDateString(formatDateUTCDash(d));
  }
  return ICAL.Time.fromJSDate(d, true);
}

export function parseVTODO(icsContent: string, filename: string): Card {
  const jcalData = ICAL.parse(icsContent);
  const comp = new ICAL.Component(jcalData);
  const vtodo = comp.getFirstSubcomponent('vtodo');

  if (!vtodo) {
    throw new Error('No VTODO component found');
  }

  const id = filename.replace('.ics', '');

  // UID property (may differ from filename for child overrides)
  const uidProp = vtodo.getFirstProperty('uid');
  const uid = uidProp ? (uidProp.getFirstValue() as string) || id : id;

  const summary = (vtodo.getFirstPropertyValue('summary') as string) || '';
  const description = (vtodo.getFirstPropertyValue('description') as string) || undefined;
  const created = vtodo.getFirstPropertyValue('created') || new Date();
  const modified = vtodo.getFirstPropertyValue('last-modified') || new Date();

  // Column from STATUS (authoritative), falling back to X-QUIKAN-COLUMN then 'todo'
  const statusProp = vtodo.getFirstProperty('status');
  const statusVal = statusProp
    ? ((statusProp.getFirstValue() as string | null)?.toUpperCase() ?? null)
    : null;
  const isCompleted = statusVal === 'COMPLETED';

  let column: string;
  if (statusVal && STATUS_TO_COLUMN[statusVal] !== undefined) {
    column = STATUS_TO_COLUMN[statusVal];
  } else {
    column = 'todo';
    const columnProp = vtodo.getFirstProperty('x-quikan-column');
    if (columnProp) {
      const val = columnProp.getFirstValue();
      if (typeof val === 'string') column = val;
    }
  }

  // DUE
  let due: Date | undefined;
  let dueHasTime: boolean | undefined;
  const dueProp = vtodo.getFirstProperty('due');
  if (dueProp) {
    const dueTime = dueProp.getFirstValue() as typeof ICAL.Time.prototype;
    dueHasTime = !dueTime.isDate;
    due = icalTimeToDate(dueTime);
  }

  // DTSTART (recurrence series anchor)
  let dtstart: Date | undefined;
  const dtstartProp = vtodo.getFirstProperty('dtstart');
  if (dtstartProp) {
    dtstart = icalTimeToDate(dtstartProp.getFirstValue() as typeof ICAL.Time.prototype);
  }

  // PRIORITY
  let priority: number | undefined;
  const priorityProp = vtodo.getFirstProperty('priority');
  if (priorityProp) {
    const val = priorityProp.getFirstValue();
    const num = typeof val === 'number' ? val : parseInt(String(val), 10);
    if (!isNaN(num) && num >= 1 && num <= 9) priority = num;
  }

  // COMPLETED
  let completed: Date | undefined;
  if (isCompleted) {
    const completedProp = vtodo.getFirstProperty('completed');
    if (completedProp) {
      const ct = completedProp.getFirstValue() as typeof ICAL.Time.prototype;
      completed = ct.toJSDate ? ct.toJSDate() : new Date(ct.toString());
    } else {
      completed = modified instanceof Date ? modified : new Date(modified.toString());
    }
  }

  // RRULE
  let rrule: string | undefined;
  let rruleSupported: boolean | undefined;
  const rruleProp = vtodo.getFirstProperty('rrule');
  if (rruleProp) {
    const recur = rruleProp.getFirstValue() as typeof ICAL.Recur.prototype;
    rrule = recur.toString();
    rruleSupported = isRruleSupported(recur);
  }

  // RECURRENCE-ID
  let recurrenceId: Date | undefined;
  const recurrenceIdProp = vtodo.getFirstProperty('recurrence-id');
  if (recurrenceIdProp) {
    recurrenceId = icalTimeToDate(recurrenceIdProp.getFirstValue() as typeof ICAL.Time.prototype);
  }

  // RDATE
  let rdates: Date[] | undefined;
  const rdateProps = vtodo.getAllProperties('rdate');
  if (rdateProps.length > 0) {
    rdates = rdateProps.map((p) => icalTimeToDate(p.getFirstValue() as typeof ICAL.Time.prototype));
  }

  // EXDATE
  let exdates: Date[] | undefined;
  const exdateProps = vtodo.getAllProperties('exdate');
  if (exdateProps.length > 0) {
    exdates = exdateProps.map((p) =>
      icalTimeToDate(p.getFirstValue() as typeof ICAL.Time.prototype)
    );
  }

  return {
    id,
    uid,
    summary,
    description,
    column,
    priority,
    created: created instanceof Date ? created : new Date(created.toString()),
    modified: modified instanceof Date ? modified : new Date(modified.toString()),
    completed,
    due,
    dueHasTime,
    dtstart,
    rrule,
    rruleSupported,
    rdates,
    exdates,
    recurrenceId,
    isRecurringChild: !!recurrenceId,
  };
}

/**
 * Convert a Card object to VTODO iCalendar format.
 *
 * All columns write both STATUS and X-QUIKAN-COLUMN. STATUS is authoritative
 * on read; X-QUIKAN-COLUMN is a human-readable hint and fallback for external tools.
 */
export function cardToVTODO(card: Card): string {
  const comp = new ICAL.Component(['vcalendar', [], []]);
  comp.updatePropertyWithValue('version', '2.0');
  comp.updatePropertyWithValue('prodid', '-//Quikan//Kanban Board//EN');

  const vtodo = new ICAL.Component('vtodo');
  vtodo.updatePropertyWithValue('uid', card.uid ?? card.id);
  vtodo.updatePropertyWithValue('summary', card.summary);
  if (card.description) {
    vtodo.updatePropertyWithValue('description', card.description);
  }
  vtodo.updatePropertyWithValue('created', ICAL.Time.fromJSDate(card.created, false));
  vtodo.updatePropertyWithValue('last-modified', ICAL.Time.fromJSDate(card.modified, false));
  vtodo.updatePropertyWithValue('dtstamp', ICAL.Time.fromJSDate(new Date(), false));

  const status = COLUMN_TO_STATUS[card.column] ?? 'NEEDS-ACTION';
  vtodo.updatePropertyWithValue('status', status);
  vtodo.updatePropertyWithValue('x-quikan-column', card.column);

  // DTSTART — required by RFC 5545 when RRULE is present; also written for child overrides
  if (card.rrule || card.isRecurringChild) {
    const dtstartDate = card.dtstart ?? card.due;
    if (dtstartDate) {
      vtodo.updatePropertyWithValue('dtstart', dateToIcalTime(dtstartDate, card.dueHasTime));
    }
  }

  if (card.due) {
    vtodo.updatePropertyWithValue('due', dateToIcalTime(card.due, card.dueHasTime));
  }

  if (card.priority !== undefined && card.priority >= 1 && card.priority <= 9) {
    vtodo.updatePropertyWithValue('priority', card.priority);
  }

  if (card.column === 'done' && card.completed) {
    vtodo.updatePropertyWithValue('completed', ICAL.Time.fromJSDate(card.completed, false));
  }

  // Recurrence rule
  if (card.rrule) {
    vtodo.updatePropertyWithValue('rrule', ICAL.Recur.fromString(card.rrule));
  }

  // RECURRENCE-ID (child override cards only)
  if (card.recurrenceId) {
    vtodo.updatePropertyWithValue(
      'recurrence-id',
      dateToIcalTime(card.recurrenceId, card.dueHasTime)
    );
  }

  // RDATE list
  if (card.rdates) {
    for (const rdate of card.rdates) {
      vtodo.addPropertyWithValue('rdate', ICAL.Time.fromJSDate(rdate, true));
    }
  }

  // EXDATE list
  if (card.exdates) {
    for (const exdate of card.exdates) {
      vtodo.addPropertyWithValue('exdate', ICAL.Time.fromJSDate(exdate, true));
    }
  }

  comp.addSubcomponent(vtodo);
  return comp.toString();
}

const FREQ_LABELS: Record<string, [string, string]> = {
  DAILY: ['day', 'days'],
  WEEKLY: ['week', 'weeks'],
  MONTHLY: ['month', 'months'],
  YEARLY: ['year', 'years'],
};

const DAY_NAMES: Record<string, string> = {
  MO: 'Monday',
  TU: 'Tuesday',
  WE: 'Wednesday',
  TH: 'Thursday',
  FR: 'Friday',
  SA: 'Saturday',
  SU: 'Sunday',
};

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function ordinal(n: number): string {
  if (n === -1) return 'last';
  const abs = Math.abs(n);
  const suffix =
    abs % 100 >= 11 && abs % 100 <= 13
      ? 'th'
      : abs % 10 === 1
        ? 'st'
        : abs % 10 === 2
          ? 'nd'
          : abs % 10 === 3
            ? 'rd'
            : 'th';
  return `${n}${suffix}`;
}

function listJoin(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

function parseByDayEntry(entry: string): { pos: number | null; day: string } {
  const match = entry.match(/^(-?\d+)?([A-Z]{2})$/);
  if (!match) return { pos: null, day: entry };
  return { pos: match[1] !== undefined ? parseInt(match[1]) : null, day: match[2] };
}

function qualifierText(freq: string, parts: Record<string, unknown>): string | null {
  const byday = parts.BYDAY as string[] | undefined;
  const bymonthday = parts.BYMONTHDAY as number[] | undefined;
  const bymonth = parts.BYMONTH as number[] | undefined;

  if (freq === 'WEEKLY' && byday?.length) {
    return `on ${listJoin(byday.map((d) => DAY_NAMES[d] ?? d))}`;
  }

  if (freq === 'MONTHLY' && byday?.length) {
    const texts = byday.map(parseByDayEntry).map(({ pos, day }) => {
      const name = DAY_NAMES[day] ?? day;
      return pos !== null ? `the ${ordinal(pos)} ${name}` : name;
    });
    return `on ${listJoin(texts)}`;
  }

  if (freq === 'MONTHLY' && bymonthday?.length) {
    return `on ${listJoin(bymonthday.map((d) => `the ${ordinal(d)}`))}`;
  }

  if (freq === 'YEARLY' && bymonth?.length && bymonthday?.length) {
    const texts = bymonthday.flatMap((day) =>
      bymonth.map((month) => `${ordinal(day)} ${MONTH_NAMES[month - 1] ?? month}`)
    );
    return `on ${listJoin(texts)}`;
  }

  return null;
}

/**
 * Produce a human-readable description of a recurring card's repeat pattern,
 * e.g. "Every 2 weeks on Monday", "Every month on the 2nd", "Every year on 9th January",
 * "Every week, until 2026-01-01", "Every week (3 occurrences remaining)".
 * Returns null for non-recurring cards or on parse errors.
 */
export function formatRruleText(card: Card): string | null {
  if (!card.rrule) return null;

  let recur: typeof ICAL.Recur.prototype;
  try {
    recur = ICAL.Recur.fromString(card.rrule);
  } catch {
    return null;
  }

  if (!recur.freq) return null;
  const freq = recur.freq.toUpperCase();
  const interval: number = recur.interval ?? 1;
  const [singular, plural] = FREQ_LABELS[freq] ?? ['occurrence', 'occurrences'];
  const base = interval === 1 ? `Every ${singular}` : `Every ${interval} ${plural}`;

  const qualifier = qualifierText(freq, recur.parts ?? {});
  const description = qualifier ? `${base} ${qualifier}` : base;

  if (recur.until) {
    const untilStr = recur.until.toJSDate().toISOString().slice(0, 10);
    return `${description}, until ${untilStr}`;
  }

  if (recur.count && card.dtstart && card.due) {
    const anchor = dateToIcalTime(card.dtstart, card.dueHasTime);
    const dueTime = dateToIcalTime(card.due, card.dueHasTime);
    const iter = recur.iterator(anchor);
    let seen = 0;
    for (let i = 0; i < recur.count; i++) {
      const next = iter.next();
      if (!next) break;
      if (next.compare(dueTime) <= 0) seen++;
      else break;
    }
    const remaining = recur.count - seen;
    if (remaining > 0) {
      return `${description} (${remaining} occurrence${remaining === 1 ? '' : 's'} remaining)`;
    }
    return description;
  }

  return description;
}

/**
 * Find the next occurrence in a master card's recurrence set after master.due
 * that has not already been overridden by an existing child.
 * Returns null if the series is exhausted.
 *
 * Uses ical.js RRULE iteration. Safety-limited to 1000 iterations.
 */
export function computeNextOccurrence(master: Card, existingChildren: Card[]): Date | null {
  if (!master.rrule) return null;

  const anchor = master.dtstart ?? master.due;
  if (!anchor) return null;

  let recur: typeof ICAL.Recur.prototype;
  try {
    recur = ICAL.Recur.fromString(master.rrule);
  } catch {
    return null;
  }

  const icalAnchor = dateToIcalTime(anchor, master.dueHasTime);
  const iter = recur.iterator(icalAnchor);

  // Dates already covered by child overrides (ms timestamps for fast lookup)
  const overriddenMs = new Set(
    existingChildren.filter((c) => c.recurrenceId).map((c) => c.recurrenceId!.getTime())
  );

  const currentDueMs = master.due?.getTime() ?? 0;
  const MAX_ITER = 1000;

  for (let i = 0; i < MAX_ITER; i++) {
    const next = iter.next();
    if (!next) break;
    const nextDate = icalTimeToDate(next);
    const nextMs = nextDate.getTime();
    if (nextMs > currentDueMs && !overriddenMs.has(nextMs)) {
      return nextDate;
    }
  }

  return null;
}

export async function readAllCards(): Promise<Card[]> {
  try {
    await fs.mkdir(getDataDir(), { recursive: true });
    const files = await fs.readdir(getDataDir());
    const icsFiles = files.filter((f) => f.endsWith('.ics'));

    const cards = await Promise.all(
      icsFiles.map(async (file) => {
        const content = await fs.readFile(path.join(getDataDir(), file), 'utf-8');
        return parseVTODO(content, file);
      })
    );

    return cards;
  } catch (error) {
    console.error('Error reading cards:', error);
    return [];
  }
}

export async function readCard(id: string): Promise<Card | null> {
  try {
    const content = await fs.readFile(path.join(getDataDir(), `${id}.ics`), 'utf-8');
    return parseVTODO(content, `${id}.ics`);
  } catch {
    return null;
  }
}

/** Return all child override cards that share the given UID. */
export async function readChildrenOf(uid: string): Promise<Card[]> {
  const all = await readAllCards();
  return all.filter((c) => c.uid === uid && c.isRecurringChild);
}

/** Return the master card for the given UID (the card without a RECURRENCE-ID). */
export async function readMasterOf(uid: string): Promise<Card | null> {
  const all = await readAllCards();
  return all.find((c) => c.uid === uid && !c.isRecurringChild) ?? null;
}

export async function writeCard(card: Card): Promise<void> {
  await fs.mkdir(getDataDir(), { recursive: true });
  const icsContent = cardToVTODO(card);
  await fs.writeFile(path.join(getDataDir(), `${card.id}.ics`), icsContent, 'utf-8');
}

export async function deleteCard(id: string): Promise<void> {
  await fs.unlink(path.join(getDataDir(), `${id}.ics`));
}

export async function createCard(
  summary: string,
  column: string,
  due?: Date,
  dueHasTime?: boolean,
  priority?: number,
  description?: string,
  rrule?: string,
  rdates?: Date[],
  exdates?: Date[]
): Promise<Card> {
  const id = uuidv4();
  const card: Card = {
    id,
    uid: id,
    summary,
    description,
    column,
    priority,
    created: new Date(),
    modified: new Date(),
    due,
    dueHasTime,
    // When recurring: DTSTART = first DUE (series anchor, never changes)
    dtstart: rrule ? due : undefined,
    rrule,
    rruleSupported: rrule ? true : undefined,
    rdates,
    exdates,
  };

  await writeCard(card);
  return card;
}

export async function updateCard(
  id: string,
  updates: Partial<Omit<Card, 'id' | 'created'>>
): Promise<Card | null> {
  const card = await readCard(id);
  if (!card) return null;

  const updatedCard: Card = {
    ...card,
    ...updates,
    modified: new Date(),
  };

  // Auto-manage the COMPLETED timestamp whenever the column changes.
  if ('column' in updates) {
    if (updatedCard.column === 'done') {
      if (!updatedCard.completed) {
        updatedCard.completed = updatedCard.modified;
      }
    } else {
      updatedCard.completed = undefined;
    }
  }

  await writeCard(updatedCard);
  return updatedCard;
}

/**
 * Create a child override card for a specific instance of a recurring master.
 * The child inherits the master's current DUE as its own DUE and RECURRENCE-ID.
 */
export async function createChildOverride(master: Card, targetColumn: string): Promise<Card> {
  const now = new Date();
  const instanceDate = master.due ?? now;
  const childId = uuidv4();

  const child: Card = {
    id: childId,
    uid: master.uid,
    summary: master.summary,
    description: master.description,
    column: targetColumn,
    priority: master.priority,
    created: master.created,
    modified: now,
    due: instanceDate,
    dueHasTime: master.dueHasTime,
    dtstart: instanceDate,
    recurrenceId: instanceDate,
    isRecurringChild: true,
    completed: targetColumn === 'done' ? now : undefined,
  };

  await writeCard(child);
  return child;
}

/**
 * Move a card to a different column.
 *
 * For a recurring master with a supported RRULE: creates a child override for
 * the current instance, then advances the master's DUE to the next occurrence.
 * Returns the child card (which appears in the target column).
 *
 * For child cards and non-recurring cards: standard column update.
 */
export async function moveCard(id: string, targetColumn: string): Promise<Card | null> {
  const card = await readCard(id);
  if (!card) return null;

  if (card.rrule && card.rruleSupported !== false && !card.isRecurringChild) {
    const child = await createChildOverride(card, targetColumn);

    const existingChildren = await readChildrenOf(card.uid);
    const nextDue = computeNextOccurrence(card, existingChildren);

    if (nextDue !== null) {
      // Advance master's DUE to the next occurrence; keep it in todo
      await updateCard(id, { due: nextDue, column: 'todo' });
    } else {
      // Series exhausted — complete the master too
      await updateCard(id, { column: 'done' });
    }

    return child;
  }

  return await updateCard(id, { column: targetColumn });
}
