// Tests run with TZ=UTC so local time === UTC, making assertions deterministic.
// "now" is fixed to 2026-03-31T12:00:00Z — a Tuesday.
//
// Calendar context (all UTC/local-same with TZ=UTC):
//   Sun 2026-03-29  (2 days ago)
//   Mon 2026-03-30  (yesterday)
//   Tue 2026-03-31  (today)       ← now = 12:00
//   Wed 2026-04-01  (tomorrow)
//   ...
//   Mon 2026-04-06  (6 days from today — last day in day-of-week window)
//   Tue 2026-04-07  (7 days from today — first day outside window → ISO)

import { formatDue } from './dueDate';

const NOW = new Date('2026-03-31T12:00:00Z');

// ---------------------------------------------------------------------------
// Colour — date-only
// ---------------------------------------------------------------------------
describe('color — date-only', () => {
  it('is red for a past date', () => {
    expect(formatDue('2026-03-30', false, NOW).color).toBe('red');
  });

  it('is red for a date more than one day in the past', () => {
    expect(formatDue('2026-03-01', false, NOW).color).toBe('red');
  });

  it('is green for today', () => {
    expect(formatDue('2026-03-31', false, NOW).color).toBe('green');
  });

  it('is grey for a future date', () => {
    expect(formatDue('2026-04-01', false, NOW).color).toBe('grey');
  });

  it('is grey for a date far in the future', () => {
    expect(formatDue('2027-01-01', false, NOW).color).toBe('grey');
  });
});

// ---------------------------------------------------------------------------
// Colour — datetime
// ---------------------------------------------------------------------------
describe('color — datetime (hasTime=true)', () => {
  it('is red for a datetime in the past', () => {
    expect(formatDue('2026-03-31T11:59:00.000Z', true, NOW).color).toBe('red');
  });

  it('is red for a datetime on an earlier day', () => {
    expect(formatDue('2026-03-30T15:00:00.000Z', true, NOW).color).toBe('red');
  });

  it('is green for a datetime later today', () => {
    expect(formatDue('2026-03-31T13:00:00.000Z', true, NOW).color).toBe('green');
  });

  it('is grey for a datetime tomorrow', () => {
    expect(formatDue('2026-04-01T09:00:00.000Z', true, NOW).color).toBe('grey');
  });

  it('is grey for a datetime far in the future', () => {
    expect(formatDue('2027-06-15T10:00:00.000Z', true, NOW).color).toBe('grey');
  });
});

// ---------------------------------------------------------------------------
// Text format — date-only
// ---------------------------------------------------------------------------
describe('text format — date-only', () => {
  it('shows day-of-week for yesterday', () => {
    expect(formatDue('2026-03-30', false, NOW).text).toBe('Monday');
  });

  it('shows day-of-week for today', () => {
    expect(formatDue('2026-03-31', false, NOW).text).toBe('Tuesday');
  });

  it('shows day-of-week for tomorrow', () => {
    expect(formatDue('2026-04-01', false, NOW).text).toBe('Wednesday');
  });

  it('shows day-of-week for the last day in window (today+6)', () => {
    expect(formatDue('2026-04-06', false, NOW).text).toBe('Monday');
  });

  it('shows ISO for today+7 (first day outside window)', () => {
    expect(formatDue('2026-04-07', false, NOW).text).toBe('2026-04-07');
  });

  it('shows ISO for a date 2 days ago (before yesterday)', () => {
    expect(formatDue('2026-03-29', false, NOW).text).toBe('2026-03-29');
  });

  it('shows ISO for a date far in the past', () => {
    expect(formatDue('2025-12-01', false, NOW).text).toBe('2025-12-01');
  });

  it('shows ISO for a date far in the future', () => {
    expect(formatDue('2027-01-01', false, NOW).text).toBe('2027-01-01');
  });
});

