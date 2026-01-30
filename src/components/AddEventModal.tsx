'use client';

import { useState } from 'react';
import { X, Plus, Pencil, Tag, Clock } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { CalendarEvent, BUILT_IN_EVENT_TYPES, BuiltInEventType } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { format, parseISO } from 'date-fns';
import { dateToISOString, formatDateForInput } from '@/lib/date-utils';

interface AddEventModalProps {
  onClose: () => void;
  initialDate?: Date;
  editEvent?: CalendarEvent;
  onManageTypes?: () => void;
}

export function AddEventModal({ onClose, initialDate, editEvent, onManageTypes }: AddEventModalProps) {
  const { state, addEvent, updateEvent } = useApp();
  const [title, setTitle] = useState(editEvent?.title || '');
  const [selectedMemberId, setSelectedMemberId] = useState(editEvent?.memberId || '');
  const [eventType, setEventType] = useState<string>(editEvent?.type || '');
  const [startDate, setStartDate] = useState(
    editEvent ? formatDateForInput(editEvent.startDate) 
    : initialDate ? format(initialDate, 'yyyy-MM-dd') 
    : format(new Date(), 'yyyy-MM-dd')
  );
  const [endDate, setEndDate] = useState(
    editEvent ? formatDateForInput(editEvent.endDate)
    : initialDate ? format(initialDate, 'yyyy-MM-dd') 
    : format(new Date(), 'yyyy-MM-dd')
  );
  const [description, setDescription] = useState(editEvent?.description || '');
  
  // Time fields - extract from existing event if it has time
  const extractTime = (dateStr: string): string => {
    try {
      const date = parseISO(dateStr);
      const hours = date.getHours();
      const mins = date.getMinutes();
      // Only return time if it's not midnight (all-day events are stored as 12:00)
      if (hours !== 12 || mins !== 0) {
        return format(date, 'HH:mm');
      }
    } catch { /* ignore */ }
    return '';
  };
  
  const [showTimeFields, setShowTimeFields] = useState(
    editEvent ? !editEvent.allDay : false
  );
  const [startTime, setStartTime] = useState(
    editEvent && !editEvent.allDay ? extractTime(editEvent.startDate) : ''
  );
  const [endTime, setEndTime] = useState(
    editEvent && !editEvent.allDay ? extractTime(editEvent.endDate) : ''
  );

  const builtInOverrides = state.builtInTypeOverrides || [];

  const getBuiltInDisplay = (id: BuiltInEventType) => {
    const override = builtInOverrides.find(o => o.id === id);
    const defaults = BUILT_IN_EVENT_TYPES[id];
    return {
      name: override?.name || defaults.name,
      color: override?.color || defaults.color,
    };
  };

  const allEventTypes = [
    ...Object.entries(BUILT_IN_EVENT_TYPES)
      .filter(([, type]) => !type.isSystem)
      .map(([id, type]) => {
        const display = getBuiltInDisplay(id as BuiltInEventType);
        return { id, name: display.name, color: display.color, isBuiltIn: true };
      }),
    ...(state.customEventTypes || []).filter(t => !t.isSystem).map((type) => ({
      id: type.id, name: type.name, color: type.color, isBuiltIn: false,
    })),
  ];

  const selectedType = allEventTypes.find((t) => t.id === eventType);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    // Build date strings with optional time
    const buildDateTimeString = (date: string, time: string): string => {
      if (time && showTimeFields) {
        // Create date with specific time
        const [hours, minutes] = time.split(':').map(Number);
        const d = new Date(date + 'T12:00:00');
        d.setHours(hours, minutes, 0, 0);
        return d.toISOString();
      }
      return dateToISOString(date);
    };

    const eventData = {
      id: editEvent?.id || uuidv4(),
      title: title.trim(),
      description,
      startDate: buildDateTimeString(startDate, startTime),
      endDate: buildDateTimeString(endDate, endTime || startTime), // Default end time to start time
      allDay: !showTimeFields || !startTime,
      type: eventType || undefined,
      memberId: selectedMemberId || undefined,
      source: 'manual' as const,
    } as CalendarEvent;

    if (editEvent) {
      updateEvent(eventData);
    } else {
      addEvent(eventData);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${editEvent ? 'bg-amber-100' : 'bg-primary-100'}`}>
              {editEvent ? <Pencil className="w-5 h-5 text-amber-600" /> : <Plus className="w-5 h-5 text-primary-600" />}
            </div>
            <h2 className="text-lg font-semibold text-gray-900">{editEvent ? 'Edit Event' : 'Add Event'}</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Event name"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Family Member <span className="text-gray-400 font-normal">(optional)</span></label>
              <select
                value={selectedMemberId}
                onChange={(e) => setSelectedMemberId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="">Everyone / Generic</option>
                {state.familyMembers.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700">Type</label>
                {onManageTypes && (
                  <button type="button" onClick={onManageTypes} className="text-xs text-purple-600 hover:text-purple-700 flex items-center gap-0.5">
                    <Tag className="w-3 h-3" />Manage
                  </button>
                )}
              </div>
              <div className="relative">
                <select
                  value={eventType}
                  onChange={(e) => setEventType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm appearance-none pr-8"
                  style={{ borderLeftWidth: '4px', borderLeftColor: selectedType?.color || '#9ca3af' }}
                >
                  <option value="">None</option>
                  {Object.entries(BUILT_IN_EVENT_TYPES).filter(([, t]) => !t.isSystem).map(([id, type]) => (
                    <option key={id} value={id}>{type.name}</option>
                  ))}
                  {(state.customEventTypes || []).filter(t => !t.isSystem).map((type) => (
                    <option key={type.id} value={type.id}>{type.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  if (e.target.value > endDate) setEndDate(e.target.value);
                }}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
          </div>

          {/* Time fields - shown on request */}
          {!showTimeFields ? (
            <button
              type="button"
              onClick={() => setShowTimeFields(true)}
              className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700"
            >
              <Clock className="w-4 h-4" />
              Add time
            </button>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => {
                    setStartTime(e.target.value);
                    if (!endTime) setEndTime(e.target.value);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700">End Time</label>
                  <button
                    type="button"
                    onClick={() => {
                      setShowTimeFields(false);
                      setStartTime('');
                      setEndTime('');
                    }}
                    className="text-xs text-gray-500 hover:text-gray-700"
                  >
                    Remove time
                  </button>
                </div>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Additional notes..."
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">
              Cancel
            </button>
            <button
              type="submit"
              disabled={!title.trim()}
              className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              {editEvent ? 'Save Changes' : 'Add Event'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
