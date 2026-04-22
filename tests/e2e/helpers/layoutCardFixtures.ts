function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

export interface LayoutCardDef {
  uid: string;
  summary: string;
  dateExtras: (today: Date) => string[];
}

export const LAYOUT_CARD_DEFS: LayoutCardDef[] = [
  // Short title, short words
  {
    uid: 'seed-layout-short-sw-day-only',
    summary: 'Buy milk',
    dateExtras: (today) => [`DUE;VALUE=DATE:${formatDate(today)}`],
  },
  {
    uid: 'seed-layout-short-sw-day-time',
    summary: 'Call the vet',
    dateExtras: (today) => [`DUE:${formatDate(today)}T120000Z`],
  },
  {
    uid: 'seed-layout-short-sw-iso-date',
    summary: 'Pay tax bill',
    dateExtras: () => ['DUE;VALUE=DATE:20301231'],
  },
  {
    uid: 'seed-layout-short-sw-iso-time',
    summary: 'Go for a run',
    dateExtras: () => ['DUE:20301231T141500Z'],
  },

  // Short title, long word
  {
    uid: 'seed-layout-short-lw-day-only',
    summary: 'Extraordinarily',
    dateExtras: (today) => [`DUE;VALUE=DATE:${formatDate(today)}`],
  },
  {
    uid: 'seed-layout-short-lw-day-time',
    summary: 'Procrastinating',
    dateExtras: (today) => [`DUE:${formatDate(today)}T120000Z`],
  },
  {
    uid: 'seed-layout-short-lw-iso-date',
    summary: 'Uncharacteristically',
    dateExtras: () => ['DUE;VALUE=DATE:20301231'],
  },
  {
    uid: 'seed-layout-short-lw-iso-time',
    summary: 'Incomprehensibly',
    dateExtras: () => ['DUE:20301231T141500Z'],
  },

  // Long title, short words
  {
    uid: 'seed-layout-long-sw-day-only',
    summary:
      'This is a very long task title that may cause layout issues with the due date badge',
    dateExtras: (today) => [`DUE;VALUE=DATE:${formatDate(today)}`],
  },
  {
    uid: 'seed-layout-long-sw-day-time',
    summary: 'A task with a long title and a time component to check if they both fit on the card',
    dateExtras: (today) => [`DUE:${formatDate(today)}T120000Z`],
  },
  {
    uid: 'seed-layout-long-sw-iso-date',
    summary: 'Another long task title that tests whether an ISO date badge stays within the card',
    dateExtras: () => ['DUE;VALUE=DATE:20301231'],
  },
  {
    uid: 'seed-layout-long-sw-iso-time',
    summary: 'Yet another long title to verify that an ISO date and time badge does not overflow',
    dateExtras: () => ['DUE:20301231T141500Z'],
  },

  // Long title, long words
  {
    uid: 'seed-layout-long-lw-day-only',
    summary:
      'Uncharacteristically important administrative organizational restructuring consideration',
    dateExtras: (today) => [`DUE;VALUE=DATE:${formatDate(today)}`],
  },
  {
    uid: 'seed-layout-long-lw-day-time',
    summary:
      'Extraordinarily comprehensive administrative reorganization discussion and documentation',
    dateExtras: (today) => [`DUE:${formatDate(today)}T120000Z`],
  },
  {
    uid: 'seed-layout-long-lw-iso-date',
    summary:
      'Characteristically incomprehensible organizational bureaucratic restructuring procedures',
    dateExtras: () => ['DUE;VALUE=DATE:20301231'],
  },
  {
    uid: 'seed-layout-long-lw-iso-time',
    summary:
      'Extraordinarily incomprehensible organizational restructuring administrative procedures',
    dateExtras: () => ['DUE:20301231T141500Z'],
  },
];
