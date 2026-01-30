'use client';

import { Location } from '@/types';
import { useEffect, useState } from 'react';

// Query shortcut saved to local storage
interface QueryShortcut {
  id: string;
  emoji: string;
  label: string;
  query: string;
  count: number;  // How many times used
  lastUsed: number;  // Timestamp
}

interface EmojiQuickActionsProps {
  onMorningBrief: () => void;
  onWeather: (location: string) => void;
  onTraffic: (origin: string, destination: string) => void;
  onTime: () => void;
  onSmartQuery: (query: string) => void;
  locations: Location[];
  language: 'en-US' | 'ko-KR';
  recentQuery?: string;  // Last query to track
}

// Storage key for shortcuts
const SHORTCUTS_KEY = 'familyhub-query-shortcuts';
const SHORTCUTS_VERSION_KEY = 'familyhub-shortcuts-version';
const CURRENT_VERSION = 2; // Bump this to reset shortcuts when defaults change

// Default shortcuts when none exist
const getDefaultShortcuts = (locations: Location[], language: 'en-US' | 'ko-KR'): QueryShortcut[] => {
  const homeLocation = locations.find(l => l.isHome);
  const workLocation = locations.find(l => l.name.toLowerCase() === 'work' || (!l.isHome && l.lat && l.lng));
  
  const shortcuts: QueryShortcut[] = [
    {
      id: 'morning',
      emoji: '🌅',
      label: language === 'ko-KR' ? '아침' : 'Morning',
      query: '__MORNING_BRIEF__',
      count: 0,
      lastUsed: 0,
    },
    {
      id: 'sunrise-sunset',
      emoji: '🌇',
      label: language === 'ko-KR' ? '일출/일몰' : 'Sun',
      query: language === 'ko-KR' ? '오늘 일출 일몰 시간 알려줘' : 'What time is sunrise and sunset today?',
      count: 0,
      lastUsed: 0,
    },
    {
      id: 'time',
      emoji: '🕐',
      label: language === 'ko-KR' ? '시간' : 'Time',
      query: language === 'ko-KR' ? '지금 몇 시야?' : 'What time is it?',
      count: 0,
      lastUsed: 0,
    },
  ];

  // Add location-based shortcuts
  if (homeLocation) {
    shortcuts.push({
      id: `weather-${homeLocation.id}`,
      emoji: homeLocation.emoji || '🏠',
      label: language === 'ko-KR' ? `${homeLocation.name} 날씨` : `${homeLocation.name}`,
      query: language === 'ko-KR' ? `${homeLocation.name} 날씨 어때?` : `What's the weather at ${homeLocation.name}?`,
      count: 0,
      lastUsed: 0,
    });
  }

  if (workLocation && homeLocation) {
    shortcuts.push({
      id: `commute-${workLocation.id}`,
      emoji: '🚗',
      label: language === 'ko-KR' ? '출퇴근' : 'Commute',
      query: language === 'ko-KR' 
        ? `${homeLocation.name}에서 ${workLocation.name}까지 교통 어때?` 
        : `How's the traffic from ${homeLocation.name} to ${workLocation.name}?`,
      count: 0,
      lastUsed: 0,
    });
  }

  return shortcuts;
};

// Detect query type and create/update shortcut
function analyzeQuery(query: string, locations: Location[]): { emoji: string; label: string } | null {
  const lowerQuery = query.toLowerCase();
  
  // Weather queries
  if (lowerQuery.includes('weather') || lowerQuery.includes('날씨')) {
    for (const loc of locations) {
      if (lowerQuery.includes(loc.name.toLowerCase())) {
        return { emoji: loc.emoji || '☀️', label: loc.name };
      }
    }
    return { emoji: '☀️', label: 'Weather' };
  }
  
  // Traffic/commute queries
  if (lowerQuery.includes('traffic') || lowerQuery.includes('commute') || lowerQuery.includes('교통') || lowerQuery.includes('출퇴근')) {
    return { emoji: '🚗', label: 'Commute' };
  }
  
  // Time queries
  if (lowerQuery.includes('time') || lowerQuery.includes('시간') || lowerQuery.includes('몇 시')) {
    return { emoji: '🕐', label: 'Time' };
  }
  
  return null;
}

