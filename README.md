# Quikan

A web-based Kanban board that uses VTODO (iCalendar) files as a backend.

## Features

- **VTODO Backend**: Each card is stored as a separate .ics file using the VTODO format
- **Drag & Drop**: Intuitive drag and drop interface to move cards between columns
- **GraphQL API**: Apollo Server-based GraphQL API for efficient data fetching
- **Modern Frontend**: React with TypeScript and TailwindCSS
- **Dockerized**: Ready to deploy with Docker and docker-compose

## Quick Start

### Using Docker

1. Clone the repository:

```bash
git clone https://github.com/andrewferrier/quikan.git
cd quikan
```

2. Start with docker-compose:

```bash
docker-compose up
```

3. Open your browser at `http://localhost:4000`

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

2. Install dependencies:

```bash
npm install
```

3. Start the development server:

```bash
npm run dev
```

This will start both the backend server and the frontend development server. The application will be available at `http://localhost:5173` (frontend dev server will proxy GraphQL requests to the backend).

## Configuration

| Variable | Default | Description |
|---|---|---|
| `QUIKAN_DATA` | `data/` (next to the server) | Path to the directory where `.ics` card files are stored |
| `PORT` | `4000` | Port the server listens on |

## Author

Andrew Ferrier
