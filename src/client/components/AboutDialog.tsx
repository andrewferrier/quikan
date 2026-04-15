import React, { useEffect } from 'react';
import { useQuery } from '@apollo/client/react';
import { GET_VERSION } from '../gql/queries';

interface AboutDialogProps {
  onClose: () => void;
}

const AboutDialog: React.FC<AboutDialogProps> = ({ onClose }) => {
  const { data } = useQuery<{ version: string }>(GET_VERSION);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="About Quikan"
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg p-6 w-96 max-w-[95%]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">About Quikan</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            ✕
          </button>
        </div>
        <p className="text-gray-600 text-sm mb-4">
          Quikan is a web-based Kanban board that uses VTODO{' '}
          <code className="bg-gray-100 px-1 rounded text-xs">.ics</code> files as its backend,
          making it compatible with CalDAV clients and tools like vdirsyncer and todoman.
        </p>
        <p className="text-sm mb-4">
          <a
            href="https://github.com/andrewferrier/quikan"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            github.com/andrewferrier/quikan
          </a>
        </p>
        <p className="text-xs text-gray-400">Version: {data?.version ?? '…'}</p>
      </div>
    </div>
  );
};

export default AboutDialog;
