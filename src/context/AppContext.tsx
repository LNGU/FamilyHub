'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AppState, FamilyMember, CalendarEvent, TravelPlan, CustomEventType, BuiltInTypeOverride, Location } from '@/types';
import * as storage from '@/lib/storage';
import { syncSchoolCalendar, syncFlightRestrictionsFromUrl } from '@/lib/calendar-scraper';

interface AppContextType {
  state: AppState;
  loading: boolean;
  addFamilyMember: (member: FamilyMember) => void;
  updateFamilyMember: (member: FamilyMember) => void;
  removeFamilyMember: (memberId: string) => void;
  addEvent: (event: CalendarEvent) => void;
  updateEvent: (event: CalendarEvent) => void;
  removeEvent: (eventId: string) => void;
  addTravelPlan: (plan: TravelPlan) => void;
  updateTravelPlan: (plan: TravelPlan) => void;
  removeTravelPlan: (planId: string) => void;
  addCustomEventType: (eventType: CustomEventType) => void;
  updateCustomEventType: (eventType: CustomEventType) => void;
  removeCustomEventType: (eventTypeId: string) => void;
  updateBuiltInTypeOverride: (override: BuiltInTypeOverride) => void;
  addLocation: (location: Location) => void;
  updateLocation: (location: Location) => void;
  removeLocation: (locationId: string) => void;
  syncCalendar: (memberId: string) => Promise<void>;
  syncFlightRestrictions: (memberId: string) => Promise<void>;
  syncAllCalendars: () => Promise<void>;
  getTodayEvents: () => CalendarEvent[];
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>({
    familyMembers: [],
    events: [],
    travelPlans: [],
    customEventTypes: [],
    builtInTypeOverrides: [],
    locations: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load from server first (persistent JSON), fall back to localStorage
    const loadData = async () => {
      try {
        const serverData = await storage.loadStateFromServer();
        if (serverData.familyMembers.length > 0 || serverData.events.length > 0 || serverData.travelPlans.length > 0) {
          setState(serverData);
          // Sync to localStorage as cache
          if (typeof window !== 'undefined') {
            localStorage.setItem('family-hub-data', JSON.stringify(serverData));
          }
        } else {
          // Server empty, try localStorage
          const localData = storage.loadState();
          setState(localData);
          // If localStorage has data, sync it to server
          if (localData.familyMembers.length > 0 || localData.events.length > 0 || localData.travelPlans.length > 0) {
            storage.saveStateToServer(localData);
          }
        }
      } catch (error) {
        console.error('Error loading from server, falling back to localStorage:', error);
        const loaded = storage.loadState();
        setState(loaded);
      }
      setLoading(false);
    };
    
    loadData();
  }, []);

  const addFamilyMember = (member: FamilyMember) => {
    setState((prev: AppState) => storage.addFamilyMember(prev, member));
  };

  const updateFamilyMember = (member: FamilyMember) => {
    setState((prev: AppState) => storage.updateFamilyMember(prev, member));
  };

  const removeFamilyMember = (memberId: string) => {
    setState((prev: AppState) => storage.removeFamilyMember(prev, memberId));
  };

  const addEvent = (event: CalendarEvent) => {
    setState((prev: AppState) => storage.addEvent(prev, event));
  };

  const updateEvent = (event: CalendarEvent) => {
    setState((prev: AppState) => storage.updateEvent(prev, event));
  };

  const removeEvent = (eventId: string) => {
    setState((prev: AppState) => storage.removeEvent(prev, eventId));
  };

  const addTravelPlan = (plan: TravelPlan) => {
    setState((prev: AppState) => storage.addTravelPlan(prev, plan));
  };

  const updateTravelPlan = (plan: TravelPlan) => {
    setState((prev: AppState) => storage.updateTravelPlan(prev, plan));
  };

  const removeTravelPlan = (planId: string) => {
    setState((prev: AppState) => storage.removeTravelPlan(prev, planId));
  };

