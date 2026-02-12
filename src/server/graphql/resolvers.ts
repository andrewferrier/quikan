import {
  readAllCards,
  readCard,
  createCard as createCardStorage,
  updateCard as updateCardStorage,
  moveCard as moveCardStorage,
  deleteCard as deleteCardStorage,
} from '../storage/vtodo.js';
import { Card, Column } from '../types.js';

// Default columns for the Kanban board
const DEFAULT_COLUMNS = ['todo', 'in-progress', 'done'];

export const resolvers = {
  Query: {
    cards: async (): Promise<Card[]> => {
      return await readAllCards();
    },

    card: async (_: unknown, { id }: { id: string }): Promise<Card | null> => {
      return await readCard(id);
    },

    columns: async (): Promise<Column[]> => {
      const cards = await readAllCards();

      return DEFAULT_COLUMNS.map((columnName) => {
        const columnCards = cards
          .filter((card) => card.column === columnName)
          .sort((a, b) => a.sequence - b.sequence);

        return {
          id: columnName,
          name: columnName,
          cards: columnCards,
        };
      });
    },
  },

  Mutation: {
    createCard: async (
      _: unknown,
      { summary, column }: { summary: string; column: string }
    ): Promise<Card> => {
      return await createCardStorage(summary, column);
    },

    updateCard: async (
      _: unknown,
      { id, summary }: { id: string; summary?: string }
    ): Promise<Card | null> => {
      const updates: Partial<Card> = {};
      if (summary !== undefined) {
        updates.summary = summary;
      }
      return await updateCardStorage(id, updates);
    },

    moveCard: async (
      _: unknown,
      {
        id,
        targetColumn,
        targetSequence,
      }: { id: string; targetColumn: string; targetSequence: number }
    ): Promise<Card | null> => {
      return await moveCardStorage(id, targetColumn, targetSequence);
    },

    deleteCard: async (_: unknown, { id }: { id: string }): Promise<boolean> => {
      try {
        await deleteCardStorage(id);
        return true;
      } catch (error) {
        console.error('Error deleting card:', error);
        return false;
      }
    },
  },
};
