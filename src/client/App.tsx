import React, { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import Column from './components/Column';
import Card from './components/Card';
import AddCardDialog from './components/AddCardDialog';
import { GET_COLUMNS, CREATE_CARD, MOVE_CARD } from './graphql/queries';

interface CardType {
  id: string;
  summary: string;
  column: string;
  sequence: number;
}

interface ColumnType {
  id: string;
  name: string;
  cards: CardType[];
}

const App: React.FC = () => {
  const [activeCard, setActiveCard] = useState<CardType | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { loading, error, data, refetch } = useQuery<{ columns: ColumnType[] }>(GET_COLUMNS);
  const [createCard] = useMutation(CREATE_CARD);
  const [moveCard] = useMutation(MOVE_CARD);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const card = data?.columns
      .flatMap((col) => col.cards)
      .find((c) => c.id === active.id);
    setActiveCard(card || null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveCard(null);

    if (!over || !data) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Find the active card
    const activeCard = data.columns
      .flatMap((col) => col.cards)
      .find((c) => c.id === activeId);

    if (!activeCard) return;

    // Determine target column and sequence
    let targetColumn = activeCard.column;
    let targetSequence = activeCard.sequence;

    // Check if we're over a column
    const overColumn = data.columns.find((col) => col.id === overId);
    if (overColumn) {
      targetColumn = overColumn.id;
      targetSequence = overColumn.cards.length;
    } else {
      // We're over a card
      const overCard = data.columns
        .flatMap((col) => col.cards)
        .find((c) => c.id === overId);

      if (overCard) {
        targetColumn = overCard.column;
        targetSequence = overCard.sequence;

        // If dragging within the same column and moving down, adjust sequence
        if (activeCard.column === targetColumn && activeCard.sequence < targetSequence) {
          targetSequence -= 1;
        }
      }
    }

    // Only move if there's an actual change
    if (activeCard.column !== targetColumn || activeCard.sequence !== targetSequence) {
      try {
        await moveCard({
          variables: {
            id: activeId,
            targetColumn,
            targetSequence,
          },
        });
        await refetch();
      } catch (err) {
        console.error('Error moving card:', err);
      }
    }
  };

  const handleAddCard = async (summary: string, column: string) => {
    try {
      await createCard({
        variables: { summary, column },
      });
      await refetch();
    } catch (err) {
      console.error('Error creating card:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-gray-600">Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-red-600">Error loading board: {error.message}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-800">Quikan</h1>
          <button
            onClick={() => setIsDialogOpen(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            + Add Card
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 overflow-x-auto pb-4">
            {data?.columns.map((column) => (
              <Column
                key={column.id}
                id={column.id}
                name={column.name}
                cards={column.cards}
              />
            ))}
          </div>
          <DragOverlay>
            {activeCard ? (
              <div className="rotate-3">
                <Card id={activeCard.id} summary={activeCard.summary} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </main>

      <AddCardDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onSubmit={handleAddCard}
      />
    </div>
  );
};

export default App;
