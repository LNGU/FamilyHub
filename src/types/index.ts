// Built-in event types that are always available
export type BuiltInEventType = 'school' | 'flight-restriction' | 'travel' | 'ai-suggestion';

// EventType can be a built-in type or a custom type ID
export type EventType = BuiltInEventType | string;

// Custom event type definition
export interface CustomEventType {
  id: string;                    // Unique identifier (used as type value)
  name: string;                  // Display name
  color: string;                 // Hex color for display
  icon?: string;                 // Optional icon name from lucide-react
  description?: string;          // Optional description
  isSystem?: boolean;            // True for system types (hidden from type manager)
}

// Override for built-in event types (to customize name/color)
export interface BuiltInTypeOverride {
  id: BuiltInEventType;          // Which built-in type to override
  name?: string;                 // Custom display name
  color?: string;                // Custom color
}

// Location for weather and traffic
export interface Location {
  id: string;
  name: string;                  // Display name (e.g., "Home", "Work")
  emoji: string;                 // Emoji for quick actions
  address?: string;              // City/address for weather lookup
  lat?: number;                  // Latitude for traffic
  lng?: number;                  // Longitude for traffic
  isHome?: boolean;              // Mark as home location (used as default origin for traffic)
  color?: string;                // Background color for button
}

// Default emoji options for locations
export const LOCATION_EMOJIS = [
  '🏠', '🏢', '⛪', '🏫', '🏥', '🏪', '🏬', '🏭',
  '👧', '👦', '👴', '👵', '🧑', '👨', '👩',
  '🏖️', '⛰️', '🏕️', '✈️', '🚉', '🏟️', '🎭',
];

// Built-in event type definitions (for consistency)
export const BUILT_IN_EVENT_TYPES: Record<BuiltInEventType, { name: string; color: string; icon: string; isSystem?: boolean }> = {
  'school': { name: 'School Event', color: '#10b981', icon: 'GraduationCap' },
  'flight-restriction': { name: 'Flight Restriction', color: '#ef4444', icon: 'PlaneTakeoff' },
  'travel': { name: 'Travel Window', color: '#8b5cf6', icon: 'Palmtree' },
  'ai-suggestion': { name: 'AI Suggestion', color: '#9333ea', icon: 'Bot', isSystem: true },
};

// System AI member for events created by AI assistant
export const AI_MEMBER_ID = '__ai__';
export const AI_MEMBER: FamilyMember = {
  id: AI_MEMBER_ID,
  name: 'AI',
  color: '#9333ea', // Purple for AI
  isSystem: true,
};

export interface ScrapingConfig {
  // CSS selectors for extracting calendar data
  eventSelector?: string;        // Selector for event containers
  titleSelector?: string;        // Selector for event title within container
  dateSelector?: string;         // Selector for event date within container
  descriptionSelector?: string;  // Selector for event description
}

export interface FamilyMember {
  id: string;
  name: string;
  color: string;
  email?: string;                 // Google auth email to identify signed-in user
  locationId?: string;            // Default location for this member
  timezone?: string;              // Member's timezone (e.g., 'America/Indiana/Indianapolis')
  isSystem?: boolean;             // True for system members like AI (hidden from UI)
  schoolCalendarUrl?: string;
  scrapingConfig?: ScrapingConfig;
  flightRestrictionUrl?: string;
  flightRestrictionScrapingConfig?: ScrapingConfig;
}

// Base interface with common properties for all events
interface BaseCalendarEvent {
  id: string;
  title: string;
  description?: string;
  startDate: string;
  endDate: string;
  allDay: boolean;
  memberId?: string;  // Optional - generic events apply to everyone
  source?: 'manual' | 'scraped';
  sourceUrl?: string;
}

// School events - scraped from school calendar pages
export interface SchoolEvent extends BaseCalendarEvent {
  type: 'school';
  // School-specific properties
  schoolName?: string;
  eventCategory?: 'holiday' | 'half-day' | 'no-school' | 'event' | 'other';
}

// Flight restriction events - dates when members cannot travel
export interface FlightRestrictionEvent extends BaseCalendarEvent {
  type: 'flight-restriction';
  // Flight restriction-specific properties
  reason: string;
  isFlexible?: boolean; // Can this restriction be moved if needed?
}

// Travel events - available travel windows
export interface TravelEvent extends BaseCalendarEvent {
  type: 'travel';
  // Travel window properties
  destination?: string; // Optional - only if a destination is being considered
  participants: string[]; // member IDs who are available
  notes?: string;
  hasConflict?: boolean; // Computed based on flight restrictions
}

// Custom event - user-defined event types or events with no type
export interface CustomEvent extends BaseCalendarEvent {
  type?: string; // References CustomEventType.id, optional for events without a type
  // Custom events can have any additional properties stored here
  customFields?: Record<string, unknown>;
}

// Discriminated union of all event types
export type CalendarEvent = SchoolEvent | FlightRestrictionEvent | TravelEvent | CustomEvent;

// Type guard functions for runtime type checking
export function isSchoolEvent(event: CalendarEvent): event is SchoolEvent {
  return event.type === 'school';
}

export function isFlightRestrictionEvent(event: CalendarEvent): event is FlightRestrictionEvent {
  return event.type === 'flight-restriction';
}

export function isTravelEvent(event: CalendarEvent): event is TravelEvent {
  return event.type === 'travel';
}

export function isCustomEvent(event: CalendarEvent): event is CustomEvent {
  return !event.type || !['school', 'flight-restriction', 'travel'].includes(event.type);
}

export function isBuiltInEventType(type: string | undefined): type is BuiltInEventType {
  return !!type && ['school', 'flight-restriction', 'travel'].includes(type);
}

// Legacy interfaces (kept for backward compatibility, consider migrating)
export interface FlightRestriction {
  id: string;
  memberId: string;
  startDate: string;
  endDate: string;
  reason: string;
}

// Travel windows - potential dates when family members are available to travel
export interface TravelWindow {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  participants: string[]; // member IDs who are available
  notes?: string;
}

// Keep TravelPlan as alias for backward compatibility
export type TravelPlan = TravelWindow;

export interface AppState {
  familyMembers: FamilyMember[];
  events: CalendarEvent[];
  travelPlans: TravelWindow[]; // Available travel windows
  customEventTypes: CustomEventType[];
  builtInTypeOverrides?: BuiltInTypeOverride[];  // Customizations for built-in types
  locations?: Location[];  // Saved locations for weather/traffic
}

export const DEFAULT_COLORS = [
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
];