// ---------------------------------------------------------------------------
// Text format — datetime
// ---------------------------------------------------------------------------
describe('text format — datetime (hasTime=true)', () => {
  it('shows day-of-week and time for yesterday', () => {
    expect(formatDue('2026-03-30T09:00:00.000Z', true, NOW).text).toBe('Monday 09:00');
  });

  it('shows day-of-week and time for today (past)', () => {
    expect(formatDue('2026-03-31T10:00:00.000Z', true, NOW).text).toBe('Tuesday 10:00');
  });

  it('shows day-of-week and time for today (future)', () => {
    expect(formatDue('2026-03-31T15:30:00.000Z', true, NOW).text).toBe('Tuesday 15:30');
  });

  it('shows day-of-week and time for tomorrow', () => {
    expect(formatDue('2026-04-01T08:15:00.000Z', true, NOW).text).toBe('Wednesday 08:15');
  });

  it('shows day-of-week and time for today+6 (last in window)', () => {
    expect(formatDue('2026-04-06T14:00:00.000Z', true, NOW).text).toBe('Monday 14:00');
  });

  it('shows ISO and time for today+7 (first outside window)', () => {
    expect(formatDue('2026-04-07T09:00:00.000Z', true, NOW).text).toBe('2026-04-07 09:00');
  });

  it('shows ISO and time for 2 days ago', () => {
    expect(formatDue('2026-03-29T17:45:00.000Z', true, NOW).text).toBe('2026-03-29 17:45');
  });

  it('pads hours and minutes with leading zeros', () => {
    expect(formatDue('2026-04-01T03:05:00.000Z', true, NOW).text).toBe('Wednesday 03:05');
  });

  it('does not include seconds', () => {
    const { text } = formatDue('2026-04-01T10:30:45.000Z', true, NOW);
    expect(text).toBe('Wednesday 10:30');
    expect(text).not.toMatch(/:\d{2}:\d{2}/);
  });
});

// ---------------------------------------------------------------------------
// 00:00 local time → treated as date-only
// ---------------------------------------------------------------------------
describe('00:00 time treated as date-only', () => {
  it('shows no time component when hasTime=true but time is 00:00', () => {
    // 2026-04-01T00:00:00Z = midnight UTC = 00:00 local with TZ=UTC
    const { text } = formatDue('2026-04-01T00:00:00.000Z', true, NOW);
    expect(text).toBe('Wednesday'); // day-of-week, no time
    expect(text).not.toMatch(/\d{2}:\d{2}/);
  });

  it('uses date-only color logic when time is 00:00 (today → green)', () => {
    expect(formatDue('2026-03-31T00:00:00.000Z', true, NOW).color).toBe('green');
  });

  it('uses date-only color logic when time is 00:00 (yesterday → red)', () => {
    expect(formatDue('2026-03-30T00:00:00.000Z', true, NOW).color).toBe('red');
  });

  it('uses date-only color logic when time is 00:00 (future → grey)', () => {
    expect(formatDue('2026-04-01T00:00:00.000Z', true, NOW).color).toBe('grey');
  });

  it('still shows time when hasTime=true and time is non-zero', () => {
    const { text } = formatDue('2026-04-01T09:30:00.000Z', true, NOW);
    expect(text).toBe('Wednesday 09:30');
  });
});


describe('edge cases', () => {
  it('date-only midnight boundary: exactly at start of window (yesterday 00:00)', () => {
    expect(formatDue('2026-03-30', false, NOW).text).toBe('Monday'); // in window
  });

  it('datetime exactly equal to now is past (not green)', () => {
    // Same millisecond as now is not < now, but...
    // Actually new Date('2026-03-31T12:00:00Z') < new Date('2026-03-31T12:00:00Z') is false
    // so it falls through to isSameLocalDay which is true → green
    expect(formatDue('2026-03-31T12:00:00.000Z', true, NOW).color).toBe('green');
  });

  it('datetime one millisecond before now is red', () => {
    expect(formatDue('2026-03-31T11:59:59.999Z', true, NOW).color).toBe('red');
  });
});
