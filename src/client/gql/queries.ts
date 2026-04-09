import { gql } from '@apollo/client';

export const GET_COLUMNS = gql`
  query GetColumns {
    columns {
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
  }
`;

export const CREATE_CARD = gql`
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
      id
      summary
      description
      column
      priority
      due
      dueHasTime
      completed
      created
      modified
    }
  }
`;

export const MOVE_CARD = gql`
  mutation MoveCard($id: ID!, $targetColumn: String!) {
    moveCard(id: $id, targetColumn: $targetColumn) {
      id
      summary
      column
      priority
      due
      dueHasTime
      completed
    }
  }
`;

export const UPDATE_CARD = gql`
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
      id
      summary
      description
      column
      priority
      due
      dueHasTime
      completed
      modified
    }
  }
`;

export const DELETE_CARD = gql`
  mutation DeleteCard($id: ID!) {
    deleteCard(id: $id)
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
