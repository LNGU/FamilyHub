// Location utilities for weather and traffic
// Locations are now stored in AppState and configurable through the UI

import { Location } from '@/types';

// Find a location by name (case-insensitive)
export function findLocationByName(locations: Location[], name: string): Location | undefined {
  const lowerName = name.toLowerCase();
  return locations.find(l => 
    l.name.toLowerCase() === lowerName ||
    l.address?.toLowerCase().includes(lowerName)
  );
}

// Get the home location
export function getHomeLocation(locations: Location[]): Location | undefined {
  return locations.find(l => l.isHome);
}

// Get all locations with addresses (for weather)
export function getWeatherLocations(locations: Location[]): Location[] {
  return locations.filter(l => l.address);
}

// Get all locations with coordinates (for traffic)
export function getTrafficLocations(locations: Location[]): Location[] {
  return locations.filter(l => l.lat && l.lng);
}

// Get traffic route coordinates
export function getRouteCoords(
  locations: Location[],
  originName: string,
  destName: string
): { origin: string; destination: string } | null {
  const origin = findLocationByName(locations, originName);
  const dest = findLocationByName(locations, destName);
  
  if (!origin?.lat || !origin?.lng || !dest?.lat || !dest?.lng) {
    return null;
  }
  
  return {
    origin: `${origin.lat},${origin.lng}`,
    destination: `${dest.lat},${dest.lng}`
  };
}

// Get address for weather lookup
export function getWeatherAddress(locations: Location[], locationName: string): string | null {
  const location = findLocationByName(locations, locationName);
  return location?.address || null;
}

// Generate default sample locations (for new users)
export function getDefaultLocations(): Omit<Location, 'id'>[] {
  return [
    {
      name: 'Home',
      emoji: '🏠',
      address: '',
      isHome: true,
      color: '#22c55e',
    },
    {
      name: 'Work',
      emoji: '🏢',
      address: '',
      color: '#64748b',
    },
  ];
}