export function EmojiQuickActions({
  onMorningBrief,
  onSmartQuery,
  locations,
  language,
  recentQuery,
}: EmojiQuickActionsProps) {
  const [shortcuts, setShortcuts] = useState<QueryShortcut[]>([]);

  // Load shortcuts from storage on mount
  useEffect(() => {
    const storedVersion = localStorage.getItem(SHORTCUTS_VERSION_KEY);
    const defaults = getDefaultShortcuts(locations, language);
    
    // Reset shortcuts if version changed (new defaults added)
    if (storedVersion !== String(CURRENT_VERSION)) {
      localStorage.setItem(SHORTCUTS_VERSION_KEY, String(CURRENT_VERSION));
      localStorage.removeItem(SHORTCUTS_KEY);
      setShortcuts(defaults);
      return;
    }
    
    const stored = localStorage.getItem(SHORTCUTS_KEY);
    
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as QueryShortcut[];
        
        // Merge in any new default shortcuts that don't exist
        for (const def of defaults) {
          if (!parsed.find(s => s.id === def.id)) {
            parsed.push(def);
          }
        }
        
        // Sort by usage count and recency
        parsed.sort((a, b) => {
          const scoreA = a.count * 10 + (a.lastUsed / 1000000000);
          const scoreB = b.count * 10 + (b.lastUsed / 1000000000);
          return scoreB - scoreA;
        });
        setShortcuts(parsed);
        localStorage.setItem(SHORTCUTS_KEY, JSON.stringify(parsed));
      } catch {
        setShortcuts(defaults);
      }
    } else {
      setShortcuts(getDefaultShortcuts(locations, language));
    }
  }, [locations, language]);

  // Track recent queries and update shortcuts
  useEffect(() => {
    if (!recentQuery || recentQuery.startsWith('__')) return;
    
    const analysis = analyzeQuery(recentQuery, locations);
    if (!analysis) return;

    setShortcuts(prev => {
      // Check if this exact query exists
      const existingIndex = prev.findIndex(s => s.query.toLowerCase() === recentQuery.toLowerCase());
      
      let updated: QueryShortcut[];
      if (existingIndex >= 0) {
        // Update existing
        updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          count: updated[existingIndex].count + 1,
          lastUsed: Date.now(),
        };
      } else {
        // Add new shortcut
        const newShortcut: QueryShortcut = {
          id: `custom-${Date.now()}`,
          emoji: analysis.emoji,
          label: analysis.label,
          query: recentQuery,
          count: 1,
          lastUsed: Date.now(),
        };
        updated = [...prev, newShortcut];
      }
      
      // Sort and limit to top 8
      updated.sort((a, b) => {
        const scoreA = a.count * 10 + (a.lastUsed / 1000000000);
        const scoreB = b.count * 10 + (b.lastUsed / 1000000000);
        return scoreB - scoreA;
      });
      updated = updated.slice(0, 8);
      
      // Save to storage
      localStorage.setItem(SHORTCUTS_KEY, JSON.stringify(updated));
      
      return updated;
    });
  }, [recentQuery, locations]);

  const handleShortcutClick = (shortcut: QueryShortcut) => {
    // Update usage stats
    setShortcuts(prev => {
      const updated = prev.map(s => 
        s.id === shortcut.id 
          ? { ...s, count: s.count + 1, lastUsed: Date.now() }
          : s
      );
      localStorage.setItem(SHORTCUTS_KEY, JSON.stringify(updated));
      return updated;
    });

    // Execute the query
    if (shortcut.query === '__MORNING_BRIEF__') {
      onMorningBrief();
    } else {
      onSmartQuery(shortcut.query);
    }
  };

  // Show top shortcuts (max 6 on mobile, 8 on desktop)
  const displayShortcuts = shortcuts.slice(0, 8);

  return (
    <div className="px-3 py-2 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-blue-50">
      <div className="flex flex-wrap gap-1.5 items-center">
        {displayShortcuts.map((shortcut) => (
          <button
            key={shortcut.id}
            onClick={() => handleShortcutClick(shortcut)}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-full bg-white hover:bg-gray-100 border border-gray-200 shadow-sm transition-colors active:scale-95"
            title={shortcut.query === '__MORNING_BRIEF__' ? 'Morning Briefing' : shortcut.query}
          >
            <span>{shortcut.emoji}</span>
            <span className="hidden sm:inline max-w-[60px] truncate">{shortcut.label}</span>
          </button>
        ))}

        {/* Show hint if no shortcuts */}
        {displayShortcuts.length === 0 && (
          <span className="text-xs text-gray-400 px-2 py-1">
            {language === 'ko-KR' ? '질문하면 바로가기가 생겨요' : 'Ask questions to create shortcuts'}
          </span>
        )}
      </div>
    </div>
  );
}
