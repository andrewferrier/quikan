import React, { useEffect, useState } from 'react';
import { useLazyQuery } from '@apollo/client/react';
import { GET_CARD_CHILDREN, GET_CARD_PARENT } from '../gql/queries';

// ─── RRULE helpers ───────────────────────────────────────────────────────────

interface RRuleState {
  freq: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  interval: number;
  weekdays: string[];
  monthMode: 'day' | 'weekday';
  monthDay: number;
  monthOrdinal: string;
  monthWeekday: string;
  yearMonth: number;
  yearMode: 'day' | 'weekday';
  yearDay: number;
  yearOrdinal: string;
  yearWeekday: string;
  endsType: 'never' | 'count' | 'until';
  count: number;
  until: string;
}

function defaultRRuleState(): RRuleState {
  return {
    freq: 'WEEKLY',
    interval: 1,
    weekdays: [],
    monthMode: 'day',
    monthDay: 1,
    monthOrdinal: '1',
    monthWeekday: 'MO',
    yearMonth: 1,
    yearMode: 'day',
    yearDay: 1,
    yearOrdinal: '1',
    yearWeekday: 'MO',
    endsType: 'never',
    count: 10,
    until: '',
  };
}

function parseRRuleStr(rrule: string): RRuleState {
  const state = defaultRRuleState();
  const parts: Record<string, string> = {};
  rrule.split(';').forEach((p) => {
    const eq = p.indexOf('=');
    if (eq >= 0) parts[p.slice(0, eq)] = p.slice(eq + 1);
  });

  if (parts.FREQ) state.freq = parts.FREQ as RRuleState['freq'];
  if (parts.INTERVAL) state.interval = parseInt(parts.INTERVAL, 10) || 1;
  if (parts.COUNT) { state.endsType = 'count'; state.count = parseInt(parts.COUNT, 10) || 1; }
  if (parts.UNTIL) {
    state.endsType = 'until';
    const u = parts.UNTIL.replace(/T.*$/, '');
    state.until = `${u.slice(0, 4)}-${u.slice(4, 6)}-${u.slice(6, 8)}`;
  }

  if (state.freq === 'WEEKLY' && parts.BYDAY) {
    state.weekdays = parts.BYDAY.split(',').filter(Boolean);
  }

  if (state.freq === 'MONTHLY') {
    if (parts.BYMONTHDAY) {
      state.monthMode = 'day';
      state.monthDay = parseInt(parts.BYMONTHDAY, 10) || 1;
    } else if (parts.BYSETPOS && parts.BYDAY) {
      state.monthMode = 'weekday';
      state.monthOrdinal = parts.BYSETPOS;
      state.monthWeekday = parts.BYDAY;
    } else if (parts.BYDAY) {
      state.monthMode = 'weekday';
      const m = parts.BYDAY.match(/^(-?\d+)([A-Z]{2})$/);
      if (m) { state.monthOrdinal = m[1]; state.monthWeekday = m[2]; }
    }
  }

  if (state.freq === 'YEARLY') {
    if (parts.BYMONTH) state.yearMonth = parseInt(parts.BYMONTH, 10) || 1;
    if (parts.BYMONTHDAY) {
      state.yearMode = 'day';
      state.yearDay = parseInt(parts.BYMONTHDAY, 10) || 1;
    } else if (parts.BYSETPOS && parts.BYDAY) {
      state.yearMode = 'weekday';
      state.yearOrdinal = parts.BYSETPOS;
      state.yearWeekday = parts.BYDAY;
    } else if (parts.BYDAY) {
      state.yearMode = 'weekday';
      const m = parts.BYDAY.match(/^(-?\d+)([A-Z]{2})$/);
      if (m) { state.yearOrdinal = m[1]; state.yearWeekday = m[2]; }
    }
  }

  return state;
}

