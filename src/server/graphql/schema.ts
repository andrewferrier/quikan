export const typeDefs = `#graphql
  type Card {
    id: ID!
    uid: String!
    summary: String!
    description: String
    column: String!
    priority: Int
    created: String!
    modified: String!
    due: String
    dueHasTime: Boolean
    completed: String
    isRecurring: Boolean
    isRecurringChild: Boolean
    quikanRecurrenceId: String
    rrule: String
    rruleText: String
    rruleSupported: Boolean
    rdates: [String!]!
    exdates: [String!]!
  }

  type Column {
    id: ID!
    name: String!
    cards: [Card!]!
    hiddenCount: Int!
  }

  type Query {
    cards: [Card!]!
    card(id: ID!): Card
    columns: [Column!]!
    cardClones(id: ID!): [Card!]!
    cardParent(id: ID!): Card
    version: String!
  }

  type Mutation {
    createCard(
      summary: String!
      column: String!
      due: String
      priority: Int
      description: String
      rrule: String
      rdates: [String!]
      exdates: [String!]
    ): [Column!]!
    updateCard(
      id: ID!
      summary: String
      column: String
      due: String
      priority: Int
      description: String
      rrule: String
      rdates: [String!]
      exdates: [String!]
    ): [Column!]!
    moveCard(id: ID!, targetColumn: String!): [Column!]!
    deleteCard(id: ID!): [Column!]!
    setTestNow(iso: String!): [Column!]!
    clearTestNow: [Column!]!
  }
`;
