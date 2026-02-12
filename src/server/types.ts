export interface Card {
  id: string;
  summary: string;
  column: string;
  sequence: number;
  created: Date;
  modified: Date;
}

export interface Column {
  id: string;
  name: string;
  cards: Card[];
}