function buildRRuleStr(state: RRuleState): string {
  const parts: string[] = [`FREQ=${state.freq}`];
  if (state.interval > 1) parts.push(`INTERVAL=${state.interval}`);

  if (state.freq === 'WEEKLY' && state.weekdays.length > 0) {
    parts.push(`BYDAY=${state.weekdays.join(',')}`);
  }
  if (state.freq === 'MONTHLY') {
    if (state.monthMode === 'day') {
      parts.push(`BYMONTHDAY=${state.monthDay}`);
    } else {
      parts.push(`BYDAY=${state.monthOrdinal}${state.monthWeekday}`);
    }
  }
  if (state.freq === 'YEARLY') {
    if (state.yearMonth) parts.push(`BYMONTH=${state.yearMonth}`);
    if (state.yearMode === 'day') {
      parts.push(`BYMONTHDAY=${state.yearDay}`);
    } else {
      parts.push(`BYDAY=${state.yearOrdinal}${state.yearWeekday}`);
    }
  }

  if (state.endsType === 'count' && state.count > 0) {
    parts.push(`COUNT=${state.count}`);
  } else if (state.endsType === 'until' && state.until) {
    parts.push(`UNTIL=${state.until.replace(/-/g, '')}`);
  }

  return parts.join(';');
}

// ─── Constants ───────────────────────────────────────────────────────────────

const WEEKDAYS = [
  { key: 'MO', label: 'M' },
  { key: 'TU', label: 'T' },
  { key: 'WE', label: 'W' },
  { key: 'TH', label: 'T' },
  { key: 'FR', label: 'F' },
  { key: 'SA', label: 'S' },
  { key: 'SU', label: 'S' },
];

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const ORDINALS = [
  { value: '1', label: '1st' },
  { value: '2', label: '2nd' },
  { value: '3', label: '3rd' },
  { value: '4', label: '4th' },
  { value: '-1', label: 'Last' },
];

const FREQ_LABELS: Record<string, string> = {
  DAILY: 'day(s)',
  WEEKLY: 'week(s)',
  MONTHLY: 'month(s)',
  YEARLY: 'year(s)',
};

// Virtual todo sub-column IDs — map to 'todo' in the column dropdown
const VIRTUAL_TODO_COL_IDS = new Set(['todo-today', 'todo-tomorrow', 'todo-this-week', 'todo-dated']);

// ─── CardDialog types ─────────────────────────────────────────────────────────

interface CardDialogValues {
  summary: string;
  column: string;
  description?: string;
  priority?: number | null;
  due?: string;
  dueHasTime?: boolean;
  rrule?: string;
  rruleSupported?: boolean;
  rdates?: string[];
  exdates?: string[];
  isRecurringChild?: boolean;
  recurrenceId?: string;
}

interface CardDialogProps {
  isOpen: boolean;
  title: string;
  submitLabel: string;
  cardId?: string;
  initialValues?: CardDialogValues;
  onClose: () => void;
  onSubmit: (values: { summary: string; column: string; description?: string; due?: string; priority?: number; rrule?: string; rdates?: string[]; exdates?: string[] }) => void;
  onOpenCard?: (id: string) => void;
}

// ─── Helper functions ─────────────────────────────────────────────────────────

