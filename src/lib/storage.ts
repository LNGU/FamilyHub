import { AppState, FamilyMember, CalendarEvent, TravelPlan, CustomEventType, BuiltInTypeOverride, Location } from '@/types';

const STORAGE_KEY = 'family-hub-data';

const defaultState: AppState = {
  familyMembers: [],
  events: [],
  travelPlans: [],
  customEventTypes: [],
  builtInTypeOverrides: [],
  locations: [],
};

// Load from JSON file via API
export async function loadStateFromServer(): Promise<AppState> {
  try {
    const response = await fetch('/api/storage');
    if (response.ok) {
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await response.json();
        // Ensure all required properties exist
        return {
          familyMembers: data.familyMembers || [],
          events: data.events || [],
          travelPlans: data.travelPlans || [],
          customEventTypes: data.customEventTypes || [],
          builtInTypeOverrides: data.builtInTypeOverrides || [],
          locations: data.locations || [],
        };
      }
    }
  } catch (error) {
    console.error('Error loading from server:', error);
  }
  return defaultState;
}

// Save to JSON file via API
export async function saveStateToServer(state: AppState): Promise<void> {
  try {
    await fetch('/api/storage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state),
    });
  } catch (error) {
    console.error('Error saving to server:', error);
  }
}

// Also keep localStorage as backup/cache
export function loadState(): AppState {
  if (typeof window === 'undefined') {
    return defaultState;
  }
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const data = JSON.parse(stored);
      // Ensure all required properties exist
      return {
        familyMembers: data.familyMembers || [],
        events: data.events || [],
        travelPlans: data.travelPlans || [],
        customEventTypes: data.customEventTypes || [],
        builtInTypeOverrides: data.builtInTypeOverrides || [],
        locations: data.locations || [],
      };
    }
  } catch (error) {
    console.error('Error loading state:', error);
  }
  return defaultState;
}

export function saveState(state: AppState): void {
  if (typeof window === 'undefined') {
    return;
  }
  
  try {
    // Save to localStorage (fast, immediate)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    // Also save to server (persistent JSON file)
    saveStateToServer(state);
  } catch (error) {
    console.error('Error saving state:', error);
  }
}

export function addFamilyMember(state: AppState, member: FamilyMember): AppState {
  const newState = {
    ...state,
    familyMembers: [...state.familyMembers, member],
  };
  saveState(newState);
  return newState;
}

export function updateFamilyMember(state: AppState, member: FamilyMember): AppState {
  const newState = {
    ...state,
    familyMembers: state.familyMembers.map((m) =>
      m.id === member.id ? member : m
    ),
  };
  saveState(newState);
  return newState;
}

export function removeFamilyMember(state: AppState, memberId: string): AppState {
  const newState = {
    ...state,
    familyMembers: state.familyMembers.filter((m) => m.id !== memberId),
    events: state.events.filter((e) => e.memberId !== memberId),
  };
  saveState(newState);
  return newState;
}

export function addEvent(state: AppState, event: CalendarEvent): AppState {
  const newState = {
    ...state,
    events: [...state.events, event],
  };
  saveState(newState);
  return newState;
}

export function updateEvent(state: AppState, event: CalendarEvent): AppState {
  const newState = {
    ...state,
    events: state.events.map((e) => (e.id === event.id ? event : e)),
  };
  saveState(newState);
  return newState;
}

export function removeEvent(state: AppState, eventId: string): AppState {
  const newState = {
    ...state,
    events: state.events.filter((e) => e.id !== eventId),
  };
  saveState(newState);
  return newState;
}

export function setEvents(state: AppState, events: CalendarEvent[]): AppState {
  const newState = {
    ...state,
    events,
  };
  saveState(newState);
  return newState;
}

export function addTravelPlan(state: AppState, plan: TravelPlan): AppState {
  const newState = {
    ...state,
    travelPlans: [...state.travelPlans, plan],
  };
  saveState(newState);
  return newState;
}

export function updateTravelPlan(state: AppState, plan: TravelPlan): AppState {
  const newState = {
    ...state,
    travelPlans: state.travelPlans.map((p) => (p.id === plan.id ? plan : p)),
  };
  saveState(newState);
  return newState;
}

export function removeTravelPlan(state: AppState, planId: string): AppState {
  const newState = {
    ...state,
    travelPlans: state.travelPlans.filter((p) => p.id !== planId),
  };
  saveState(newState);
  return newState;
}

// Custom Event Types
export function addCustomEventType(state: AppState, eventType: CustomEventType): AppState {
  const newState = {
    ...state,
    customEventTypes: [...(state.customEventTypes || []), eventType],
  };
  saveState(newState);
  return newState;
}

export function updateCustomEventType(state: AppState, eventType: CustomEventType): AppState {
  const newState = {
    ...state,
    customEventTypes: (state.customEventTypes || []).map((et) =>
      et.id === eventType.id ? eventType : et
    ),
  };
  saveState(newState);
  return newState;
}

export function removeCustomEventType(state: AppState, eventTypeId: string): AppState {
  const newState = {
    ...state,
    customEventTypes: (state.customEventTypes || []).filter((et) => et.id !== eventTypeId),
    // Also remove all events of this type
    events: state.events.filter((e) => e.type !== eventTypeId),
  };
  saveState(newState);
  return newState;
}

// Built-in Type Overrides
export function updateBuiltInTypeOverride(state: AppState, override: BuiltInTypeOverride): AppState {
  const overrides = state.builtInTypeOverrides || [];
  const existingIndex = overrides.findIndex((o) => o.id === override.id);
  
  let newOverrides: BuiltInTypeOverride[];
  if (existingIndex >= 0) {
    newOverrides = overrides.map((o) => (o.id === override.id ? override : o));
  } else {
    newOverrides = [...overrides, override];
  }
  
  const newState = {
    ...state,
    builtInTypeOverrides: newOverrides,
  };
  saveState(newState);
  return newState;
}

// Locations
export function addLocation(state: AppState, location: Location): AppState {
  const newState = {
    ...state,
    locations: [...(state.locations || []), location],
  };
  saveState(newState);
  return newState;
}

export function updateLocation(state: AppState, location: Location): AppState {
  const newState = {
    ...state,
    locations: (state.locations || []).map((l) =>
      l.id === location.id ? location : l
    ),
  };
  saveState(newState);
  return newState;
}

export function removeLocation(state: AppState, locationId: string): AppState {
  const newState = {
    ...state,
    locations: (state.locations || []).filter((l) => l.id !== locationId),
  };
  saveState(newState);
  return newState;
}
