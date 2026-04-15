# Quikan — Development Guide

This file is for AI agents to consume to understand internal details. Whenever an AI agent is making a change to quikan, it should always review this file to see if it can be improved / needs to be updated.

## Coding Conventions

- **Comments**: Only add comments when they provide insight that isn't obvious from the code itself. Never add comments that just label or restate what the code does (e.g., `// Start server` above `app.listen()`). Prefer explaining *why* something is done, or clarifying genuinely non-obvious *what*, and name identifiers in a meaningful way to reduce the need for comments. In general, comments should be minimal and rare.

## Finalizing Changes

Before considering any change complete, always run these steps in order and fix any issues:

1. `npm run format` — auto-formats all source files
2. `npm run lint` — fixes must be made manually; no new errors should be introduced
3. `npm run test` — all tests must pass (including Playwright E2E tests)
4. `npm run build` — build must complete without errors

## Architecture

- **Frontend**: React + TypeScript + TailwindCSS (`src/client/`)
- **Backend**: Node.js + Apollo Server (GraphQL) (`src/server/`)
- **Storage**: VTODO `.ics` files in `data/`
- **Build tool**: Vite

## UI Guidelines

Tasks should always be referred to as 'tasks' for the UI, even though the UI elements may in some cases be visually depicted as 'cards' on a Kanban-style board.

## VTODO Storage Format

Each card is a `.ics` file. Custom properties:

- `X-QUIKAN-COLUMN` — which column the card belongs to (e.g. `todo`, `in-progress`). Not written for cards in the `done` column.
- `X-QUIKAN-RECURRENCE-ID` — links a completed clone back to the master recurring task's UID. Written by Quikan when completing a recurring task; not present in tasks completed by external tools.

Standard properties used: `SUMMARY`, `UID`, `CREATED`, `LAST-MODIFIED`, `STATUS` (`COMPLETED` for done cards, `NEEDS-ACTION` otherwise), `DUE`.

## Recurring Task Model

Quikan uses a **standalone clone** model for recurring tasks, designed to be compatible with vdirsyncer, todoman, and Apple iOS:

- Each task is stored in its own `.ics` file with a unique `UID`.
- When completing a recurring task, Quikan creates a **new standalone `.ics` file** with a **new UID**, `STATUS=COMPLETED`, and `X-QUIKAN-RECURRENCE-ID` pointing to the master task's `UID`. The master advances to its next occurrence.
- The RFC 5545 `RECURRENCE-ID` property is **never written** by Quikan.
- Tasks completed by external tools (todoman, iOS) work as-is — they will be plain completed cards without `X-QUIKAN-RECURRENCE-ID`.

### Validation / Safety Guard

Quikan will **refuse to load** and display a full-page error if any `.ics` file in the data directory:

- Contains a `RECURRENCE-ID` property (old RFC 5545 parent/child format — incompatible with the current model)
- Contains more than one `VCALENDAR` or `VTODO` component

If you have `.ics` files with `RECURRENCE-ID` from a previous version or an external tool, remove or migrate them before Quikan will load.

## Todo Virtual Columns

The `todo` column is split into dynamic virtual sub-columns at the GraphQL/query layer based on each card's due date **and the current day of the week**. Storage always uses `column: 'todo'`. The `Card.column` GraphQL field and the `columns` query return virtual IDs.

All possible virtual column IDs:

| ID | Name | When shown |
| --- | --- | --- |
| `todo-today` | Todo (Today) | Always |
| `todo-tomorrow` | Todo (Tomorrow) | Always |
| `todo-this-week` | Todo (This Week) | Mon–Wed only |
| `todo-this-weekend` | Todo (This Weekend) | Always |
| `todo-next-week` | Todo (Next Week) | Mon–Fri |
| `todo-coming-week` | Coming Week | Sat–Sun only |
| `todo-next-weekend` | Next Weekend | Sat–Sun only |
| `todo-following-week` | Following Week | Sat–Sun only |
| `todo-future` | Todo (Future) | Always |
| `todo` | Todo (No Due Date) | Always |

### Card assignment rules

- ≤ today → `todo-today`
- tomorrow (calendar day+1) → `todo-tomorrow` (takes priority over all group columns)
- Mon–Wed: thisWeekFriday → `todo-this-week`; thisSat–Sun → `todo-this-weekend`; nextMon–nextFri → `todo-next-week`; beyond → `todo-future`
- Thu–Fri: thisSat–thisSun → `todo-this-weekend`; nextMon–nextFri → `todo-next-week`; beyond → `todo-future`
- Sat–Sun: thisSunday is always Tomorrow, so `todo-this-weekend` is always empty; nextMon–nextFri → `todo-coming-week`; nextSat–nextSun → `todo-next-weekend`; nextNextMon–nextNextFri → `todo-following-week`; beyond → `todo-future`

### Drag behaviour

Dragging a card to a virtual todo column updates its due date. Dragging to `todo-this-weekend` on Saturday or Sunday is a no-op (the weekend is already covered by Today/Tomorrow). Dragging to `todo` removes the due date. The card's STATUS never changes during within-todo moves.

### Time-boundary crossing

When the day changes while the board is open, the board re-renders with the new column layout the next time any mutation (create/update/move/delete) is performed — the server always calls `buildColumns(getNow())` and returns the fresh column set to the client.

### Testing fake time

Two GraphQL mutations support deterministic time-based testing:

- `setTestNow(iso: String!): [Column!]!` — sets the server's fake clock and returns new columns
- `clearTestNow: [Column!]!` — resets to real clock

These are available in all environments. E2E tests use them via `request.post('/graphql', ...)`. The `resetData(now)` helper accepts an optional `now: Date` parameter so seeds can be computed relative to the same fake date.

## GraphQL API

Available at `/graphql`. In development, GraphQL Playground is enabled.

Example queries:

```graphql
query {
  columns {
    id
    name
    cards { id summary column sequence }
  }
}
```

```graphql
mutation {
  createCard(summary: "New task", column: "todo") {
    id
    summary
  }
}
```

## npm Scripts

| Command              | Description                                     |
| -------------------- | ----------------------------------------------- |
| `npm run dev`        | Start dev servers (backend + frontend with HMR) |
| `npm run build`      | Build client and server for production          |
| `npm start`          | Start production server                         |
| `npm test`           | Run Jest unit tests                             |
| `npm run test:e2e`   | Run Playwright E2E tests                        |
| `npm run lint`       | Lint code                                       |
| `npm run format`     | Format code with Prettier                       |

## Development Tips

- When an AI agent is working, it may discover that the developer has left the server running (`npm run dev`) in another process. It's OK to kill that if needed.

## TypeScript Config

Three tsconfig files:

- `tsconfig.json` — base / client
- `tsconfig.node.json` — Vite config
- `tsconfig.server.json` — server-side code
