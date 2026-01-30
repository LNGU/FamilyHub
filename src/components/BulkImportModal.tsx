'use client';

import { useState } from 'react';
import { X, FileText, Check } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { v4 as uuidv4 } from 'uuid';
import { BUILT_IN_EVENT_TYPES, BuiltInEventType } from '@/types';
import { dateToISOString } from '@/lib/date-utils';

interface BulkImportModalProps {
  onClose: () => void;
}

export function BulkImportModal({ onClose }: BulkImportModalProps) {
  const { state, addEvent } = useApp();
  const [text, setText] = useState('');
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [eventType, setEventType] = useState<string>('school');

  const builtInOverrides = state.builtInTypeOverrides || [];

  const getBuiltInDisplay = (id: BuiltInEventType) => {
    const override = builtInOverrides.find(o => o.id === id);
    const defaults = BUILT_IN_EVENT_TYPES[id];
    return { name: override?.name || defaults.name, color: override?.color || defaults.color };
  };

  const parseLines = () => {
    const lines = text.trim().split('\n').filter(line => line.trim());
    const events: Array<{ title: string; startDate: string; endDate: string }> = [];

    for (const line of lines) {
      let match;
      
      // Format: YYYY-MM-DD - YYYY-MM-DD, Title
      match = line.match(/(\d{4}-\d{2}-\d{2})\s*(?:-|to)\s*(\d{4}-\d{2}-\d{2})[,\s]+(.+)/i);
      if (match) {
        events.push({ startDate: match[1], endDate: match[2], title: match[3].trim() });
        continue;
      }

      // Format: YYYY-MM-DD, Title
      match = line.match(/(\d{4}-\d{2}-\d{2})[,\s]+(.+)/);
      if (match) {
        events.push({ startDate: match[1], endDate: match[1], title: match[2].trim() });
        continue;
      }

      // Format: Title, YYYY-MM-DD - YYYY-MM-DD
      match = line.match(/(.+?)[,\s]+(\d{4}-\d{2}-\d{2})\s*(?:-|to)\s*(\d{4}-\d{2}-\d{2})/i);
      if (match) {
        events.push({ title: match[1].trim(), startDate: match[2], endDate: match[3] });
        continue;
      }

      // Format: Title, YYYY-MM-DD
      match = line.match(/(.+?)[,\s]+(\d{4}-\d{2}-\d{2})/);
      if (match) {
        events.push({ title: match[1].trim(), startDate: match[2], endDate: match[2] });
        continue;
      }
    }
    return events;
  };

  const parsedEvents = parseLines();

  const handleImport = () => {
    if (!selectedMemberId || parsedEvents.length === 0) return;

    parsedEvents.forEach(event => {
      addEvent({
        id: uuidv4(),
        title: event.title,
        description: '',
        startDate: dateToISOString(event.startDate),
        endDate: dateToISOString(event.endDate),
        allDay: true,
        type: eventType,
        memberId: selectedMemberId,
        source: 'manual',
      });
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
              <FileText className="w-5 h-5 text-green-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">Bulk Import Dates</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Family Member</label>
              <select
                value={selectedMemberId}
                onChange={(e) => setSelectedMemberId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="">Select...</option>
                {state.familyMembers.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Event Type</label>
              <select
                value={eventType}
                onChange={(e) => setEventType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                {(Object.keys(BUILT_IN_EVENT_TYPES) as BuiltInEventType[])
                  .filter(id => !BUILT_IN_EVENT_TYPES[id].isSystem)
                  .map((id) => {
                    const display = getBuiltInDisplay(id);
                    return <option key={id} value={id}>{display.name}</option>;
                  })}
                {(state.customEventTypes || []).filter(t => !t.isSystem).map((type) => (
                  <option key={type.id} value={type.id}>{type.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Paste dates (one per line)</label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={`2026-09-07, Labor Day
2026-11-26 to 2026-11-27, Thanksgiving
Winter Break, 2026-12-21 to 2026-12-31`}
              rows={8}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
            />
            <p className="text-xs text-gray-500 mt-1">
              Formats: <code>YYYY-MM-DD, Title</code> or <code>YYYY-MM-DD to YYYY-MM-DD, Title</code>
            </p>
          </div>

          {parsedEvents.length > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <p className="text-sm font-medium text-green-800 mb-2">✓ Parsed {parsedEvents.length} events:</p>
              <ul className="text-xs text-green-700 max-h-32 overflow-y-auto space-y-1">
                {parsedEvents.map((e, i) => (
                  <li key={i}>{e.title} ({e.startDate}{e.startDate !== e.endDate ? ` → ${e.endDate}` : ''})</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg">Cancel</button>
          <button
            onClick={handleImport}
            disabled={!selectedMemberId || parsedEvents.length === 0}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Check className="w-4 h-4" />
            Import {parsedEvents.length} Events
          </button>
        </div>
      </div>
    </div>
  );
}
