import ICAL from 'ical.js';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Card } from '../types.js';

const DATA_DIR = process.env.DATA_DIR || './data';

/**
 * Parse a VTODO from iCalendar format to Card object
 */
export function parseVTODO(icsContent: string, filename: string): Card {
  const jcalData = ICAL.parse(icsContent);
  const comp = new ICAL.Component(jcalData);
  const vtodo = comp.getFirstSubcomponent('vtodo');

  if (!vtodo) {
    throw new Error('No VTODO component found');
  }

  const summary = (vtodo.getFirstPropertyValue('summary') as string) || '';
  const created = vtodo.getFirstPropertyValue('created') || new Date();
  const modified = vtodo.getFirstPropertyValue('last-modified') || new Date();

  // Get custom properties for column and sequence
  let column = 'todo';
  let sequence = 0;

  // Look for X-QUIKAN-COLUMN property
  const columnProp = vtodo.getFirstProperty('x-quikan-column');
  if (columnProp) {
    const columnValue = columnProp.getFirstValue();
    if (typeof columnValue === 'string') {
      column = columnValue;
    }
  }

  // Look for X-QUIKAN-SEQUENCE property
  const seqProp = vtodo.getFirstProperty('x-quikan-sequence');
  if (seqProp) {
    const seqValue = seqProp.getFirstValue();
    if (typeof seqValue === 'string') {
      sequence = parseInt(seqValue, 10) || 0;
    }
  }

  // Extract ID from filename (remove .ics extension)
  const id = filename.replace('.ics', '');

  return {
    id,
    summary,
    column,
    sequence,
    created: created instanceof Date ? created : new Date(created.toString()),
    modified: modified instanceof Date ? modified : new Date(modified.toString()),
  };
}

/**
 * Convert a Card object to VTODO iCalendar format
 */
export function cardToVTODO(card: Card): string {
  const comp = new ICAL.Component(['vcalendar', [], []]);
  comp.updatePropertyWithValue('version', '2.0');
  comp.updatePropertyWithValue('prodid', '-//Quikan//Kanban Board//EN');

  const vtodo = new ICAL.Component('vtodo');
  vtodo.updatePropertyWithValue('uid', card.id);
  vtodo.updatePropertyWithValue('summary', card.summary);
  vtodo.updatePropertyWithValue('created', ICAL.Time.fromJSDate(card.created, false));
  vtodo.updatePropertyWithValue('last-modified', ICAL.Time.fromJSDate(card.modified, false));
  vtodo.updatePropertyWithValue('dtstamp', ICAL.Time.fromJSDate(new Date(), false));

  // Add custom properties
  vtodo.updatePropertyWithValue('x-quikan-column', card.column);
  vtodo.updatePropertyWithValue('x-quikan-sequence', card.sequence.toString());

  comp.addSubcomponent(vtodo);

  return comp.toString();
}

/**
 * Read all cards from the data directory
 */
export async function readAllCards(): Promise<Card[]> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const files = await fs.readdir(DATA_DIR);
    const icsFiles = files.filter((f) => f.endsWith('.ics'));

    const cards = await Promise.all(
      icsFiles.map(async (file) => {
        const content = await fs.readFile(path.join(DATA_DIR, file), 'utf-8');
        return parseVTODO(content, file);
      })
    );

    return cards;
  } catch (error) {
    console.error('Error reading cards:', error);
    return [];
  }
}

/**
 * Read a single card by ID
 */
export async function readCard(id: string): Promise<Card | null> {
  try {
    const content = await fs.readFile(path.join(DATA_DIR, `${id}.ics`), 'utf-8');
    return parseVTODO(content, `${id}.ics`);
  } catch (error) {
    return null;
  }
}

/**
 * Write a card to the data directory
 */
export async function writeCard(card: Card): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const icsContent = cardToVTODO(card);
  await fs.writeFile(path.join(DATA_DIR, `${card.id}.ics`), icsContent, 'utf-8');
}

/**
 * Delete a card from the data directory
 */
export async function deleteCard(id: string): Promise<void> {
  await fs.unlink(path.join(DATA_DIR, `${id}.ics`));
}

/**
 * Create a new card
 */
export async function createCard(summary: string, column: string): Promise<Card> {
  const cards = await readAllCards();
  const columnCards = cards.filter((c) => c.column === column);
  const maxSequence = columnCards.reduce((max, c) => Math.max(max, c.sequence), -1);

  const card: Card = {
    id: uuidv4(),
    summary,
    column,
    sequence: maxSequence + 1,
    created: new Date(),
    modified: new Date(),
  };

  await writeCard(card);
  return card;
}

/**
 * Update an existing card
 */
export async function updateCard(
  id: string,
  updates: Partial<Omit<Card, 'id' | 'created'>>
): Promise<Card | null> {
  const card = await readCard(id);
  if (!card) {
    return null;
  }

  const updatedCard: Card = {
    ...card,
    ...updates,
    modified: new Date(),
  };

  await writeCard(updatedCard);
  return updatedCard;
}

/**
 * Move a card to a different column
 */
export async function moveCard(
  id: string,
  targetColumn: string,
  targetSequence: number
): Promise<Card | null> {
  const cards = await readAllCards();
  const card = cards.find((c) => c.id === id);

  if (!card) {
    return null;
  }

  const oldColumn = card.column;
  const oldSequence = card.sequence;

  // Update sequences in the old column
  if (oldColumn === targetColumn) {
    // Moving within the same column
    for (const c of cards) {
      if (c.column === oldColumn && c.id !== id) {
        if (oldSequence < targetSequence) {
          // Moving down
          if (c.sequence > oldSequence && c.sequence <= targetSequence) {
            await updateCard(c.id, { sequence: c.sequence - 1 });
          }
        } else {
          // Moving up
          if (c.sequence >= targetSequence && c.sequence < oldSequence) {
            await updateCard(c.id, { sequence: c.sequence + 1 });
          }
        }
      }
    }
  } else {
    // Moving to a different column
    // Update sequences in old column (shift down)
    for (const c of cards) {
      if (c.column === oldColumn && c.sequence > oldSequence) {
        await updateCard(c.id, { sequence: c.sequence - 1 });
      }
    }

    // Update sequences in new column (shift up)
    for (const c of cards) {
      if (c.column === targetColumn && c.sequence >= targetSequence) {
        await updateCard(c.id, { sequence: c.sequence + 1 });
      }
    }
  }

  // Update the moved card
  return await updateCard(id, { column: targetColumn, sequence: targetSequence });
}
