import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import Card from './Card';
import { formatDue } from '../utils/dueDate';

interface CardType {
  id: string;
  summary: string;
  description?: string | null;
  column: string;
  priority?: number | null;
  due?: string | null;
  dueHasTime?: boolean | null;
  completed?: string | null;
  isRecurring?: boolean | null;
  isRecurringChild?: boolean | null;
  rruleText?: string | null;
}

interface ColumnProps {
  id: string;
  name: string;
  cards: CardType[];
  hiddenCount: number;
  onCardClick: (card: CardType) => void;
}

const COLUMN_EMOJIS: Record<string, string> = {
  todo: '📋',
  'todo-dated': '🗓️',
  'todo-this-week': '📅',
  'todo-tomorrow': '🌅',
  'todo-today': '🔴',
  'in-progress': '🔄',
  done: '✅',
};

const Column: React.FC<ColumnProps> = ({ id, name, cards, hiddenCount, onCardClick }) => {
  const { setNodeRef, isOver } = useDroppable({ id });

  const cardCount = `${cards.length} card${cards.length !== 1 ? 's' : ''}`;

  let summaryText: React.ReactNode;
  if (id === 'done') {
    summaryText =
      hiddenCount > 0 ? `${cardCount} (${hiddenCount} not shown as >30 days)` : cardCount;
  } else {
    const now = new Date();
    const overdueCount = cards.filter(
      (card) => card.due && formatDue(card.due, card.dueHasTime ?? false, now).color === 'red'
    ).length;
    if (overdueCount > 0) {
      summaryText = (
        <>
          {cardCount}, <span className="text-red-500">{overdueCount} overdue</span>
        </>
      );
    } else {
      summaryText = cardCount;
    }
  }

  return (
    <div
      ref={setNodeRef}
      data-testid={`column-${id}`}
      className={`flex-1 min-w-[300px] rounded-lg p-4 transition-colors ${isOver ? 'bg-gray-200' : 'bg-gray-100'}`}
    >
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-gray-700">
          {COLUMN_EMOJIS[id] ?? ''} {name}
        </h2>
        <p className="text-xs text-gray-500 mt-0.5">{summaryText}</p>
      </div>
      <div className="space-y-3 min-h-[200px]">
        {cards.map((card) => (
          <Card
            key={card.id}
            id={card.id}
            summary={card.summary}
            description={card.description}
            column={card.column}
            priority={card.priority}
            due={card.due}
            dueHasTime={card.dueHasTime}
            completed={card.completed}
            isRecurring={card.isRecurring}
            isRecurringChild={card.isRecurringChild}
            rruleText={card.rruleText}
            onClick={() => onCardClick(card)}
          />
        ))}
      </div>
    </div>
  );
};

export default Column;
