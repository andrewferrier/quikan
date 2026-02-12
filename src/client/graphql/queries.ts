import { gql } from '@apollo/client';

export const GET_COLUMNS = gql`
  query GetColumns {
    columns {
      id
      name
      cards {
        id
        summary
        column
        sequence
        created
        modified
      }
    }
  }
`;

export const CREATE_CARD = gql`
  mutation CreateCard($summary: String!, $column: String!) {
    createCard(summary: $summary, column: $column) {
      id
      summary
      column
      sequence
      created
      modified
    }
  }
`;

export const MOVE_CARD = gql`
  mutation MoveCard($id: ID!, $targetColumn: String!, $targetSequence: Int!) {
    moveCard(id: $id, targetColumn: $targetColumn, targetSequence: $targetSequence) {
      id
      summary
      column
      sequence
      modified
    }
  }
`;

export const UPDATE_CARD = gql`
  mutation UpdateCard($id: ID!, $summary: String) {
    updateCard(id: $id, summary: $summary) {
      id
      summary
      modified
    }
  }
`;

export const DELETE_CARD = gql`
  mutation DeleteCard($id: ID!) {
    deleteCard(id: $id)
  }
`;
