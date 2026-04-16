export interface CardType {
  id: string;
  uid?: string | null;
  summary: string;
  description?: string | null;
  column: string;
  priority?: number | null;
  due?: string | null;
  dueHasTime?: boolean | null;
  completed?: string | null;
  isRecurring?: boolean | null;
  isRecurringChild?: boolean | null;
  quikanRecurrenceId?: string | null;
  rrule?: string | null;
  rruleText?: string | null;
  rruleSupported?: boolean | null;
  rdates?: string[] | null;
  exdates?: string[] | null;
}

export interface ColumnType {
  id: string;
  name: string;
  hiddenCount: number;
  cards: CardType[];
}
