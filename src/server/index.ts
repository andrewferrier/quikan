import express from 'express';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@as-integrations/express5';
import cors from 'cors';
import bodyParser from 'body-parser';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import { typeDefs } from './graphql/schema.js';
import { resolvers } from './graphql/resolvers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 4000;

async function startServer() {
  const app = express();

  const server = new ApolloServer({
    typeDefs,
    resolvers,
  });

  await server.start();

  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.use(cors());
  app.use(bodyParser.json());
  app.use(limiter);

  app.use('/graphql', expressMiddleware(server));

  if (process.env.NODE_ENV === 'production') {
    const clientPath = path.join(__dirname, '../client');
    app.use(express.static(clientPath));

    app.get('/{*path}', (_req, res) => {
      res.sendFile(path.join(clientPath, 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`🚀 Server ready at http://localhost:${PORT}`);
    console.log(`📊 GraphQL endpoint at http://localhost:${PORT}/graphql`);
  });
}

startServer().catch((error) => {
  console.error('Error starting server:', error);
  process.exit(1);
});
