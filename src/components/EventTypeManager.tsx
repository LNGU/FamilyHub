'use client';

import { useState } from 'react';
import { X, Plus, Pencil, Trash2, Tag, Check } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { CustomEventType, BUILT_IN_EVENT_TYPES, BuiltInEventType } from '@/types';
import { v4 as uuidv4 } from 'uuid';

interface EventTypeManagerProps {
  onClose: () => void;
}

const PRESET_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e',
  '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1',
  '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#64748b',
];

export function EventTypeManager({ onClose }: EventTypeManagerProps) {
  const { state, addCustomEventType, updateCustomEventType, removeCustomEventType, updateBuiltInTypeOverride } = useApp();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingBuiltIn, setEditingBuiltIn] = useState<BuiltInEventType | null>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [description, setDescription] = useState('');

  const customTypes = state.customEventTypes || [];
  const builtInOverrides = state.builtInTypeOverrides || [];

  const getBuiltInDisplay = (id: BuiltInEventType) => {
    const override = builtInOverrides.find(o => o.id === id);
    const defaults = BUILT_IN_EVENT_TYPES[id];
    return { name: override?.name || defaults.name, color: override?.color || defaults.color };
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (editingBuiltIn) {
      updateBuiltInTypeOverride({ id: editingBuiltIn, name: name.trim(), color });
      setEditingBuiltIn(null);
    } else if (editingId) {
      updateCustomEventType({ id: editingId, name: name.trim(), color, description: description.trim() || undefined });
      setEditingId(null);
    } else {
      const id = `custom-${uuidv4().slice(0, 8)}`;
      addCustomEventType({ id, name: name.trim(), color, description: description.trim() || undefined });
    }

    setName('');
    setColor(PRESET_COLORS[0]);
    setDescription('');
    setIsAdding(false);
  };

  const startEditing = (eventType: CustomEventType) => {
    setEditingId(eventType.id);
    setEditingBuiltIn(null);
    setName(eventType.name);
    setColor(eventType.color);
    setDescription(eventType.description || '');
    setIsAdding(true);
  };

  const startEditingBuiltIn = (id: BuiltInEventType) => {
    const display = getBuiltInDisplay(id);
    setEditingBuiltIn(id);
    setEditingId(null);
    setName(display.name);
    setColor(display.color);
    setDescription('');
    setIsAdding(true);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditingBuiltIn(null);
    setName('');
    setColor(PRESET_COLORS[0]);
    setDescription('');
    setIsAdding(false);
  };

  const handleDelete = (id: string) => {
    const eventsCount = state.events.filter(e => e.type === id).length;
    if (eventsCount > 0) {
      if (!confirm(`This will also delete ${eventsCount} event(s) of this type. Continue?`)) return;
    }
    removeCustomEventType(id);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 max-h-[85vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
              <Tag className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Event Types</h2>
              <p className="text-xs text-gray-500">Manage your event categories</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-700">All Types</h3>
              {!isAdding && (
                <button onClick={() => setIsAdding(true)} className="flex items-center gap-1 text-sm text-purple-600 hover:text-purple-700">
                  <Plus className="w-4 h-4" />Add Type
                </button>
              )}
            </div>

            <div className="space-y-2">
              {(Object.entries(BUILT_IN_EVENT_TYPES) as [BuiltInEventType, { name: string; color: string; icon: string; isSystem?: boolean }][])
                .filter(([, type]) => !type.isSystem)
                .map(([id]) => {
                  const display = getBuiltInDisplay(id);
                  return (
                    <div key={id} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 border border-gray-200 group">
                      <div className="w-4 h-4 rounded-full" style={{ backgroundColor: display.color }} />
                      <span className="font-medium text-gray-900 flex-1">{display.name}</span>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => startEditingBuiltIn(id)} className="p-1.5 hover:bg-amber-100 rounded text-amber-600" title="Edit">
                          <Pencil className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}

              {customTypes.map((eventType) => (
                <div key={eventType.id} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 border border-gray-200 group">
                  <div className="w-4 h-4 rounded-full" style={{ backgroundColor: eventType.color }} />
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-gray-900">{eventType.name}</span>
                    {eventType.description && <p className="text-xs text-gray-500 truncate">{eventType.description}</p>}
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => startEditing(eventType)} className="p-1.5 hover:bg-amber-100 rounded text-amber-600" title="Edit">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(eventType.id)} className="p-1.5 hover:bg-red-100 rounded text-red-500" title="Delete">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {isAdding && (
            <form onSubmit={handleSubmit} className="border border-purple-200 rounded-lg p-4 bg-purple-50">
              <h4 className="font-medium text-purple-800 mb-3">
                {editingBuiltIn ? 'Edit Event Type' : editingId ? 'Edit Event Type' : 'New Event Type'}
              </h4>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Birthday, Meeting, Doctor"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
                  <div className="flex flex-wrap gap-2">
                    {PRESET_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setColor(c)}
                        className={`w-7 h-7 rounded-full border-2 transition-all ${color === c ? 'border-gray-800 scale-110' : 'border-transparent hover:border-gray-300'}`}
                        style={{ backgroundColor: c }}
                      >
                        {color === c && <Check className="w-4 h-4 text-white mx-auto" />}
                      </button>
                    ))}
                  </div>
                </div>

                {!editingBuiltIn && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
                    <input
                      type="text"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Brief description of this event type"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none text-sm"
                    />
                  </div>
                )}
              </div>

              <div className="flex gap-2 mt-4">
                <button type="button" onClick={cancelEditing} className="flex-1 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm">
                  Cancel
                </button>
                <button type="submit" disabled={!name.trim()} className="flex-1 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 text-sm">
                  {editingId ? 'Update' : 'Add Type'}
                </button>
              </div>
            </form>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button onClick={onClose} className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300">Done</button>
        </div>
      </div>
    </div>
  );
}
