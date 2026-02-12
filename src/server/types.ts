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
  /** The DUE date of the recurrence instance this card overrides. Present on child cards only. */
  recurrenceId?: Date;
  /** True when this card is a child override of a recurring master. */
  isRecurringChild?: boolean;
}

export interface Column {
  id: string;
  name: string;
  cards: Card[];
  hiddenCount: number;
}
