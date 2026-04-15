import { gql } from '@apollo/client';

const COLUMN_FIELDS = gql`
  fragment ColumnFields on Column {
    id
    name
    hiddenCount
    cards {
      id
      uid
      summary
      description
      column
      priority
      due
      dueHasTime
      isRecurring
      isRecurringChild
      quikanRecurrenceId
      rrule
      rruleText
      rruleSupported
      rdates
      exdates
      completed
      created
      modified
    }
  }
`;

export const GET_COLUMNS = gql`
  ${COLUMN_FIELDS}
  query GetColumns {
    columns {
      ...ColumnFields
    }
  }
`;

export const CREATE_CARD = gql`
  ${COLUMN_FIELDS}
  mutation CreateCard(
    $summary: String!
    $column: String!
    $due: String
    $priority: Int
    $description: String
    $rrule: String
    $rdates: [String!]
    $exdates: [String!]
  ) {
    createCard(
      summary: $summary
      column: $column
      due: $due
      priority: $priority
      description: $description
      rrule: $rrule
      rdates: $rdates
      exdates: $exdates
    ) {
      ...ColumnFields
    }
  }
`;

export const MOVE_CARD = gql`
  ${COLUMN_FIELDS}
  mutation MoveCard($id: ID!, $targetColumn: String!) {
    moveCard(id: $id, targetColumn: $targetColumn) {
      ...ColumnFields
    }
  }
`;

export const UPDATE_CARD = gql`
  ${COLUMN_FIELDS}
  mutation UpdateCard(
    $id: ID!
    $summary: String
    $column: String
    $due: String
    $priority: Int
    $description: String
    $rrule: String
    $rdates: [String!]
    $exdates: [String!]
  ) {
    updateCard(
      id: $id
      summary: $summary
      column: $column
      due: $due
      priority: $priority
      description: $description
      rrule: $rrule
      rdates: $rdates
      exdates: $exdates
    ) {
      ...ColumnFields
    }
  }
`;

export const DELETE_CARD = gql`
  ${COLUMN_FIELDS}
  mutation DeleteCard($id: ID!) {
    deleteCard(id: $id) {
      ...ColumnFields
    }
  }
`;

export const GET_CARD_CLONES = gql`
  query GetCardClones($id: ID!) {
    cardClones(id: $id) {
      id
      summary
      quikanRecurrenceId
      column
    }
  }
`;

export const GET_CARD_PARENT = gql`
  query GetCardParent($id: ID!) {
    cardParent(id: $id) {
      id
      summary
      rrule
    }
  }
`;

export const GET_VERSION = gql`
  query GetVersion {
    version
  }
`;
