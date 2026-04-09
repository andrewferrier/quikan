import { shouldPerformMove, DraggableCard } from './dragLogic';

const cards: DraggableCard[] = [
  { id: 'card-1', column: 'todo' },
  { id: 'card-2', column: 'in-progress' },
  { id: 'card-3', column: 'done' },
];

describe('shouldPerformMove', () => {
  describe('dragging between columns (allowed)', () => {
    it('returns true when card is dragged from todo to in-progress', () => {
      expect(shouldPerformMove(cards, 'card-1', 'in-progress')).toBe(true);
    });

    it('returns true when card is dragged from todo to done', () => {
      expect(shouldPerformMove(cards, 'card-1', 'done')).toBe(true);
    });

    it('returns true when card is dragged from in-progress to todo', () => {
      expect(shouldPerformMove(cards, 'card-2', 'todo')).toBe(true);
    });

    it('returns true when card is dragged from done to todo', () => {
      expect(shouldPerformMove(cards, 'card-3', 'todo')).toBe(true);
    });

    it('returns true when card is dragged from in-progress to done', () => {
      expect(shouldPerformMove(cards, 'card-2', 'done')).toBe(true);
    });
  });

  describe('dragging within the same column (not allowed)', () => {
    it('returns false when card is dropped on its own column (todo)', () => {
      expect(shouldPerformMove(cards, 'card-1', 'todo')).toBe(false);
    });

    it('returns false when card is dropped on its own column (in-progress)', () => {
      expect(shouldPerformMove(cards, 'card-2', 'in-progress')).toBe(false);
    });

    it('returns false when card is dropped on its own column (done)', () => {
      expect(shouldPerformMove(cards, 'card-3', 'done')).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('returns false when there is no drop target', () => {
      expect(shouldPerformMove(cards, 'card-1', null)).toBe(false);
    });

    it('returns false when the active card is not found', () => {
      expect(shouldPerformMove(cards, 'non-existent', 'in-progress')).toBe(false);
    });

    it('returns false when the card list is empty', () => {
      expect(shouldPerformMove([], 'card-1', 'in-progress')).toBe(false);
    });
  });
});

describe('shouldPerformMove with virtual todo columns', () => {
  const virtualCards: DraggableCard[] = [
    { id: 'today-card', column: 'todo-today' },
    { id: 'tomorrow-card', column: 'todo-tomorrow' },
    { id: 'no-date-card', column: 'todo' },
  ];

  it('returns true when moving from todo-today to todo-tomorrow (different virtual columns)', () => {
    expect(shouldPerformMove(virtualCards, 'today-card', 'todo-tomorrow')).toBe(true);
  });

  it('returns true when moving from in-progress to a virtual todo column', () => {
    const cards: DraggableCard[] = [{ id: 'card', column: 'in-progress' }];
    expect(shouldPerformMove(cards, 'card', 'todo-today')).toBe(true);
  });

  it('returns false when dropping a card on its own virtual column', () => {
    expect(shouldPerformMove(virtualCards, 'today-card', 'todo-today')).toBe(false);
  });

  it('returns true when moving from todo-today to todo (no due date)', () => {
    expect(shouldPerformMove(virtualCards, 'today-card', 'todo')).toBe(true);
  });

  it('returns true when moving from todo to todo-this-week', () => {
    expect(shouldPerformMove(virtualCards, 'no-date-card', 'todo-this-week')).toBe(true);
  });
});
