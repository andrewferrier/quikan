# Quikan — Development Guide

This file is for AI agents to consume to understand internal details. Whenever an AI agent is making a change to quikan, it should always review this file to see if it can be improved / needs to be updated.

## Coding Conventions

- **Comments**: Only add comments when they provide insight that isn't obvious from the code itself. Never add comments that just label or restate what the code does (e.g., `// Start server` above `app.listen()`). Prefer explaining *why* something is done, or clarifying genuinely non-obvious *what*.

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

Each card is a `.ics` file. Custom property:

- `X-QUIKAN-COLUMN` — which column the card belongs to (e.g. `todo`, `in-progress`). Not written for cards in the `done` column.

Standard properties used: `SUMMARY`, `UID`, `CREATED`, `LAST-MODIFIED`, `STATUS` (`COMPLETED` for done cards, `NEEDS-ACTION` otherwise), `DUE`.

## Todo Virtual Columns

The `todo` column is split into five virtual sub-columns at the GraphQL/query layer based on each card's due date. Storage always uses `column: 'todo'`. The `Card.column` GraphQL field and the `columns` query return virtual IDs:

| ID | Name | Criteria |
| --- | --- | --- |
| `todo-today` | Todo Today | Overdue or due today |
| `todo-tomorrow` | Todo Tomorrow | Due tomorrow |
| `todo-this-week` | Todo This Week | Due within the next 7 days (days 2–6) |
| `todo-dated` | Todo (Dated) | Has a due date ≥ 7 days away |
| `todo` | Todo | No due date |

Dragging a card to a virtual column updates its due date (today, tomorrow, today+2 respectively). Dragging to `todo` removes the due date. Dragging to `todo-dated` is a no-op (requires an explicit date change via the edit dialog). The card's STATUS never changes during within-todo moves.

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

## TypeScript Config

Three tsconfig files:

- `tsconfig.json` — base / client
- `tsconfig.node.json` — Vite config
- `tsconfig.server.json` — server-side code
