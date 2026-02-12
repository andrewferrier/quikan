import React, { useState } from 'react';

interface AddCardDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (summary: string, column: string) => void;
}

const AddCardDialog: React.FC<AddCardDialogProps> = ({ isOpen, onClose, onSubmit }) => {
  const [summary, setSummary] = useState('');
  const [column, setColumn] = useState('todo');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (summary.trim()) {
      onSubmit(summary, column);
      setSummary('');
      setColumn('todo');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-96 max-w-[90%]">
        <h2 className="text-xl font-semibold mb-4">Add New Card</h2>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="summary" className="block text-sm font-medium text-gray-700 mb-1">
              Card Title
            </label>
            <input
              type="text"
              id="summary"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter card title..."
              autoFocus
            />
          </div>
          <div className="mb-6">
            <label htmlFor="column" className="block text-sm font-medium text-gray-700 mb-1">
              Column
            </label>
            <select
              id="column"
              value={column}
              onChange={(e) => setColumn(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="todo">To Do</option>
              <option value="in-progress">In Progress</option>
              <option value="done">Done</option>
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
            >
              Add Card
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddCardDialog;
