export interface Card {
  id: string;
  uid: string;
  summary: string;
  description?: string;
  column: string;
  priority?: number;
  created: Date;
  modified: Date;
  completed?: Date;
  due?: Date;
  dueHasTime?: boolean;
  /** The recurrence series anchor. Set once when a recurring card is created; never changes as DUE advances. */
  dtstart?: Date;
  /** Raw RRULE string, e.g. "FREQ=WEEKLY;BYDAY=MO,WE". Present on master recurring cards only. */
  rrule?: string;
  /** False when the RRULE uses parts outside the supported subset (BYYEARDAY, BYWEEKNO, HOURLY, etc.). */
  rruleSupported?: boolean;
  rdates?: Date[];
  exdates?: Date[];
  /**
   * UID of the master recurring card this card was cloned from on completion.
   * Written as X-QUIKAN-RECURRENCE-ID in the .ics file.
   * Present only on Quikan-completed clones; absent on clones made by external tools.
   */
  quikanRecurrenceId?: string;
}

export interface Column {
  id: string;
  name: string;
  cards: Card[];
  hiddenCount: number;
}
