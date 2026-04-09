import React, { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client/react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { Toaster, toast } from 'sonner';
import Column from './components/Column';
import CardDialog from './components/CardDialog';
import { GET_COLUMNS, CREATE_CARD, MOVE_CARD, UPDATE_CARD, DELETE_CARD } from './gql/queries';
import { formatDue } from './utils/dueDate';
import { shouldPerformMove } from './utils/dragLogic';

interface CardType {
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
  recurrenceId?: string | null;
  rrule?: string | null;
  rruleSupported?: boolean | null;
  rdates?: string[] | null;
  exdates?: string[] | null;
}

interface ColumnType {
  id: string;
  name: string;
  hiddenCount: number;
  cards: CardType[];
}

const DUE_COLOR_CLASS = {
  red: 'text-red-600',
  green: 'text-green-600',
  grey: 'text-gray-400',
} as const;

const App: React.FC = () => {
  const [draggingCard, setDraggingCard] = useState<CardType | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<CardType | null>(null);

  const { loading, error, data, refetch } = useQuery<{ columns: ColumnType[] }>(GET_COLUMNS);
  const [createCard] = useMutation(CREATE_CARD);
  const [moveCard] = useMutation(MOVE_CARD);
  const [updateCard] = useMutation(UPDATE_CARD);
  const [deleteCard] = useMutation(DELETE_CARD);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const card = data?.columns.flatMap((col) => col.cards).find((c) => c.id === event.active.id);
    setDraggingCard(card || null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setDraggingCard(null);

    if (!data) return;

    const allCards = data.columns.flatMap((col) => col.cards);
    const targetColumn = over?.id as string | undefined;

    if (!shouldPerformMove(allCards, active.id as string, targetColumn)) return;

    try {
      await moveCard({ variables: { id: active.id as string, targetColumn } });
      await refetch();
    } catch {
      toast.error('Could not move todo — server unreachable.');
    }
  };

  const handleAddCard = async (values: {
    summary: string;
    column: string;
    description?: string;
    due?: string;
    priority?: number;
    rrule?: string;
    rdates?: string[];
    exdates?: string[];
  }) => {
    try {
      await createCard({
        variables: {
          summary: values.summary,
          column: values.column,
          due: values.due,
          priority: values.priority ?? null,
          description: values.description ?? null,
          rrule: values.rrule ?? null,
          rdates: values.rdates ?? null,
          exdates: values.exdates ?? null,
        },
      });
      await refetch();
    } catch {
      toast.error('Could not create todo — server unreachable.');
    }
  };

  const handleEditCard = async (values: {
    summary: string;
    column: string;
    description?: string;
    due?: string;
    priority?: number;
    rrule?: string;
    rdates?: string[];
    exdates?: string[];
  }) => {
    if (!editingCard) return;
    try {
      await updateCard({
        variables: {
          id: editingCard.id,
          summary: values.summary,
          column: values.column,
          due: values.due ?? null,
          priority: values.priority ?? null,
          description: values.description ?? null,
          rrule: values.rrule ?? null,
          rdates: values.rdates ?? null,
          exdates: values.exdates ?? null,
        },
      });
      await refetch();
    } catch {
      toast.error('Could not save todo — server unreachable.');
    }
  };

  const handleDeleteCard = async () => {
    if (!editingCard) return;
    try {
      await deleteCard({ variables: { id: editingCard.id } });
      setEditingCard(null);
      await refetch();
    } catch {
      toast.error('Could not delete todo — server unreachable.');
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
      <div className="flex items-center justify-center h-screen flex-col gap-3">
        <p className="text-red-600 font-medium">Could not connect to the server.</p>
        <p className="text-gray-500 text-sm">{error.message}</p>
        <button
          onClick={() => refetch()}
          className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster position="top-right" richColors closeButton />
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-800">Quikan</h1>
          <button
            onClick={() => setIsAddDialogOpen(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            + Add Todo
          </button>
        </div>
      </header>

      <main className="px-4 py-8">
        <DndContext
          sensors={sensors}
          collisionDetection={pointerWithin}
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
                hiddenCount={column.hiddenCount}
                onCardClick={(card) => setEditingCard(card)}
              />
            ))}
          </div>
          <DragOverlay dropAnimation={null}>
            {draggingCard ? (
              <div
                className={`rotate-2 p-4 rounded-lg shadow-xl border border-gray-200 opacity-95 cursor-grabbing ${draggingCard.priority && draggingCard.priority >= 7 ? 'bg-red-100' : draggingCard.priority && draggingCard.priority >= 4 ? 'bg-yellow-100' : draggingCard.priority ? 'bg-blue-100' : 'bg-white'}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm text-gray-800">{draggingCard.summary}</p>
                  {draggingCard.due &&
                    (() => {
                      const d = formatDue(draggingCard.due!, draggingCard.dueHasTime ?? false);
                      return (
                        <span
                          className={`text-xs whitespace-nowrap shrink-0 ${DUE_COLOR_CLASS[d.color]}`}
                        >
                          {d.text}
                        </span>
                      );
                    })()}
                </div>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </main>

      <CardDialog
        isOpen={isAddDialogOpen}
        title="Add Todo"
        submitLabel="Add Todo"
        onClose={() => setIsAddDialogOpen(false)}
        onSubmit={handleAddCard}
      />

      {editingCard && (
        <CardDialog
          isOpen={true}
          title="Edit Todo"
          submitLabel="Save"
          cardId={editingCard.id}
          initialValues={{
            summary: editingCard.summary,
            description: editingCard.description ?? undefined,
            column: editingCard.column,
            priority: editingCard.priority,
            due: editingCard.due ?? undefined,
            dueHasTime: editingCard.dueHasTime ?? undefined,
            rrule: editingCard.rrule ?? undefined,
            rruleSupported: editingCard.rruleSupported ?? undefined,
            rdates: editingCard.rdates ?? undefined,
            exdates: editingCard.exdates ?? undefined,
            isRecurringChild: editingCard.isRecurringChild ?? undefined,
            recurrenceId: editingCard.recurrenceId ?? undefined,
          }}
          onClose={() => setEditingCard(null)}
          onSubmit={handleEditCard}
          onDelete={handleDeleteCard}
          onOpenCard={(id) => {
            const card = data?.columns.flatMap((col) => col.cards).find((c) => c.id === id);
            if (card) {
              setEditingCard(null);
              setTimeout(() => setEditingCard(card), 0);
            }
          }}
        />
      )}
    </div>
  );
};

export default App;
