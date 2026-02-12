import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import Card from './Card';

interface CardType {
  id: string;
  summary: string;
  column: string;
  sequence: number;
}

interface ColumnProps {
  id: string;
  name: string;
  cards: CardType[];
}

const Column: React.FC<ColumnProps> = ({ id, name, cards }) => {
  const { setNodeRef } = useDroppable({ id });

  // Format column name for display
  const displayName = name
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  return (
    <div className="flex-1 min-w-[300px] bg-gray-100 rounded-lg p-4">
      <h2 className="text-lg font-semibold mb-4 text-gray-700">{displayName}</h2>
      <div ref={setNodeRef} className="space-y-3 min-h-[200px]">
        <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          {cards.map((card) => (
            <Card key={card.id} id={card.id} summary={card.summary} />
          ))}
        </SortableContext>
      </div>
    </div>
  );
};

export default Column;
