export const typeDefs = `#graphql
  type Card {
    id: ID!
    summary: String!
    column: String!
    sequence: Int!
    created: String!
    modified: String!
  }

  type Column {
    id: ID!
    name: String!
    cards: [Card!]!
  }

  type Query {
    cards: [Card!]!
    card(id: ID!): Card
    columns: [Column!]!
  }

  type Mutation {
    createCard(summary: String!, column: String!): Card!
    updateCard(id: ID!, summary: String): Card
    moveCard(id: ID!, targetColumn: String!, targetSequence: Int!): Card
    deleteCard(id: ID!): Boolean!
  }
`;
