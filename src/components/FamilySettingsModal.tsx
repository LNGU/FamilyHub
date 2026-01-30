'use client';

import { useState } from 'react';
import { X, Plus, Trash2, Mail, MapPin } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { FamilyMember, DEFAULT_COLORS } from '@/types';
import { v4 as uuidv4 } from 'uuid';

interface FamilySettingsModalProps {
  onClose: () => void;
}

export function FamilySettingsModal({ onClose }: FamilySettingsModalProps) {
  const { state, removeFamilyMember } = useApp();
  const [editingMember, setEditingMember] = useState<FamilyMember | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">Family Settings</h2>
            <p className="text-sm text-gray-500">Manage family members and their calendars</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="flex justify-end mb-4">
            <button
              onClick={() => { setEditingMember(null); setShowAddForm(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm"
            >
              <Plus className="w-4 h-4" />Add Member
            </button>
          </div>

          {state.familyMembers.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-xl">
              <p className="text-gray-500">No family members added yet</p>
              <button onClick={() => setShowAddForm(true)} className="mt-4 text-primary-600 hover:text-primary-700 font-medium">
                Add your first family member
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {state.familyMembers.map((member) => {
                const eventCount = state.events.filter(e => e.memberId === member.id).length;
                const restrictionCount = state.events.filter(e => e.memberId === member.id && e.type === 'flight-restriction').length;

                return (
                  <div key={member.id} className="bg-gray-50 rounded-xl p-4 flex items-center gap-4">
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold text-lg flex-shrink-0"
                      style={{ backgroundColor: member.color }}
                    >
                      {member.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-800">{member.name}</h3>
                      {member.email && (
                        <p className="text-xs text-gray-500 flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {member.email}
                        </p>
                      )}
                      {member.locationId && (
                        <p className="text-xs text-blue-600 flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {state.locations?.find(l => l.id === member.locationId)?.name || 'Unknown'}
                          {member.timezone && <span className="text-gray-400">({member.timezone})</span>}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-2 mt-1">
                        <span className="text-xs text-gray-500">{eventCount} events</span>
                        {restrictionCount > 0 && (
                          <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">{restrictionCount} restrictions</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => { setEditingMember(member); setShowAddForm(true); }}
                        className="px-3 py-2 text-sm text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Delete ${member.name} and all their events?`)) {
                            removeFamilyMember(member.id);
                          }
                        }}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete member"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
          <button onClick={onClose} className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors">
            Close
          </button>
        </div>
      </div>

      {showAddForm && (
        <MemberFormModal member={editingMember} onClose={() => { setShowAddForm(false); setEditingMember(null); }} />
      )}
    </div>
  );
}

interface MemberFormModalProps {
  member: FamilyMember | null;
  onClose: () => void;
}

function MemberFormModal({ member, onClose }: MemberFormModalProps) {
  const { addFamilyMember, updateFamilyMember, state } = useApp();
  const [name, setName] = useState(member?.name || '');
  const [email, setEmail] = useState(member?.email || '');
  const [locationId, setLocationId] = useState(member?.locationId || '');
  const [timezone, setTimezone] = useState(member?.timezone || '');
  const [color, setColor] = useState(member?.color || DEFAULT_COLORS[state.familyMembers.length % DEFAULT_COLORS.length]);

  // Common US timezones
  const timezones = [
    { value: '', label: 'Same as device' },
    { value: 'America/Los_Angeles', label: 'Pacific (LA, Seattle)' },
    { value: 'America/Denver', label: 'Mountain (Denver)' },
    { value: 'America/Chicago', label: 'Central (Chicago)' },
    { value: 'America/Indiana/Indianapolis', label: 'Eastern - Indiana' },
    { value: 'America/New_York', label: 'Eastern (NYC)' },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const memberData: FamilyMember = { 
      id: member?.id || uuidv4(), 
      name, 
      color,
      email: email || undefined,
      locationId: locationId || undefined,
      timezone: timezone || undefined,
    };
    if (member) {
      updateFamilyMember(memberData);
    } else {
      addFamilyMember(memberData);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">{member ? 'Edit Member' : 'Add Member'}</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
              placeholder="Enter name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email (for sign-in identification)</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
              placeholder="their.google@email.com"
            />
            <p className="text-xs text-gray-500 mt-1">Used to identify which member is signed in</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Default Location</label>
            <select
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            >
              <option value="">None</option>
              {(state.locations || []).map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.emoji} {loc.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Timezone</label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            >
              {timezones.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
            <div className="flex flex-wrap gap-2">
              {DEFAULT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-full transition-transform ${color === c ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : ''}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={!name.trim()} className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50">
              {member ? 'Update' : 'Add'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
