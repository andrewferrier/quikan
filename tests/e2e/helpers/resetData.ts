import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, '../../../data');
const FIXTURES_DIR = path.resolve(__dirname, '../../fixtures');

function localDayStart(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addLocalDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

function formatUtcDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
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

export function resetData(now: Date = new Date()): void {
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

  const today = localDayStart(now);
  const dow = today.getDay();
  const daysSinceMonday = dow === 0 ? 6 : dow - 1;
  const thisMonday = addLocalDays(today, -daysSinceMonday);
  const thisWeekFriday = addLocalDays(thisMonday, 4);
  const thisSaturday = addLocalDays(thisMonday, 5);
  const nextMonday = addLocalDays(thisMonday, 7);
  const nextSaturday = addLocalDays(thisMonday, 12);
  const nextNextMonday = addLocalDays(thisMonday, 14);
  const tomorrow = addLocalDays(today, 1);
  const future = addLocalDays(today, 30);

  const dateCards: { uid: string; summary: string; date: Date }[] = [
    { uid: 'seed-today', summary: 'Today todo', date: today },
    { uid: 'seed-tomorrow', summary: 'Tomorrow todo', date: tomorrow },
    // thisWeekFriday: lands in todo-this-week on Mon–Wed; on Thu it = tomorrow; on Fri/Sat/Sun it's overdue/today
    { uid: 'seed-this-week', summary: 'This week todo', date: thisWeekFriday },
    // thisSaturday: lands in todo-this-weekend on Mon–Fri; overdue/today on Sat/Sun
    { uid: 'seed-this-weekend', summary: 'This weekend todo', date: thisSaturday },
    // nextMonday: todo-next-week (Mon–Fri) or todo-coming-week (Sat–Sun)
    { uid: 'seed-next-week', summary: 'Next week todo', date: nextMonday },
    // nextSaturday: todo-next-weekend (Sat–Sun) or todo-future (Mon–Fri)
    { uid: 'seed-next-weekend', summary: 'Next weekend todo', date: nextSaturday },
    // nextNextMonday: todo-following-week (Sat–Sun) or todo-future (Mon–Fri)
    { uid: 'seed-following-week', summary: 'Following week todo', date: nextNextMonday },
    { uid: 'seed-future', summary: 'Future todo', date: future },
  ];

  for (const { uid, summary, date } of dateCards) {
    writeDynamic(uid, makeCard(uid, summary, [`DUE;VALUE=DATE:${formatUtcDate(date)}`]));
  }

  // Recurring card due today (for recurring completion tests)
  writeDynamic(
    'seed-recurring-today',
    makeCard('seed-recurring-today', 'Weekly recurring todo', [
      `DTSTART;VALUE=DATE:${formatUtcDate(today)}`,
      `DUE;VALUE=DATE:${formatUtcDate(today)}`,
      'RRULE:FREQ=WEEKLY',
    ])
  );

  // Recent done card (visible in Done column)
  writeDynamic(
    'seed-done-recent',
    makeCard('seed-done-recent', 'Done task', [
      'STATUS:COMPLETED',
      `COMPLETED:${formatUtcDate(today)}T120000Z`,
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
