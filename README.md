# Quikan

A web-based Kanban board that uses VTODO (iCalendar) files as a backend.

## Features

- **VTODO Backend**: Each card is stored as a separate .ics file using the VTODO format
- **Drag & Drop**: Intuitive drag and drop interface to move cards between columns
- **Recurring Tasks**: Supports recurring tasks with full RFC 5545 RRULE syntax
- **GraphQL API**: Apollo Server-based GraphQL API for efficient data fetching
- **Modern Frontend**: React with TypeScript and TailwindCSS
- **Dockerized**: Ready to deploy with Docker and docker-compose
- **vdirsyncer / CalDAV Compatible**: Data directory can be synced with CalDAV servers using tools like vdirsyncer

## Recurring Tasks & Compatibility

Quikan stores recurring tasks using a **standalone clone** model compatible with `vdirsyncer`, `todoman`, and Apple iOS. When you complete a recurring task, Quikan creates an independent completed copy with a new UID and advances the master to its next occurrence - it does not use RFC 5545's `RECURRENCE-ID` parent/child mechanism, which is poorly supported by sync tools.

**Important:** If your data directory contains any `.ics` files with a `RECURRENCE-ID` property (e.g. synced from another app that uses the parent/child model), Quikan will display an error and refuse to load until those files are removed or migrated. Each `.ics` file must also contain exactly one `VTODO` component.

## Quick Start

### Using Docker

1. Clone the repository:

```bash
git clone https://github.com/andrewferrier/quikan.git
cd quikan
```

1. Start with docker-compose:

```bash
docker-compose up
```

1. Open your browser at `http://localhost:4000`

### Local Development

#### Prerequisites

- Node.js 20 or higher
- npm

#### Setup

1. Clone the repository:

```bash
git clone https://github.com/andrewferrier/quikan.git
cd quikan
```

1. Install dependencies:

```bash
npm install
```

1. Start the development server:

```bash
npm run dev
```

This will start both the backend server and the frontend development server. The application will be available at `http://localhost:5173` (frontend dev server will proxy GraphQL requests to the backend).

## Configuration

| Variable      | Default                      | Description                                              |
| ------------- | ---------------------------- | -------------------------------------------------------- |
| `QUIKAN_DATA` | `data/` (next to the server) | Path to the directory where `.ics` card files are stored |
| `PORT`        | `4000`                       | Port the server listens on                               |

## Author

Andrew Ferrier
