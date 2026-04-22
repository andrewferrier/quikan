import { test } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const QUIKAN_DATA = path.resolve(__dirname, '../../data');
const REPO_ROOT = path.resolve(__dirname, '../../');

const FAKE_NOW = '2026-04-21T09:00:00.000Z';
const FAKE_DATE = new Date('2026-04-21T00:00:00Z');

function fmt(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

function addDays(d: Date, n: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + n));
}

function ics(uid: string, summary: string, extras: string[] = []): string {
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
  ].join('\r\n');
}

function write(uid: string, content: string): void {
  fs.writeFileSync(path.join(QUIKAN_DATA, `${uid}.ics`), content, 'utf-8');
}

function seedDemoData(): void {
  if (fs.existsSync(QUIKAN_DATA)) {
    for (const f of fs.readdirSync(QUIKAN_DATA)) {
      if (f.endsWith('.ics')) fs.unlinkSync(path.join(QUIKAN_DATA, f));
    }
  } else {
    fs.mkdirSync(QUIKAN_DATA, { recursive: true });
  }

  const today = FAKE_DATE; // Tuesday 2026-04-21
  const tomorrow = addDays(today, 1);
  const thisWeek = addDays(today, 3); // Friday of same week
  const thisWeekend = addDays(today, 4); // Saturday
  const nextWeek = addDays(today, 7); // Next Monday
  const future = addDays(today, 45);

  // Today
  write(
    'demo-today-1',
    ics('demo-today-1', 'Review pull request: user auth refactor', [
      `DUE;VALUE=DATE:${fmt(today)}`,
      'PRIORITY:8',
    ])
  );
  write(
    'demo-today-2',
    ics('demo-today-2', 'Book dentist appointment', [
      `DUE;VALUE=DATE:${fmt(today)}`,
      'PRIORITY:5',
      'DESCRIPTION:Check availability for next 2 weeks',
    ])
  );
  write('demo-today-3', ics('demo-today-3', 'Pay electricity bill', [`DUE;VALUE=DATE:${fmt(today)}`]));

  // Tomorrow
  write(
    'demo-tomorrow-1',
    ics('demo-tomorrow-1', 'Prepare sprint retrospective notes', [
      `DUE;VALUE=DATE:${fmt(tomorrow)}`,
      'PRIORITY:5',
    ])
  );
  write(
    'demo-tomorrow-2',
    ics('demo-tomorrow-2', 'Buy birthday present for Mum', [`DUE;VALUE=DATE:${fmt(tomorrow)}`])
  );

  // This week
  write(
    'demo-this-week-1',
    ics('demo-this-week-1', 'Migrate database to new schema', [
      `DUE;VALUE=DATE:${fmt(thisWeek)}`,
      'PRIORITY:8',
      'DESCRIPTION:Run migration scripts on staging first',
    ])
  );
  write(
    'demo-this-week-2',
    ics('demo-this-week-2', 'Update project documentation', [`DUE;VALUE=DATE:${fmt(thisWeek)}`])
  );

  // This weekend
  write(
    'demo-weekend-1',
    ics('demo-weekend-1', 'Clean and reorganise home office', [`DUE;VALUE=DATE:${fmt(thisWeekend)}`])
  );
  write(
    'demo-weekend-2',
    ics('demo-weekend-2', 'Meal prep for the week', [
      `DUE;VALUE=DATE:${fmt(thisWeekend)}`,
      'PRIORITY:2',
    ])
  );

  // Next week
  write(
    'demo-next-week-1',
    ics('demo-next-week-1', 'Quarterly performance review', [
      `DUE;VALUE=DATE:${fmt(nextWeek)}`,
      'PRIORITY:5',
    ])
  );
  write(
    'demo-next-week-2',
    ics('demo-next-week-2', 'Renew car insurance', [`DUE;VALUE=DATE:${fmt(nextWeek)}`])
  );

  // Future
  write(
    'demo-future-1',
    ics('demo-future-1', 'Plan summer holiday', [
      `DUE;VALUE=DATE:${fmt(future)}`,
      'DESCRIPTION:Research flights and accommodation for July',
    ])
  );

  // No due date
  write('demo-nodate-1', ics('demo-nodate-1', 'Read "Designing Data-Intensive Applications"'));
  write('demo-nodate-2', ics('demo-nodate-2', 'Set up home NAS server', ['PRIORITY:2']));

  // In progress
  write(
    'demo-inprogress-1',
    ics('demo-inprogress-1', 'Redesign onboarding flow', [
      'X-QUIKAN-COLUMN:in-progress',
      'PRIORITY:8',
      'DESCRIPTION:Figma mockups approved - now implementing',
    ])
  );
  write(
    'demo-inprogress-2',
    ics('demo-inprogress-2', 'Write integration tests for payments API', [
      'X-QUIKAN-COLUMN:in-progress',
      'PRIORITY:5',
    ])
  );

  // Done (recent)
  write(
    'demo-done-1',
    ics('demo-done-1', 'Deploy v2.1.0 to production', [
      'STATUS:COMPLETED',
      'COMPLETED:20260420T143000Z',
    ])
  );
  write(
    'demo-done-2',
    ics('demo-done-2', 'Fix login redirect bug', [
      'STATUS:COMPLETED',
      'COMPLETED:20260419T093000Z',
    ])
  );

  // Recurring task (weekly standup reminder)
  write(
    'demo-recurring-1',
    ics('demo-recurring-1', 'Weekly team standup prep', [
      `DTSTART;VALUE=DATE:${fmt(today)}`,
      `DUE;VALUE=DATE:${fmt(today)}`,
      'RRULE:FREQ=WEEKLY',
      'PRIORITY:2',
    ])
  );
}

test('capture demo screenshot', async ({ page, request }) => {
  await request.post('/graphql', {
    data: { query: `mutation { setTestNow(iso: "${FAKE_NOW}") { id } }` },
  });

  seedDemoData();

  await page.setViewportSize({ width: 1920, height: 900 });
  await page.goto('/');
  await page.locator('[data-testid="card"]').first().waitFor({ state: 'visible', timeout: 15000 });

  await page.screenshot({ path: path.join(REPO_ROOT, 'screenshot.png') });

  await request.post('/graphql', {
    data: { query: 'mutation { clearTestNow { id } }' },
  });
});