  const addCustomEventType = (eventType: CustomEventType) => {
    setState((prev: AppState) => storage.addCustomEventType(prev, eventType));
  };

  const updateCustomEventType = (eventType: CustomEventType) => {
    setState((prev: AppState) => storage.updateCustomEventType(prev, eventType));
  };

  const removeCustomEventType = (eventTypeId: string) => {
    setState((prev: AppState) => storage.removeCustomEventType(prev, eventTypeId));
  };

  const updateBuiltInTypeOverride = (override: BuiltInTypeOverride) => {
    setState((prev: AppState) => storage.updateBuiltInTypeOverride(prev, override));
  };

  const addLocation = (location: Location) => {
    setState((prev: AppState) => storage.addLocation(prev, location));
  };

  const updateLocation = (location: Location) => {
    setState((prev: AppState) => storage.updateLocation(prev, location));
  };

  const removeLocation = (locationId: string) => {
    setState((prev: AppState) => storage.removeLocation(prev, locationId));
  };

  const syncCalendar = async (memberId: string) => {
    const member = state.familyMembers.find((m: FamilyMember) => m.id === memberId);
    if (!member || !member.schoolCalendarUrl) return;

    try {
      const updatedEvents = await syncSchoolCalendar(member, state.events);
      setState((prev: AppState) => storage.setEvents(prev, updatedEvents));
    } catch (error) {
      console.error('Failed to sync calendar:', error);
      throw error;
    }
  };

  const syncFlightRestrictions = async (memberId: string) => {
    const member = state.familyMembers.find((m: FamilyMember) => m.id === memberId);
    if (!member || !member.flightRestrictionUrl) return;

    try {
      const updatedEvents = await syncFlightRestrictionsFromUrl(member, state.events);
      setState((prev: AppState) => storage.setEvents(prev, updatedEvents));
    } catch (error) {
      console.error('Failed to sync flight restrictions:', error);
      throw error;
    }
  };

  const syncAllCalendars = async () => {
    const membersWithCalendars = state.familyMembers.filter(
      (m: FamilyMember) => m.schoolCalendarUrl
    );
    const membersWithFlightRestrictions = state.familyMembers.filter(
      (m: FamilyMember) => m.flightRestrictionUrl
    );

    let currentEvents = state.events;

    // Sync school calendars
    for (const member of membersWithCalendars) {
      try {
        currentEvents = await syncSchoolCalendar(member, currentEvents);
      } catch (error) {
        console.error(`Failed to sync calendar for ${member.name}:`, error);
      }
    }

    // Sync flight restrictions
    for (const member of membersWithFlightRestrictions) {
      try {
        currentEvents = await syncFlightRestrictionsFromUrl(
          { ...member, ...state.familyMembers.find((m: FamilyMember) => m.id === member.id) } as FamilyMember,
          currentEvents
        );
      } catch (error) {
        console.error(`Failed to sync flight restrictions for ${member.name}:`, error);
      }
    }

    setState((prev: AppState) => storage.setEvents(prev, currentEvents));
  };

  // Get events for today (used by morning briefing)
  const getTodayEvents = (): CalendarEvent[] => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return state.events.filter((event: CalendarEvent) => {
      const eventStart = new Date(event.startDate);
      const eventEnd = new Date(event.endDate);
      // Event overlaps with today
      return eventStart < tomorrow && eventEnd >= today;
    });
  };

  return (
    <AppContext.Provider
      value={{
        state,
        loading,
        addFamilyMember,
        updateFamilyMember,
        removeFamilyMember,
        addEvent,
        updateEvent,
        removeEvent,
        addTravelPlan,
        updateTravelPlan,
        removeTravelPlan,
        addCustomEventType,
        updateCustomEventType,
        removeCustomEventType,
        updateBuiltInTypeOverride,
        addLocation,
        updateLocation,
        removeLocation,
        syncCalendar,
        syncFlightRestrictions,
        syncAllCalendars,
        getTodayEvents,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
