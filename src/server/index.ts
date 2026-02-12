import express from 'express';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import cors from 'cors';
import bodyParser from 'body-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import { typeDefs } from './graphql/schema.js';
import { resolvers } from './graphql/resolvers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 4000;

async function startServer() {
  const app = express();

  // Create Apollo Server
  const server = new ApolloServer({
    typeDefs,
    resolvers,
  });

  await server.start();

  // Middleware
  app.use(cors());
  app.use(bodyParser.json());

  // GraphQL endpoint
  app.use('/graphql', expressMiddleware(server));

  // Serve static files from the client build
  const clientPath = path.join(__dirname, '../client');
  app.use(express.static(clientPath));

  // Serve index.html for all other routes (SPA)
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientPath, 'index.html'));
  });

  app.listen(PORT, () => {
    console.log(`🚀 Server ready at http://localhost:${PORT}`);
    console.log(`📊 GraphQL endpoint at http://localhost:${PORT}/graphql`);
  });
}

startServer().catch((error) => {
  console.error('Error starting server:', error);
  process.exit(1);
});
