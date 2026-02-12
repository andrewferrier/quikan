# Quikan

A web-based Kanban board that uses VTODO (iCalendar) files as a backend.

## Features

- **VTODO Backend**: Each card is stored as a separate .ics file using the VTODO format
- **Drag & Drop**: Intuitive drag and drop interface to move cards between columns
- **GraphQL API**: Apollo Server-based GraphQL API for efficient data fetching
- **Modern Frontend**: React with TypeScript and TailwindCSS
- **Dockerized**: Ready to deploy with Docker and docker-compose

## Quick Start

### Using Docker (Recommended)

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

## Scripts

- `npm run dev` - Start development servers (backend + frontend)
- `npm run build` - Build both client and server for production
- `npm start` - Start production server
- `npm test` - Run tests
- `npm run lint` - Lint code
- `npm run format` - Format code with Prettier

## Project Structure

```
quikan/
├── src/
│   ├── client/          # React frontend
│   │   ├── components/  # React components
│   │   ├── graphql/     # GraphQL queries and mutations
│   │   └── App.tsx      # Main app component
│   └── server/          # Node.js backend
│       ├── graphql/     # GraphQL schema and resolvers
│       ├── storage/     # VTODO file handling
│       └── index.ts     # Server entry point
├── data/                # VTODO files storage (mounted as volume in Docker)
├── Dockerfile           # Docker build configuration
└── docker-compose.yml   # Docker compose configuration
```

## VTODO Format

Each card is stored as a VTODO in an .ics file with the following custom properties:

- `X-QUIKAN-COLUMN`: The column the card belongs to (e.g., "todo", "in-progress", "done")
- `X-QUIKAN-SEQUENCE`: The position of the card within its column

Standard VTODO properties used:
- `SUMMARY`: Card title
- `UID`: Unique identifier
- `CREATED`: Creation timestamp
- `LAST-MODIFIED`: Last modification timestamp

## API

The application exposes a GraphQL API at `/graphql`. You can explore it using GraphQL Playground when running in development mode.

### Example Queries

Get all columns with cards:
```graphql
query {
  columns {
    id
    name
    cards {
      id
      summary
      column
      sequence
    }
  }
}
```

Create a new card:
```graphql
mutation {
  createCard(summary: "New task", column: "todo") {
    id
    summary
  }
}
```

## Docker Volume

The `/app/data` directory in the Docker container is exposed as a volume. This is where VTODO files are stored. You can mount your own directory to persist data:

```bash
docker run -v /path/to/your/data:/app/data -p 4000:4000 quikan
```

## Development

### Running Tests

```bash
npm test
```

### Linting

```bash
npm run lint
```

### Building for Production

```bash
npm run build
```

## License

MIT - See LICENSE file for details

## Author

Andrew Ferrier