function todayStr(): string {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

function utcToLocal(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  const date = [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return { date, time };
}

function priorityToSelect(priority: number | null | undefined): string {
  if (!priority) return '';
  if (priority >= 7) return 'high';
  if (priority >= 4) return 'medium';
  return 'low';
}

function selectToPriority(value: string): number | undefined {
  if (value === 'high') return 8;
  if (value === 'medium') return 5;
  if (value === 'low') return 2;
  return undefined;
}

function formatRecurrenceId(recurrenceId: string): string {
  try {
    const d = new Date(recurrenceId);
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return recurrenceId;
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const inputClass = 'w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500';
const smallSelectClass = 'px-2 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500';
const smallInputClass = 'w-16 px-2 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500';
const labelClass = 'block text-sm font-medium text-gray-700 mb-1';

function DateListEditor({ label, dates, onChange }: { label: string; dates: string[]; onChange: (d: string[]) => void }) {
  return (
    <div className="mb-3">
      <span className="block text-xs font-medium text-gray-600 mb-1">{label}</span>
      <div className="flex flex-col gap-1">
        {dates.map((d, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type="date"
              value={d}
              onChange={(e) => {
                const next = [...dates];
                next[i] = e.target.value;
                onChange(next);
              }}
              className="px-2 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={() => onChange(dates.filter((_, j) => j !== i))}
              className="text-gray-400 hover:text-red-500 text-sm"
              aria-label="Remove date"
            >
              ×
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => onChange([...dates, todayStr()])}
          className="text-xs text-blue-600 hover:text-blue-800 text-left w-fit"
        >
          + Add date
        </button>
      </div>
    </div>
  );
}

// ─── CardDialog component ─────────────────────────────────────────────────────

const CardDialog: React.FC<CardDialogProps> = ({
  isOpen,
  title,
  submitLabel,
  cardId,
  initialValues,
  onClose,
  onSubmit,
  onOpenCard,
}) => {
  const [summary, setSummary] = useState('');
  const [description, setDescription] = useState('');
  const [column, setColumn] = useState('todo');
  const [prioritySelect, setPrioritySelect] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('');
  const [includeTime, setIncludeTime] = useState(false);

  const [isRecurring, setIsRecurring] = useState(false);
  const [rruleState, setRRuleState] = useState<RRuleState>(defaultRRuleState());
  const [rdates, setRdates] = useState<string[]>([]);
  const [exdates, setExdates] = useState<string[]>([]);

  const isChild = initialValues?.isRecurringChild ?? false;
  const rruleSupported = initialValues?.rruleSupported;
  const hasUnsupportedRRule = isRecurring && rruleSupported === false;

  const [loadChildren, { data: childrenData }] = useLazyQuery<{ cardChildren: { id: string; summary: string; recurrenceId: string; column: string }[] }>(GET_CARD_CHILDREN);
  const [loadParent, { data: parentData }] = useLazyQuery<{ cardParent: { id: string; summary: string; rrule: string } | null }>(GET_CARD_PARENT);

  useEffect(() => {
    if (!isOpen) return;
    if (initialValues) {
      setSummary(initialValues.summary);
      setDescription(initialValues.description ?? '');
      setColumn(VIRTUAL_TODO_COL_IDS.has(initialValues.column) ? 'todo' : initialValues.column);
      setPrioritySelect(priorityToSelect(initialValues.priority));
      if (initialValues.due) {
        if (initialValues.dueHasTime) {
          const { date, time } = utcToLocal(initialValues.due);
          if (time === '00:00') {
            setDueDate(date); setDueTime(''); setIncludeTime(false);
          } else {
            setDueDate(date); setDueTime(time); setIncludeTime(true);
          }
        } else {
          setDueDate(initialValues.due); setDueTime(''); setIncludeTime(false);
        }
      } else {
        setDueDate(''); setDueTime(''); setIncludeTime(false);
      }

      if (initialValues.rrule) {
        setIsRecurring(true);
        setRRuleState(parseRRuleStr(initialValues.rrule));
      } else {
        setIsRecurring(false);
        setRRuleState(defaultRRuleState());
      }
      setRdates(initialValues.rdates ?? []);
      setExdates(initialValues.exdates ?? []);
    } else {
      setSummary(''); setDescription(''); setColumn('todo'); setPrioritySelect('');
      setDueDate(todayStr()); setDueTime(''); setIncludeTime(false);
      setIsRecurring(false); setRRuleState(defaultRRuleState());
      setRdates([]); setExdates([]);
    }
  }, [isOpen, initialValues]);

  useEffect(() => {
    if (!isOpen || !cardId) return;
    if (initialValues?.rrule) loadChildren({ variables: { id: cardId } });
    if (initialValues?.isRecurringChild) loadParent({ variables: { id: cardId } });
  }, [isOpen, cardId, initialValues?.rrule, initialValues?.isRecurringChild]);

  if (!isOpen) return null;

  const updateRRule = (patch: Partial<RRuleState>) =>
    setRRuleState((s) => ({ ...s, ...patch }));

  const toggleWeekday = (key: string) =>
    updateRRule({
      weekdays: rruleState.weekdays.includes(key)
        ? rruleState.weekdays.filter((w) => w !== key)
        : [...rruleState.weekdays, key],
    });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!summary.trim()) return;

    let due: string | undefined;
    if (dueDate) {
      due = includeTime && dueTime ? new Date(`${dueDate}T${dueTime}`).toISOString() : dueDate;
    }

    let rrule: string | undefined;
    if (isChild) {
      rrule = undefined;
    } else if (hasUnsupportedRRule && initialValues?.rrule) {
      rrule = initialValues.rrule;
    } else if (isRecurring) {
      rrule = buildRRuleStr(rruleState);
    }

    onSubmit({
      summary: summary.trim(),
      description: description || undefined,
      column,
      due,
      priority: selectToPriority(prioritySelect),
      rrule,
      rdates: isChild ? undefined : rdates,
      exdates: isChild ? undefined : exdates,
    });
    onClose();
  };

  const children = childrenData?.cardChildren ?? [];
  const parent = parentData?.cardParent ?? null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-[520px] max-w-[95%] max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-semibold mb-4">{title}</h2>
        <form onSubmit={handleSubmit}>

          {/* Summary */}
          <div className="mb-4">
            <label htmlFor="cd-summary" className={labelClass}>Title</label>
            <input
              type="text"
              id="cd-summary"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              className={inputClass}
              placeholder="Card title…"
              autoFocus
            />
          </div>

          {/* Description */}
          <div className="mb-4">
            <label htmlFor="cd-description" className={labelClass}>Description</label>
            <textarea
              id="cd-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={`${inputClass} resize-y`}
              placeholder="Optional description…"
              rows={5}
            />
          </div>

          {/* Column */}
          <div className="mb-4">
            <label htmlFor="cd-column" className={labelClass}>Column</label>
            <select id="cd-column" value={column} onChange={(e) => setColumn(e.target.value)} className={inputClass}>
              <option value="todo">To Do</option>
              <option value="in-progress">In Progress</option>
              <option value="done">Done</option>
            </select>
          </div>

          {/* Priority */}
          <div className="mb-4">
            <span className="block text-sm font-medium text-gray-700 mb-2">Priority</span>
            <div className="flex gap-2">
              {(
                [
                  { value: '', label: 'None', base: 'border-gray-300 text-gray-500', active: 'bg-gray-600 border-gray-600 text-white' },
                  { value: 'low', label: 'Low', base: 'border-blue-300 text-blue-600', active: 'bg-blue-600 border-blue-600 text-white' },
                  { value: 'medium', label: 'Medium', base: 'border-yellow-400 text-yellow-700', active: 'bg-yellow-500 border-yellow-500 text-white' },
                  { value: 'high', label: 'High', base: 'border-red-300 text-red-600', active: 'bg-red-600 border-red-600 text-white' },
                ] as const
              ).map(({ value, label, base, active }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setPrioritySelect(value)}
                  className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors ${prioritySelect === value ? `${active} ring-2 ring-offset-1 ring-current` : `bg-white ${base} hover:bg-gray-50`}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Due date */}
          <div className="mb-4">
            <label htmlFor="cd-due-date" className={labelClass}>Due date</label>
            <input
              type="date"
              id="cd-due-date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className={inputClass}
            />
          </div>

          {dueDate && (
            <div className="mb-4">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeTime}
                  onChange={(e) => {
                    setIncludeTime(e.target.checked);
                    setDueTime(e.target.checked ? '12:00' : '');
                  }}
                  className="rounded"
                />
                Time
              </label>
              {includeTime && (
                <div className="mt-2 space-y-2">
                  <input
                    type="time"
                    value={dueTime}
                    onChange={(e) => setDueTime(e.target.value)}
                    className={inputClass}
                  />
                  <div className="flex gap-2">
                    {['12:00', '18:00', '20:00'].map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setDueTime(t)}
                        className={`px-3 py-1 text-sm rounded-md border transition-colors ${
                          dueTime === t
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Recurrence section (not shown for child cards) */}
          {!isChild && (
            <div className="mb-4 border border-gray-200 rounded-md p-4">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer select-none mb-3">
                <input
                  type="checkbox"
                  checked={isRecurring}
                  onChange={(e) => setIsRecurring(e.target.checked)}
                  className="rounded"
                  disabled={hasUnsupportedRRule}
                />
                Recurring task
              </label>

              {hasUnsupportedRRule && (
                <div className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded-md text-sm text-yellow-800">
                  <p className="font-medium mb-1">⚠ Advanced recurrence rule</p>
                  <p className="text-xs text-yellow-700 mb-1">This rule uses features not editable in Quikan. It will be preserved as-is.</p>
                  <code className="text-xs font-mono break-all">{initialValues?.rrule}</code>
                </div>
              )}

              {isRecurring && !hasUnsupportedRRule && (
                <>
                  {/* Frequency + interval */}
                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    <span className="text-sm text-gray-600">Every</span>
                    <input
                      type="number"
                      min={1}
                      value={rruleState.interval}
                      onChange={(e) => updateRRule({ interval: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                      className={smallInputClass}
                    />
                    <select
                      value={rruleState.freq}
                      onChange={(e) => updateRRule({ freq: e.target.value as RRuleState['freq'] })}
                      className={smallSelectClass}
                    >
                      <option value="DAILY">day(s)</option>
                      <option value="WEEKLY">week(s)</option>
                      <option value="MONTHLY">month(s)</option>
                      <option value="YEARLY">year(s)</option>
                    </select>
                    <span className="sr-only">{FREQ_LABELS[rruleState.freq]}</span>
                  </div>

                  {/* Weekly: day-of-week checkboxes */}
                  {rruleState.freq === 'WEEKLY' && (
                    <div className="mb-3">
                      <span className="text-sm text-gray-600 mb-1 block">On</span>
                      <div className="flex gap-1">
                        {WEEKDAYS.map(({ key, label }) => (
                          <button
                            key={key}
                            type="button"
                            onClick={() => toggleWeekday(key)}
                            className={`w-8 h-8 rounded-full text-xs font-medium border transition-colors ${rruleState.weekdays.includes(key) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Monthly: day or weekday */}
                  {rruleState.freq === 'MONTHLY' && (
                    <div className="mb-3 space-y-2">
                      <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                        <input type="radio" checked={rruleState.monthMode === 'day'} onChange={() => updateRRule({ monthMode: 'day' })} />
                        <span>On day</span>
                        <input
                          type="number"
                          min={1} max={31}
                          value={rruleState.monthDay}
                          onChange={(e) => updateRRule({ monthDay: Math.min(31, Math.max(1, parseInt(e.target.value, 10) || 1)) })}
                          className={smallInputClass}
                          disabled={rruleState.monthMode !== 'day'}
                        />
                      </label>
                      <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                        <input type="radio" checked={rruleState.monthMode === 'weekday'} onChange={() => updateRRule({ monthMode: 'weekday' })} />
                        <span>On the</span>
                        <select
                          value={rruleState.monthOrdinal}
                          onChange={(e) => updateRRule({ monthOrdinal: e.target.value })}
                          className={smallSelectClass}
                          disabled={rruleState.monthMode !== 'weekday'}
                        >
                          {ORDINALS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                        <select
                          value={rruleState.monthWeekday}
                          onChange={(e) => updateRRule({ monthWeekday: e.target.value })}
                          className={smallSelectClass}
                          disabled={rruleState.monthMode !== 'weekday'}
                        >
                          {WEEKDAYS.map((w) => <option key={w.key} value={w.key}>{w.key}</option>)}
                        </select>
                      </label>
                    </div>
                  )}

                  {/* Yearly: month + day or weekday */}
                  {rruleState.freq === 'YEARLY' && (
                    <div className="mb-3 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm text-gray-600">In</span>
                        <select
                          value={rruleState.yearMonth}
                          onChange={(e) => updateRRule({ yearMonth: parseInt(e.target.value, 10) })}
                          className={smallSelectClass}
                        >
                          {MONTH_NAMES.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                        </select>
                      </div>
                      <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                        <input type="radio" checked={rruleState.yearMode === 'day'} onChange={() => updateRRule({ yearMode: 'day' })} />
                        <span>On day</span>
                        <input
                          type="number"
                          min={1} max={31}
                          value={rruleState.yearDay}
                          onChange={(e) => updateRRule({ yearDay: Math.min(31, Math.max(1, parseInt(e.target.value, 10) || 1)) })}
                          className={smallInputClass}
                          disabled={rruleState.yearMode !== 'day'}
                        />
                      </label>
                      <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                        <input type="radio" checked={rruleState.yearMode === 'weekday'} onChange={() => updateRRule({ yearMode: 'weekday' })} />
                        <span>On the</span>
                        <select
                          value={rruleState.yearOrdinal}
                          onChange={(e) => updateRRule({ yearOrdinal: e.target.value })}
                          className={smallSelectClass}
                          disabled={rruleState.yearMode !== 'weekday'}
                        >
                          {ORDINALS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                        <select
                          value={rruleState.yearWeekday}
                          onChange={(e) => updateRRule({ yearWeekday: e.target.value })}
                          className={smallSelectClass}
                          disabled={rruleState.yearMode !== 'weekday'}
                        >
                          {WEEKDAYS.map((w) => <option key={w.key} value={w.key}>{w.key}</option>)}
                        </select>
                      </label>
                    </div>
                  )}

                  {/* Ends */}
                  <div className="mb-3 space-y-2">
                    <span className="text-sm text-gray-600 block">Ends</span>
                    {(['never', 'count', 'until'] as const).map((type) => (
                      <label key={type} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                        <input type="radio" checked={rruleState.endsType === type} onChange={() => updateRRule({ endsType: type })} />
                        {type === 'never' && 'Never'}
                        {type === 'count' && (
                          <>
                            After
                            <input
                              type="number"
                              min={1}
                              value={rruleState.count}
                              onChange={(e) => updateRRule({ count: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                              className={smallInputClass}
                              disabled={rruleState.endsType !== 'count'}
                            />
                            occurrences
                          </>
                        )}
                        {type === 'until' && (
                          <>
                            On
                            <input
                              type="date"
                              value={rruleState.until}
                              onChange={(e) => updateRRule({ until: e.target.value })}
                              className="px-2 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                              disabled={rruleState.endsType !== 'until'}
                            />
                          </>
                        )}
                      </label>
                    ))}
                  </div>

                  {/* RDates / EXDates */}
                  <div className="border-t border-gray-100 pt-3 mt-3">
                    <DateListEditor label="Additional dates (RDATEs)" dates={rdates} onChange={setRdates} />
                    <DateListEditor label="Excluded dates (EXDATEs)" dates={exdates} onChange={setExdates} />
                  </div>
                </>
              )}
            </div>
          )}

          {/* Parent/child links (edit mode only) */}
          {cardId && (isChild || children.length > 0) && (
            <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-md text-sm">
              {isChild ? (
                <>
                  <p className="text-gray-500 text-xs font-medium mb-1">🔄 Instance of recurring series</p>
                  {initialValues?.recurrenceId && (
                    <p className="text-gray-600 text-xs mb-2">Override for: {formatRecurrenceId(initialValues.recurrenceId)}</p>
                  )}
                  {parent && (
                    <button
                      type="button"
                      onClick={() => onOpenCard?.(parent.id)}
                      className="text-blue-600 hover:text-blue-800 text-xs underline"
                    >
                      → Open master: "{parent.summary}"
                    </button>
                  )}
                </>
              ) : (
                <>
                  <p className="text-gray-500 text-xs font-medium mb-2">🔄 {children.length} instance override{children.length !== 1 ? 's' : ''}</p>
                  <div className="flex flex-wrap gap-1">
                    {children.map((child) => (
                      <button
                        key={child.id}
                        type="button"
                        onClick={() => onOpenCard?.(child.id)}
                        className="px-2 py-0.5 bg-gray-200 hover:bg-gray-300 rounded text-xs text-gray-700 transition-colors"
                      >
                        {child.recurrenceId ? formatRecurrenceId(child.recurrenceId) : child.summary}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {cardId && (
            <p className="mt-5 text-xs font-mono text-gray-300 select-all">{cardId}.ics</p>
          )}

          <div className="flex justify-end gap-2 mt-3">
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
              {submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CardDialog;

