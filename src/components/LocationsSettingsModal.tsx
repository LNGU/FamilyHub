'use client';

import { useState } from 'react';
import { X, Plus, Trash2, MapPin, Pencil, Home, Check } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { Location, LOCATION_EMOJIS } from '@/types';
import { v4 as uuidv4 } from 'uuid';

interface LocationsSettingsModalProps {
  onClose: () => void;
}

const PRESET_COLORS = [
  '#22c55e', // green (home)
  '#64748b', // slate (work)
  '#8b5cf6', // violet (church)
  '#ec4899', // pink (family)
  '#f97316', // orange
  '#06b6d4', // cyan
  '#eab308', // yellow
  '#ef4444', // red
];

export function LocationsSettingsModal({ onClose }: LocationsSettingsModalProps) {
  const { state, removeLocation, updateLocation } = useApp();
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [isGeocodingAll, setIsGeocodingAll] = useState(false);

  const locations = state.locations || [];
  
  // Geocode all locations that have addresses but missing coordinates
  const geocodeAllLocations = async () => {
    const locationsNeedingCoords = locations.filter(l => l.address && (!l.lat || !l.lng));
    if (locationsNeedingCoords.length === 0) {
      alert('All locations already have coordinates!');
      return;
    }
    
    setIsGeocodingAll(true);
    let updated = 0;
    
    for (const loc of locationsNeedingCoords) {
      try {
        const res = await fetch(`/api/geocode?address=${encodeURIComponent(loc.address!)}`);
        if (res.ok) {
          const data = await res.json();
          updateLocation({ ...loc, lat: data.lat, lng: data.lng });
          updated++;
        }
      } catch (error) {
        console.error(`Failed to geocode ${loc.name}:`, error);
      }
    }
    
    setIsGeocodingAll(false);
    alert(`Updated coordinates for ${updated} location(s)`);
  };

  // Check if any locations need geocoding
  const locationsNeedingCoords = locations.filter(l => l.address && (!l.lat || !l.lng));

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <MapPin className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-800">Locations</h2>
              <p className="text-sm text-gray-500">Manage locations for weather & traffic</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="flex justify-between items-center mb-4">
            {locationsNeedingCoords.length > 0 && (
              <button
                onClick={geocodeAllLocations}
                disabled={isGeocodingAll}
                className="flex items-center gap-2 px-3 py-2 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 transition-colors text-sm disabled:opacity-50"
              >
                <MapPin className="w-4 h-4" />
                {isGeocodingAll ? 'Looking up...' : `Lookup ${locationsNeedingCoords.length} missing coordinates`}
              </button>
            )}
            <div className="flex-1" />
            <button
              onClick={() => { setEditingLocation(null); setShowAddForm(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
            >
              <Plus className="w-4 h-4" />Add Location
            </button>
          </div>

          {locations.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-xl">
              <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No locations added yet</p>
              <p className="text-sm text-gray-400 mt-1">Add locations like Home, Work, Church for quick weather & traffic</p>
              <button onClick={() => setShowAddForm(true)} className="mt-4 text-blue-600 hover:text-blue-700 font-medium">
                Add your first location
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {locations.map((location) => (
                <div key={location.id} className="bg-gray-50 rounded-xl p-4 flex items-center gap-4">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center text-2xl flex-shrink-0"
                    style={{ backgroundColor: location.color || '#e5e7eb' }}
                  >
                    {location.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-800">{location.name}</h3>
                      {location.isHome && (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded flex items-center gap-1">
                          <Home className="w-3 h-3" /> Home
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 truncate">{location.address || 'No address set'}</p>
                    {location.lat && location.lng ? (
                      <p className="text-xs text-green-600">✓ {location.lat.toFixed(4)}, {location.lng.toFixed(4)}</p>
                    ) : location.address ? (
                      <p className="text-xs text-amber-600">⚠ Missing coordinates - traffic won't work</p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => { setEditingLocation(location); setShowAddForm(true); }}
                      className="p-2 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                      title="Edit"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Delete "${location.name}" location?`)) {
                          removeLocation(location.id);
                        }
                      }}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
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
        <LocationFormModal 
          location={editingLocation} 
          onClose={() => { setShowAddForm(false); setEditingLocation(null); }} 
        />
      )}
    </div>
  );
}

interface LocationFormModalProps {
  location: Location | null;
  onClose: () => void;
}

function LocationFormModal({ location, onClose }: LocationFormModalProps) {
  const { addLocation, updateLocation, state } = useApp();
  const [name, setName] = useState(location?.name || '');
  const [emoji, setEmoji] = useState(location?.emoji || '🏠');
  const [address, setAddress] = useState(location?.address || '');
  const [lat, setLat] = useState(location?.lat?.toString() || '');
  const [lng, setLng] = useState(location?.lng?.toString() || '');
  const [isHome, setIsHome] = useState(location?.isHome || false);
  const [color, setColor] = useState(location?.color || PRESET_COLORS[0]);
  const [isGeocoding, setIsGeocoding] = useState(false);

  // Auto-geocode when address changes
  const geocodeAddress = async (addr: string) => {
    if (!addr.trim()) return;
    
    setIsGeocoding(true);
    try {
      const res = await fetch(`/api/geocode?address=${encodeURIComponent(addr)}`);
      if (res.ok) {
        const data = await res.json();
        setLat(data.lat.toString());
        setLng(data.lng.toString());
      }
    } catch (error) {
      console.error('Geocoding error:', error);
    } finally {
      setIsGeocoding(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // If address is set but no coordinates, geocode first
    let finalLat = lat ? parseFloat(lat) : undefined;
    let finalLng = lng ? parseFloat(lng) : undefined;
    
    if (address && (!finalLat || !finalLng)) {
      setIsGeocoding(true);
      try {
        const res = await fetch(`/api/geocode?address=${encodeURIComponent(address)}`);
        if (res.ok) {
          const data = await res.json();
          finalLat = data.lat;
          finalLng = data.lng;
        }
      } catch (error) {
        console.error('Geocoding error:', error);
      } finally {
        setIsGeocoding(false);
      }
    }
    
    const locationData: Location = {
      id: location?.id || uuidv4(),
      name,
      emoji,
      address: address || undefined,
      lat: finalLat,
      lng: finalLng,
      isHome,
      color,
    };

    // If marking as home, unmark other homes
    if (isHome && !location?.isHome) {
      const existingHome = (state.locations || []).find(l => l.isHome && l.id !== location?.id);
      if (existingHome) {
        updateLocation({ ...existingHome, isHome: false });
      }
    }

    if (location) {
      updateLocation(locationData);
    } else {
      addLocation(locationData);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">{location ? 'Edit Location' : 'Add Location'}</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                placeholder="e.g., Home, Work, Church"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Emoji</label>
              <div className="relative">
                <button
                  type="button"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-2xl text-center hover:bg-gray-50"
                >
                  {emoji}
                </button>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Emoji</label>
            <div className="flex flex-wrap gap-2">
              {LOCATION_EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setEmoji(e)}
                  className={`w-10 h-10 rounded-lg text-xl flex items-center justify-center transition-all ${
                    emoji === e ? 'bg-blue-100 ring-2 ring-blue-500' : 'bg-gray-100 hover:bg-gray-200'
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-full transition-transform ${
                    color === c ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : ''
                  }`}
                  style={{ backgroundColor: c }}
                >
                  {color === c && <Check className="w-4 h-4 text-white mx-auto" />}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              City / Address <span className="text-gray-400">(for weather & traffic)</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                placeholder="e.g., 123 Main St, Seattle, WA"
              />
              <button
                type="button"
                onClick={() => geocodeAddress(address)}
                disabled={!address.trim() || isGeocoding}
                className="px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 disabled:opacity-50 text-sm whitespace-nowrap"
              >
                {isGeocoding ? '...' : '📍 Lookup'}
              </button>
            </div>
            {isGeocoding && <p className="text-xs text-blue-500 mt-1">Looking up coordinates...</p>}
            {lat && lng && <p className="text-xs text-green-600 mt-1">✓ Coordinates found: {parseFloat(lat).toFixed(4)}, {parseFloat(lng).toFixed(4)}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Latitude <span className="text-gray-400">(for traffic)</span>
              </label>
              <input
                type="number"
                step="any"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                placeholder="47.6062"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Longitude
              </label>
              <input
                type="number"
                step="any"
                value={lng}
                onChange={(e) => setLng(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                placeholder="-122.3321"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="isHome"
              checked={isHome}
              onChange={(e) => setIsHome(e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="isHome" className="text-sm text-gray-700">
              This is my home location <span className="text-gray-400">(default origin for traffic)</span>
            </label>
          </div>

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={!name.trim()} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {location ? 'Update' : 'Add Location'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
