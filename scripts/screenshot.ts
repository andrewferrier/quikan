import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { spawn, ChildProcess } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const QUIKAN_DATA = path.resolve(__dirname, '../data');
const REPO_ROOT = path.resolve(__dirname, '..');
const BASE_URL = 'http://localhost:5173';
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

  write(
    'demo-future-1',
    ics('demo-future-1', 'Plan summer holiday', [
      `DUE;VALUE=DATE:${fmt(future)}`,
      'DESCRIPTION:Research flights and accommodation for July',
    ])
  );

  write('demo-nodate-1', ics('demo-nodate-1', 'Read "Designing Data-Intensive Applications"'));
  write('demo-nodate-2', ics('demo-nodate-2', 'Set up home NAS server', ['PRIORITY:2']));

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

async function waitForServer(url: string, timeoutMs = 30000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      await fetch(url);
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw new Error(`Server at ${url} did not become ready within ${timeoutMs}ms`);
}

async function graphql(query: string): Promise<void> {
  await fetch(`${BASE_URL}/graphql`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
}

async function main(): Promise<void> {
  let devServer: ChildProcess | undefined;

  const cleanup = () => {
    if (devServer) {
      devServer.kill('SIGTERM');
    }
  };
  process.on('exit', cleanup);
  process.on('SIGINT', () => process.exit(1));
  process.on('SIGTERM', () => process.exit(1));

  console.log('Starting dev server...');
  devServer = spawn('npm', ['run', 'dev'], {
    cwd: REPO_ROOT,
    stdio: 'ignore',
    detached: false,
  });

  await waitForServer(BASE_URL);
  console.log('Dev server ready.');

  await graphql(`mutation { setTestNow(iso: "${FAKE_NOW}") { id } }`);
  seedDemoData();

  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1920, height: 900 });
  await page.goto(BASE_URL);
  await page.locator('[data-testid="card"]').first().waitFor({ state: 'visible', timeout: 15000 });

  const screenshotPath = path.join(REPO_ROOT, 'screenshot.png');
  await page.screenshot({ path: screenshotPath });
  console.log(`Screenshot saved to ${screenshotPath}`);

  await browser.close();
  await graphql('mutation { clearTestNow { id } }');

  cleanup();
  process.off('exit', cleanup);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
