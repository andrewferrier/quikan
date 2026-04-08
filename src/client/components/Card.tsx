import React, { useRef } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { formatDue } from '../utils/dueDate';

interface CardProps {
  id: string;
  summary: string;
  description?: string | null;
  column: string;
  priority?: number | null;
  due?: string | null;
  dueHasTime?: boolean | null;
  completed?: string | null;
  isRecurring?: boolean | null;
  isRecurringChild?: boolean | null;
  onClick?: () => void;
}

const DUE_COLOR_CLASS = {
  red: 'text-red-600',
  green: 'text-green-600',
  grey: 'text-gray-400',
} as const;

function priorityBgClass(priority: number | null | undefined): string {
  if (!priority) return 'bg-white';
  if (priority >= 7) return 'bg-red-100';
  if (priority >= 4) return 'bg-yellow-100';
  return 'bg-blue-100';
}

/** Split text into alternating plain/URL segments and render URLs as links. */
function renderWithLinks(text: string): React.ReactNode[] {
  const parts = text.split(/(https?:\/\/[^\s]+)/g);
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <a
        key={i}
        href={part}
        target="_blank"
        rel="noopener noreferrer"
        className="underline text-blue-500 hover:text-blue-700"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        {part}
      </a>
    ) : (
      part
    )
  );
}

const RecurringIcon: React.FC<{ variant?: 'master' | 'child' }> = ({ variant = 'child' }) => (
  <svg
    viewBox="0 0 16 16"
    className={`w-3.5 h-3.5 ${variant === 'master' ? 'text-gray-900' : 'text-gray-400'}`}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-label="Recurring"
  >
    <path d="M13.5 8A5.5 5.5 0 1 1 10 3.2" />
    <polyline points="10 1 10 3.5 12.5 3.5" />
    <path d="M8 5.5V8l2 1" />
  </svg>
);

const Card: React.FC<CardProps> = ({
  id,
  summary,
  description,
  column,
  priority,
  due,
  dueHasTime,
  completed,
  isRecurring,
  isRecurringChild,
  onClick,
}) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id });
  const pointerDownPos = useRef<{ x: number; y: number } | null>(null);

  const style: React.CSSProperties = isDragging ? { visibility: 'hidden' } : {};

  const isDone = column === 'done';
  const displayDateStr = isDone ? (completed ?? null) : (due ?? null);
  const displayHasTime = isDone ? true : (dueHasTime ?? false);
  const rawDisplay = displayDateStr != null ? formatDue(displayDateStr, displayHasTime) : null;
  const dueDisplay = rawDisplay
    ? { text: rawDisplay.text, color: isDone ? ('grey' as const) : rawDisplay.color }
    : null;

  const { onPointerDown: dndPointerDown, ...otherListeners } = (listeners ?? {}) as Record<
    string,
    React.PointerEventHandler
  >;

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    pointerDownPos.current = { x: e.clientX, y: e.clientY };
    dndPointerDown?.(e);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!pointerDownPos.current || !onClick) return;
    const dx = e.clientX - pointerDownPos.current.x;
    const dy = e.clientY - pointerDownPos.current.y;
    if (Math.sqrt(dx * dx + dy * dy) < 8) {
      onClick();
    }
    pointerDownPos.current = null;
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...otherListeners}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      data-testid="card"
      className={`${priorityBgClass(priority)} p-4 rounded-lg shadow-sm border ${dueDisplay?.color === 'red' ? 'border-red-400' : 'border-gray-200'} cursor-pointer hover:shadow-md transition-shadow`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-gray-800" data-testid="card-summary">
          {summary}
        </p>
        {dueDisplay && (
          <span
            className={`text-xs whitespace-nowrap shrink-0 ${DUE_COLOR_CLASS[dueDisplay.color]}`}
          >
            {dueDisplay.text}
          </span>
        )}
      </div>
      {description && (
        <p
          className="text-xs text-gray-400 mt-1 overflow-hidden whitespace-pre-wrap break-words"
          style={{
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {renderWithLinks(description)}
        </p>
      )}
      {isRecurring && (
        <div className="flex justify-end mt-1">
          <RecurringIcon variant={isRecurringChild ? 'child' : 'master'} />
        </div>
      )}
    </div>
  );
};

export default Card;
