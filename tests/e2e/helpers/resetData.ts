import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, '../../../data');
const FIXTURES_DIR = path.resolve(__dirname, '../../fixtures');

function utcDateOffset(offsetDays: number): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + offsetDays));
}

function formatUtcDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

function makeCard(uid: string, summary: string, extras: string[] = []): string {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Quikan//Kanban Board//EN',
    'BEGIN:VTODO',
    `UID:${uid}`,
    `SUMMARY:${summary}`,
    'CREATED:20260101T000000Z',
    'LAST-MODIFIED:20260101T000000Z',
    'DTSTAMP:20260101T000000Z',
    ...extras,
    'END:VTODO',
    'END:VCALENDAR',
  ].join('\n');
}

function writeDynamic(uid: string, content: string): void {
  fs.writeFileSync(path.join(DATA_DIR, `${uid}.ics`), content, 'utf-8');
}

export function resetData(): void {
  if (fs.existsSync(DATA_DIR)) {
    for (const file of fs.readdirSync(DATA_DIR)) {
      if (file.endsWith('.ics')) fs.unlinkSync(path.join(DATA_DIR, file));
    }
  } else {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  // Copy static fixtures (no date-sensitive fields)
  for (const file of fs.readdirSync(FIXTURES_DIR)) {
    if (file.endsWith('.ics')) {
      fs.copyFileSync(path.join(FIXTURES_DIR, file), path.join(DATA_DIR, file));
    }
  }

  // Date-relative todo cards
  const dateCards = [
    { uid: 'seed-today', summary: 'Today todo', offset: 0 },
    { uid: 'seed-tomorrow', summary: 'Tomorrow todo', offset: 1 },
    { uid: 'seed-this-week', summary: 'This week todo', offset: 3 },
    { uid: 'seed-dated', summary: 'Dated todo', offset: 30 },
  ];
  for (const { uid, summary, offset } of dateCards) {
    const due = formatUtcDate(utcDateOffset(offset));
    writeDynamic(uid, makeCard(uid, summary, [`DUE;VALUE=DATE:${due}`]));
  }

  // Recurring card due today (for recurring completion tests)
  writeDynamic(
    'seed-recurring-today',
    makeCard('seed-recurring-today', 'Weekly recurring todo', [
      `DTSTART;VALUE=DATE:${formatUtcDate(utcDateOffset(0))}`,
      `DUE;VALUE=DATE:${formatUtcDate(utcDateOffset(0))}`,
      'RRULE:FREQ=WEEKLY',
    ])
  );

  // Recent done card (visible in Done column)
  const todayStr = formatUtcDate(utcDateOffset(0));
  writeDynamic(
    'seed-done-recent',
    makeCard('seed-done-recent', 'Done task', [
      'STATUS:COMPLETED',
      `COMPLETED:${todayStr}T120000Z`,
    ])
  );

  // Old done card (hidden — completed > 30 days ago)
  writeDynamic(
    'seed-done-old',
    makeCard('seed-done-old', 'Old done task', [
      'STATUS:COMPLETED',
      'COMPLETED:20260101T120000Z',
    ])
  );
}
