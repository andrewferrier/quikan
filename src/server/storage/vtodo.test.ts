import { parseVTODO, cardToVTODO } from '../storage/vtodo';
import { Card } from '../types';

describe('VTODO Storage', () => {
  describe('parseVTODO', () => {
    it('should parse a valid VTODO', () => {
      const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Quikan//Kanban Board//EN
BEGIN:VTODO
UID:test-card-1
SUMMARY:Test Card
CREATED:20260212T100000Z
LAST-MODIFIED:20260212T100000Z
DTSTAMP:20260212T100000Z
X-QUIKAN-COLUMN:todo
X-QUIKAN-SEQUENCE:0
END:VTODO
END:VCALENDAR`;

      const card = parseVTODO(icsContent, 'test-card-1.ics');

      expect(card.id).toBe('test-card-1');
      expect(card.summary).toBe('Test Card');
      expect(card.column).toBe('todo');
      expect(card.sequence).toBe(0);
    });

    it('should use default values for missing properties', () => {
      const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Quikan//Kanban Board//EN
BEGIN:VTODO
UID:test-card-2
SUMMARY:Test Card 2
CREATED:20260212T100000Z
LAST-MODIFIED:20260212T100000Z
DTSTAMP:20260212T100000Z
END:VTODO
END:VCALENDAR`;

      const card = parseVTODO(icsContent, 'test-card-2.ics');

      expect(card.column).toBe('todo');
      expect(card.sequence).toBe(0);
    });
  });

  describe('cardToVTODO', () => {
    it('should convert a card to VTODO format', () => {
      const card: Card = {
        id: 'test-card-3',
        summary: 'Test Card 3',
        column: 'in-progress',
        sequence: 5,
        created: new Date('2026-02-12T10:00:00Z'),
        modified: new Date('2026-02-12T11:00:00Z'),
      };

      const icsContent = cardToVTODO(card);

      expect(icsContent).toContain('BEGIN:VCALENDAR');
      expect(icsContent).toContain('BEGIN:VTODO');
      expect(icsContent).toContain('UID:test-card-3');
      expect(icsContent).toContain('SUMMARY:Test Card 3');
      expect(icsContent).toContain('X-QUIKAN-COLUMN:in-progress');
      expect(icsContent).toContain('X-QUIKAN-SEQUENCE:5');
      expect(icsContent).toContain('END:VTODO');
      expect(icsContent).toContain('END:VCALENDAR');
    });
  });
});
