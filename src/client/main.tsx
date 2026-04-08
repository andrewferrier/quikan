import React from 'react';
import ReactDOM from 'react-dom/client';
import { ApolloClient, InMemoryCache } from '@apollo/client';
import { HttpLink } from '@apollo/client/link/http';
import { ApolloProvider } from '@apollo/client/react';
import App from './App';
import './index.css';

const client = new ApolloClient({
  link: new HttpLink({ uri: '/graphql' }),
  cache: new InMemoryCache(),
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ApolloProvider client={client}>
      <App />
    </ApolloProvider>
  </React.StrictMode>
);
