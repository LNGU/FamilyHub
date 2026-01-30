'use client';

import { useState, useMemo, useCallback, useRef, useEffect, FormEvent } from 'react';
import { useSession } from 'next-auth/react';
import { 
  format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, 
  addMonths, subMonths, startOfWeek, endOfWeek, isWithinInterval, parseISO
} from 'date-fns';
import { 
  ChevronLeft, ChevronRight, Send, Bot, User, Loader2, Calendar, Plane, Palmtree,
  Check, X, Users, Upload, Trash2, Plus, Pencil, Tag, Database, Mic, MicOff, Volume2, MapPin
} from 'lucide-react';
import { BulkImportModal } from './BulkImportModal';
import { FamilySettingsModal } from './FamilySettingsModal';
import { LocationsSettingsModal } from './LocationsSettingsModal';
import { AddEventModal } from './AddEventModal';
import { EventTypeManager } from './EventTypeManager';
import { EmojiQuickActions } from './EmojiQuickActions';
import { useApp } from '@/context/AppContext';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { useSpeechSynthesis } from '@/hooks/useSpeechSynthesis';
import { CalendarEvent, EventType, BUILT_IN_EVENT_TYPES, isBuiltInEventType, BuiltInTypeOverride, AI_MEMBER_ID, AI_MEMBER, FamilyMember } from '@/types';
import { v4 as uuidv4 } from 'uuid';

// UI Translations
const translations = {
  'en-US': {
    appName: 'FamilyHub',
    addEvent: 'Add Event',
    bulkImport: 'Bulk Import',
    today: 'Today',
    school: 'School',
    noTravel: 'No Travel',
    trip: 'Trip',
    aiAssistant: 'AI Assistant',
    voiceCalendarWeather: 'Voice + Calendar + Weather',
    tapToSpeak: 'Tap to Speak',
    tapToStop: 'Tap to Stop',
    typeMessage: 'Type a message...',
    listening: 'Listening...',
    noEvents: 'No events - available for travel!',
    noEventsThisDay: 'No events this day',
    availableForActivities: 'This day is available for activities!',
    edit: 'Edit',
    delete: 'Delete',
    confirm: 'Confirm',
    deleteEvent: 'Delete this event?',
    hiAssistant: "Hi! I'm your family assistant.",
    assistantHelp: 'I can help with calendar, weather, traffic, and planning trips.',
    whenTravel: '✈️ When can we travel together?',
    morningBrief: '🌅 Morning briefing',
    sun: 'Sun', mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat',
  },
  'ko-KR': {
    appName: '패밀리허브',
    addEvent: '일정 추가',
    bulkImport: '일괄 가져오기',
    today: '오늘',
    school: '학교',
    noTravel: '여행 불가',
    trip: '여행',
    aiAssistant: 'AI 어시스턴트',
    voiceCalendarWeather: '음성 + 캘린더 + 날씨',
    tapToSpeak: '말하려면 터치',
    tapToStop: '멈추려면 터치',
    typeMessage: '메시지를 입력하세요...',
    listening: '듣는 중...',
    noEvents: '일정 없음 - 여행 가능!',
    noEventsThisDay: '오늘 일정 없음',
    availableForActivities: '이 날은 활동이 가능합니다!',
    edit: '수정',
    delete: '삭제',
    confirm: '확인',
    deleteEvent: '이 일정을 삭제할까요?',
    hiAssistant: '안녕하세요! 가족 도우미입니다.',
    assistantHelp: '캘린더, 날씨, 교통, 여행 계획을 도와드릴 수 있어요.',
    whenTravel: '✈️ 언제 함께 여행할 수 있을까요?',
    morningBrief: '🌅 아침 브리핑',
    sun: '일', mon: '월', tue: '화', wed: '수', thu: '목', fri: '금', sat: '토',
  },
};

function getEventTypeColor(
  type: EventType | undefined, 
  customEventTypes: { id: string; color: string }[],
  builtInOverrides?: BuiltInTypeOverride[]
): string {
  if (!type) return '#9ca3af'; // Gray for no type
  if (isBuiltInEventType(type)) {
    const override = builtInOverrides?.find(o => o.id === type);
    return override?.color || BUILT_IN_EVENT_TYPES[type].color;
  }
  const customType = customEventTypes.find(t => t.id === type);
  return customType?.color || '#6b7280';
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  language?: 'en' | 'ko';
  provider?: string;
}

interface AIAction {
  type: string;
  memberName?: string;
  name?: string;
  startDate?: string;
  endDate?: string;
  title?: string;
  titles?: string[];
  restrictions?: { startDate: string; endDate: string; title: string }[];
  description?: string;
  notes?: string;
  schoolCalendarUrl?: string;
  eventType?: EventType;
}

export function MainView() {
  const { data: session } = useSession();
  const { 
    state, loading, addFamilyMember, addEvent, updateEvent, removeEvent,
    addTravelPlan, removeTravelPlan, getTodayEvents
  } = useApp();
  
  // Identify current signed-in user as a family member
  const currentMember = useMemo((): FamilyMember | null => {
    if (!session?.user?.email) return null;
    return state.familyMembers.find(m => 
      m.email?.toLowerCase() === session.user?.email?.toLowerCase()
    ) || null;
  }, [session?.user?.email, state.familyMembers]);
  
  // Calendar state
  const [currentDate, setCurrentDate] = useState<Date | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  
  // Voice state
  const [language, setLanguage] = useState<'en-US' | 'ko-KR'>('ko-KR');
  const { transcript, isListening, startListening, stopListening, isSupported: speechSupported, error: speechError } = useSpeechRecognition(language);
  const { speak, isSpeaking, isSupported: synthSupported } = useSpeechSynthesis();
  const [voiceMode, setVoiceMode] = useState(false);
  
  // Translation helper
  const t = translations[language];

  // Load language preference from localStorage
  useEffect(() => {
    const savedLang = localStorage.getItem('familyhub-language');
    if (savedLang === 'ko-KR' || savedLang === 'en-US') {
      setLanguage(savedLang);
    }
  }, []);

  // Save language preference
  const changeLanguage = (newLang: 'en-US' | 'ko-KR') => {
    setLanguage(newLang);
    localStorage.setItem('familyhub-language', newLang);
  };
  
  // Chat state
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [lastQuery, setLastQuery] = useState<string>('');  // Track for emoji shortcuts
  const [pendingActions, setPendingActions] = useState<AIAction[]>([]);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [showFamilySettings, setShowFamilySettings] = useState(false);
  const [showLocationsSettings, setShowLocationsSettings] = useState(false);
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [showEventTypeManager, setShowEventTypeManager] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [showMobileChat, setShowMobileChat] = useState(false);
  const [showMobileDateDetails, setShowMobileDateDetails] = useState(false);
  const [storageInfo, setStorageInfo] = useState<{ keySizeFormatted: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCurrentDate(new Date());
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Handle voice transcript
  useEffect(() => {
    if (transcript && !isListening) {
      setInput(transcript);
      // Auto-submit after voice input
      handleVoiceSubmit(transcript);
    }
  }, [transcript, isListening]);

  useEffect(() => {
    const fetchStorageInfo = async () => {
      try {
        const res = await fetch('/api/storage', { method: 'PUT' });
        if (res.ok) {
          const contentType = res.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const data = await res.json();
            setStorageInfo(data);
          }
        }
      } catch (err) {
        console.error('Failed to fetch storage info:', err);
      }
    };
    fetchStorageInfo();
    const interval = setInterval(fetchStorageInfo, 30000);
    return () => clearInterval(interval);
  }, []);

  const monthStart = currentDate ? startOfMonth(currentDate) : startOfMonth(new Date());
  const monthEnd = currentDate ? endOfMonth(currentDate) : endOfMonth(new Date());
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const deduplicateEvents = useCallback((events: CalendarEvent[]): CalendarEvent[] => {
    const eventMap = new Map<string, CalendarEvent>();
    events.forEach(event => {
      const key = `${event.title}|${event.type}|${event.startDate}|${event.endDate}`;
      if (!eventMap.has(key)) eventMap.set(key, event);
    });
    return Array.from(eventMap.values());
  }, []);

  const getEventsForDay = useCallback((date: Date): CalendarEvent[] => {
    const dayEvents = state.events.filter((event) => {
      try {
        const start = parseISO(event.startDate);
        const end = parseISO(event.endDate);
        return isWithinInterval(date, { start, end }) || isSameDay(date, start) || isSameDay(date, end);
      } catch { return false; }
    });
    return deduplicateEvents(dayEvents);
  }, [state.events, deduplicateEvents]);

  const getMemberName = (memberId: string | undefined): string => {
    if (!memberId) return 'Everyone';
    if (memberId === AI_MEMBER_ID) return AI_MEMBER.name;
    return state.familyMembers.find((m) => m.id === memberId)?.name || 'Unknown';
  };

  const getMemberInitial = (memberId: string | undefined): string => {
    if (!memberId) return '👥';
    if (memberId === AI_MEMBER_ID) return '🤖';
    const member = state.familyMembers.find((m) => m.id === memberId);
    return member?.name?.charAt(0).toUpperCase() || '?';
  };

  const getMembersForEvent = useCallback((event: CalendarEvent): string[] => {
    const matchingEvents = state.events.filter(e => 
      e.title === event.title && e.type === event.type && 
      e.startDate === event.startDate && e.endDate === event.endDate
    );
    return [...new Set(matchingEvents.map(e => e.memberId).filter((id): id is string => !!id))];
  }, [state.events]);

  const selectedDayEvents = useMemo(() => {
    if (!selectedDate) return [];
    return getEventsForDay(selectedDate);
  }, [selectedDate, getEventsForDay]);

  const travelOpportunities = useMemo(() => {
    return state.events
      .filter(e => e.type === 'school' && (
        e.title.toLowerCase().includes('break') ||
        e.title.toLowerCase().includes('holiday') ||
        e.title.toLowerCase().includes('no school')
      ))
      .sort((a, b) => parseISO(a.startDate).getTime() - parseISO(b.startDate).getTime())
      .slice(0, 5);
  }, [state.events]);

  const buildContext = () => {
    try {
      const schoolEvents = state.events.filter(e => e.type === 'school').map(e => ({
        memberName: getMemberName(e.memberId),
        title: e.title,
        startDate: format(parseISO(e.startDate), 'yyyy-MM-dd'),
        endDate: format(parseISO(e.endDate), 'yyyy-MM-dd'),
        isTravelOpportunity: e.title.toLowerCase().includes('break') || e.title.toLowerCase().includes('holiday')
      }));

      const flightRestrictions = state.events.filter(e => e.type === 'flight-restriction').map(e => ({
        memberName: getMemberName(e.memberId),
        title: e.title,
        startDate: format(parseISO(e.startDate), 'yyyy-MM-dd'),
        endDate: format(parseISO(e.endDate), 'yyyy-MM-dd'),
      }));

      const todayEvents = getTodayEvents().map(e => ({
        title: e.title,
        startDate: e.startDate,
        memberName: getMemberName(e.memberId),
      }));

      // Get upcoming events for the next 7 days (so AI can answer about tomorrow, this week, etc.)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const nextWeek = new Date(today);
      nextWeek.setDate(nextWeek.getDate() + 7);
      
      const upcomingEvents = state.events
        .filter(e => {
          const eventStart = parseISO(e.startDate);
          const eventEnd = parseISO(e.endDate);
          // Event starts within next 7 days OR is ongoing
          return (eventStart >= today && eventStart < nextWeek) || (eventStart < nextWeek && eventEnd >= today);
        })
        .map(e => ({
          title: e.title,
          type: e.type,
          startDate: format(parseISO(e.startDate), 'yyyy-MM-dd'),
          endDate: format(parseISO(e.endDate), 'yyyy-MM-dd'),
          memberName: getMemberName(e.memberId),
        }))
        .sort((a, b) => a.startDate.localeCompare(b.startDate));

      // Include configured locations in context
      const locations = (state.locations || []).map(l => ({
        name: l.name,
        address: l.address,
        isHome: l.isHome,
        hasCoordinates: !!(l.lat && l.lng),
      }));

      return {
        familyMembers: state.familyMembers.map(m => ({ 
          name: m.name, id: m.id,
          hasCalendarUrl: !!m.schoolCalendarUrl,
          hasFlightRestrictionUrl: !!m.flightRestrictionUrl
        })),
        schoolEvents,
        flightRestrictions,
        travelPlans: state.travelPlans.map(p => ({
          title: p.title,
          startDate: format(parseISO(p.startDate), 'yyyy-MM-dd'),
          endDate: format(parseISO(p.endDate), 'yyyy-MM-dd'),
          participants: p.participants.map(id => getMemberName(id)),
        })),
        todayEvents,
        upcomingEvents,
        selectedDate: selectedDate ? format(selectedDate, 'yyyy-MM-dd') : null,
        currentDate: format(new Date(), 'yyyy-MM-dd'),
        currentTime: format(new Date(), 'h:mm a'),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        locations,
        // Current signed-in user info
        currentUser: currentMember ? {
          name: currentMember.name,
          email: currentMember.email,
          locationName: state.locations?.find(l => l.id === currentMember.locationId)?.name,
          timezone: currentMember.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
        } : null,
        weatherData: null as string | null,
        trafficData: null as string | null,
      };
    } catch {
      return { familyMembers: [], schoolEvents: [], flightRestrictions: [], travelPlans: [], todayEvents: [], upcomingEvents: [], selectedDate: null, locations: [], currentUser: null, weatherData: null, trafficData: null };
    }
  };

  const handleVoiceSubmit = async (text: string) => {
    if (!text.trim()) return;
    // Auto-enable voice mode when using speech input
    setVoiceMode(true);
    await sendMessage(text, true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    await sendMessage(input, voiceMode);
  };

  // Helper to check if message is about weather or traffic
  const isWeatherOrTrafficQuery = (text: string): boolean => {
    const lowerText = text.toLowerCase();
    return lowerText.includes('weather') || 
           lowerText.includes('traffic') || 
           lowerText.includes('commute') ||
           lowerText.includes('morning') ||
           lowerText.includes('evening') ||
           lowerText.includes('briefing') ||
           lowerText.includes('sunrise') ||
           lowerText.includes('sunset') ||
           lowerText.includes('날씨') ||
           lowerText.includes('교통') ||
           lowerText.includes('출근') ||
           lowerText.includes('퇴근') ||
           lowerText.includes('저녁') ||
           lowerText.includes('브리핑') ||
           lowerText.includes('일출') ||
           lowerText.includes('일몰');
  };

  // Fetch weather data for a location
  const fetchWeatherData = async (location: { name: string; address?: string }): Promise<string | null> => {
    if (!location.address) {
      console.log(`[Weather] No address for ${location.name}`);
      return null;
    }
    try {
      console.log(`[Weather] Fetching for ${location.name}: ${location.address}`);
      const res = await fetch(`/api/weather?address=${encodeURIComponent(location.address)}&name=${encodeURIComponent(location.name)}`);
      const data = await res.json();
      console.log(`[Weather] Response for ${location.name}:`, data);
      if (data.error) {
        console.log(`[Weather] Error for ${location.name}: ${data.error}`);
        // Return error with source so AI can report which API failed
        return `Error from ${data.source || 'Weather API'}: ${data.error}`;
      }
      let result = `${data.location}: ${data.temperature}°C, ${data.description}, humidity ${data.humidity}%, wind ${data.windSpeed}km/h`;
      if (data.sunrise && data.sunset) {
        result += `, sunrise ${data.sunrise}, sunset ${data.sunset}`;
      }
      return result;
    } catch (err) {
      console.error(`[Weather] Fetch error for ${location.name}:`, err);
      return `Error from OpenWeather API: Failed to connect`;
    }
  };

  // Fetch traffic data between two locations
  const fetchTrafficData = async (
    origin: { name: string; lat?: number; lng?: number },
    dest: { name: string; lat?: number; lng?: number }
  ): Promise<string | null> => {
    if (!origin.lat || !origin.lng || !dest.lat || !dest.lng) return null;
    try {
      const res = await fetch(`/api/traffic?originLat=${origin.lat}&originLng=${origin.lng}&destLat=${dest.lat}&destLng=${dest.lng}&originName=${encodeURIComponent(origin.name)}&destName=${encodeURIComponent(dest.name)}`);
      const data = await res.json();
      console.log(`[Traffic Client] ${origin.name} → ${dest.name} API response:`, data);
      if (data.error) {
        // Return error with source so AI can report which API failed
        return `Error from ${data.source || 'Traffic API'}: ${data.error}`;
      }
      const result = `${data.route}: ${data.totalMinutes} minutes (${data.trafficDelayMinutes} min delay), traffic is ${data.trafficLevel}`;
      console.log(`[Traffic Client] Formatted result: ${result}`);
      return result;
    } catch (err) {
      console.error(`[Traffic Client] Error fetching ${origin.name} → ${dest.name}:`, err);
      return `Error from Google Routes API: Failed to connect`;
    }
  };

  const sendMessage = async (text: string, isVoice: boolean) => {
    const userMessage: Message = { id: uuidv4(), role: 'user', content: text };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setLastQuery(text);  // Track for emoji shortcuts

    try {
      // Build context with locations
      const contextData = buildContext();
      
      // If user asks about weather/traffic, proactively fetch the data
      console.log('[Chat] Checking if weather/traffic query...');
      console.log('[Chat] Query text:', text);
      console.log('[Chat] isWeatherOrTrafficQuery result:', isWeatherOrTrafficQuery(text));
      
      if (isWeatherOrTrafficQuery(text)) {
        const locations = state.locations || [];
        console.log('[Chat] Weather/traffic query detected.');
        console.log('[Chat] Total locations:', locations.length);
        console.log('[Chat] Locations array:', JSON.stringify(locations.map(l => ({ name: l.name, lat: l.lat, lng: l.lng, isHome: l.isHome }))));
        const weatherResults: string[] = [];
        const trafficResults: string[] = [];
        
        // Check if user provided an address in their message
        const addressMatch = text.match(/(\d+[^,]+,\s*[A-Z]{2}\s*\d{5})/i) || text.match(/at\s+([^?]+)/i);
        if (addressMatch) {
          const userAddress = addressMatch[1].trim();
          console.log('[Chat] User provided address:', userAddress);
          const result = await fetchWeatherData({ name: 'Requested Location', address: userAddress });
          if (result) weatherResults.push(result);
        }
        
        // Fetch weather for all locations with addresses
        const locationsWithAddresses = locations.filter(l => l.address);
        console.log('[Chat] Locations with addresses:', locationsWithAddresses.length);
        locationsWithAddresses.forEach(l => console.log(`  - ${l.name}: ${l.address}`));
        
        for (const loc of locationsWithAddresses) {
          const result = await fetchWeatherData(loc);
          if (result) weatherResults.push(result);
        }
        
        // Fetch traffic bidirectionally between home and other locations
        // This gives AI both directions to intelligently pick based on time of day
        const homeLocation = locations.find(l => l.isHome);
        console.log('[Chat] Home location:', homeLocation ? `${homeLocation.name} - lat: ${homeLocation.lat}, lng: ${homeLocation.lng}` : 'not found');
        if (homeLocation?.lat && homeLocation?.lng) {
          const otherLocations = locations.filter(l => l.id !== homeLocation.id && l.lat && l.lng);
          console.log('[Chat] Other locations with coords:');
          otherLocations.forEach(l => console.log(`  - ${l.name}: lat=${l.lat}, lng=${l.lng}`));
          for (const loc of otherLocations) {
            console.log(`[Chat] Fetching traffic: ${homeLocation.name} (${homeLocation.lat},${homeLocation.lng}) → ${loc.name} (${loc.lat},${loc.lng})`);
            // Fetch Home → Location
            const toResult = await fetchTrafficData(homeLocation, loc);
            if (toResult) trafficResults.push(toResult);
            // Fetch Location → Home (reverse direction)
            const fromResult = await fetchTrafficData(loc, homeLocation);
            if (fromResult) trafficResults.push(fromResult);
          }
        } else {
          console.log('[Chat] Home location missing coordinates - traffic cannot be fetched');
        }
        
        console.log('[Chat] Weather results:', weatherResults);
        console.log('[Chat] Traffic results:', trafficResults);
        
        if (weatherResults.length > 0) {
          contextData.weatherData = weatherResults.join('\n');
        } else {
          // No configured locations returned weather, note this for debugging
          console.log('[Chat] No weather data fetched. Locations array was:', locations.length > 0 ? 'populated' : 'empty');
        }
        if (trafficResults.length > 0) {
          contextData.trafficData = trafficResults.join('\n');
          console.log('[Chat] ========== TRAFFIC DATA SENT TO AI ==========');
          console.log(contextData.trafficData);
          console.log('[Chat] ==============================================');
        } else {
          console.log('[Chat] WARNING: No traffic data fetched - AI will have no traffic info!');
        }
        
        console.log('[Chat] Final context weatherData:', contextData.weatherData);
      }

      // Log what we're about to send to AI
      console.log('[Chat] ========== SENDING TO AI ==========');
      console.log('[Chat] Context has trafficData:', !!contextData.trafficData);
      console.log('[Chat] Context has weatherData:', !!contextData.weatherData);
      if (contextData.trafficData) {
        console.log('[Chat] trafficData being sent:', contextData.trafficData);
      }
      console.log('[Chat] =====================================');

      const payload = {
        messages: [...messages, userMessage].map(m => ({ role: m.role, content: m.content })),
        context: contextData,
        mode: isVoice ? 'voice' : 'text',
        language: language === 'ko-KR' ? 'ko' : 'en',
      };
      console.log('[Chat] FULL PAYLOAD being sent:', JSON.stringify(payload.context, null, 2));

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get response');
      }

      const data = await response.json();
      const assistantContent = data.content || '';
      const responseLanguage = data.language || 'en';
      const provider = data.provider || 'OpenAI';

      const assistantMessage: Message = {
        id: uuidv4(),
        role: 'assistant',
        content: assistantContent,
        language: responseLanguage,
        provider: provider,
      };
      setMessages(prev => [...prev, assistantMessage]);

      // Speak response if in voice mode
      if (isVoice && synthSupported) {
        const cleanContent = assistantContent.replace(/<action>[\s\S]*?<\/action>/g, '').replace(/<tool>[\s\S]*?<\/tool>/g, '').trim();
        speak(cleanContent, responseLanguage === 'ko' ? 'ko-KR' : 'en-US');
      }

      // Check for actions
      const actionMatch = assistantContent.match(/<action>([\s\S]*?)<\/action>/);
      if (actionMatch) {
        try {
          const action = JSON.parse(actionMatch[1]) as AIAction;
          setPendingActions(prev => [...prev, action]);
        } catch { /* ignore parse errors */ }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setMessages(prev => [...prev, {
        id: uuidv4(),
        role: 'assistant',
        content: `Sorry, I encountered an error: ${errorMessage}`,
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  // Quick action handlers
  const handleQuickAction = async (action: string) => {
    await sendMessage(action, voiceMode);
  };

  const handleMorningBrief = async () => {
    // Morning briefing includes daughter's weather and Home → Church traffic
    const query = language === 'ko-KR' 
      ? '오늘 아침 브리핑 해줘. 모든 위치(딸 위치 포함) 날씨, 집에서 회사/교회 교통, 오늘 일정 알려줘.'
      : 'Give me a morning briefing with weather for all locations including Daughter\'s location, traffic from Home to Work and Home to Church, and today\'s schedule.';
    await sendMessage(query, voiceMode);
  };

  const handleEveningBrief = async () => {
    // Evening briefing focuses on traffic back home
    const query = language === 'ko-KR' 
      ? '저녁 브리핑 해줘. 회사에서 집, 교회에서 집 실시간 교통 정보 알려줘.'
      : 'Give me an evening briefing with real-time traffic from Work to Home and from Church to Home.';
    await sendMessage(query, voiceMode);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const parseLocalDate = (dateStr: string): string => {
    const [year, month, day] = dateStr.split('-').map(Number);
    const localDate = new Date(year, month - 1, day, 12, 0, 0);
    return localDate.toISOString();
  };

  const executeAction = async (action: AIAction) => {
    console.log('[executeAction] Called with action:', JSON.stringify(action));
    
    switch (action.type) {
      case 'add-event':
        if (action.startDate && action.endDate && action.title) {
          console.log('[executeAction] Adding event:', action.title);
          addEvent({
            id: uuidv4(),
            title: action.title,
            description: action.description || action.notes || '',
            startDate: parseLocalDate(action.startDate),
            endDate: parseLocalDate(action.endDate),
            allDay: true,
            type: action.eventType || 'ai-suggestion',
            memberId: AI_MEMBER_ID,
            source: 'manual',
          });
        } else {
          console.warn('[executeAction] add-event missing required fields:', { startDate: action.startDate, endDate: action.endDate, title: action.title });
        }
        break;
      case 'add-flight-restriction': {
        const member = state.familyMembers.find(m => m.name.toLowerCase() === action.memberName?.toLowerCase());
        if (member && action.startDate && action.endDate) {
          addEvent({
            id: uuidv4(),
            title: action.title || 'Flight Restriction',
            description: action.description || '',
            startDate: parseLocalDate(action.startDate),
            endDate: parseLocalDate(action.endDate),
            allDay: true,
            type: 'flight-restriction',
            memberId: member.id,
            source: 'manual',
          });
        }
        break;
      }
      case 'add-bulk-flight-restrictions': {
        const member = state.familyMembers.find(m => m.name.toLowerCase() === action.memberName?.toLowerCase());
        if (member && action.restrictions) {
          action.restrictions.forEach(r => {
            addEvent({
              id: uuidv4(),
              title: r.title || 'Flight Restriction',
              description: '',
              startDate: parseLocalDate(r.startDate),
              endDate: parseLocalDate(r.endDate),
              allDay: true,
              type: 'flight-restriction',
              memberId: member.id,
              source: 'manual',
            });
          });
        }
        break;
      }
      case 'add-travel-window':
        if (action.startDate && action.endDate && action.title) {
          const planId = uuidv4();
          addTravelPlan({
            id: planId,
            title: action.title,
            startDate: parseLocalDate(action.startDate),
            endDate: parseLocalDate(action.endDate),
            participants: state.familyMembers.map(m => m.id),
            notes: action.notes,
          });
          addEvent({
            id: `travel-${planId}`,
            title: action.title,
            description: action.notes,
            startDate: parseLocalDate(action.startDate),
            endDate: parseLocalDate(action.endDate),
            allDay: true,
            type: 'travel',
            memberId: AI_MEMBER_ID,
            source: 'manual',
          });
        }
        break;
      case 'add-family-member':
        if (action.name) {
          const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
          addFamilyMember({
            id: uuidv4(),
            name: action.name,
            color: colors[state.familyMembers.length % colors.length],
          });
        }
        break;
      case 'remove-flight-restriction': {
        const member = state.familyMembers.find(m => m.name.toLowerCase() === action.memberName?.toLowerCase());
        if (member && action.title) {
          const event = state.events.find(e => 
            e.type === 'flight-restriction' && e.memberId === member.id && 
            e.title.toLowerCase() === action.title!.toLowerCase()
          );
          if (event) removeEvent(event.id);
        }
        break;
      }
      case 'remove-travel-window':
        if (action.title) {
          const plan = state.travelPlans.find(p => p.title.toLowerCase() === action.title!.toLowerCase());
          if (plan) {
            state.events.filter(e => e.type === 'travel' && e.id.startsWith(`travel-${plan.id}`))
              .forEach(e => removeEvent(e.id));
            removeTravelPlan(plan.id);
          }
        }
        break;
      default:
        console.warn('[executeAction] Unknown action type:', action.type);
    }
    console.log('[executeAction] Action processed, removing from pending list');
    setPendingActions(prev => prev.filter(a => a !== action));
  };

  const dismissAction = (action: AIAction) => {
    setPendingActions(prev => prev.filter(a => a !== action));
  };

  const formatMessageContent = (content: string) => {
    return content.replace(/<action>[\s\S]*?<\/action>/g, '').replace(/<tool>[\s\S]*?<\/tool>/g, '').trim();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-3 sm:px-6 py-2 sm:py-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-primary-500 to-purple-700 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0">
            <Calendar className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-bold text-gray-900 truncate">{t.appName}</h1>
            <p className="text-[10px] sm:text-xs text-gray-500 hidden sm:block">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 sm:gap-3">
          <button onClick={() => setShowAddEvent(true)} className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm bg-green-600 text-white rounded-lg hover:bg-green-700">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">{t.addEvent}</span>
          </button>
          <button onClick={() => setShowBulkImport(true)} className="hidden sm:flex p-1.5 sm:p-2 hover:bg-gray-100 rounded-lg transition-colors" title="Bulk Import">
            <Upload className="w-5 h-5 text-gray-600" />
          </button>
          <button onClick={() => setShowEventTypeManager(true)} className="hidden sm:flex p-1.5 sm:p-2 hover:bg-purple-100 rounded-lg transition-colors" title="Manage Event Types">
            <Tag className="w-5 h-5 text-purple-600" />
          </button>
          <button onClick={() => setShowLocationsSettings(true)} className="flex p-1.5 sm:p-2 hover:bg-blue-100 rounded-lg transition-colors" title="Manage Locations">
            <MapPin className="w-5 h-5 text-blue-600" />
          </button>
          <button onClick={() => setShowFamilySettings(true)} className="p-1.5 sm:p-2 hover:bg-gray-100 rounded-lg transition-colors" title="Family Settings">
            <Users className="w-5 h-5 text-gray-600" />
          </button>
          {storageInfo && (
            <div className="hidden sm:flex items-center gap-1 px-2 py-1 text-xs text-gray-500 bg-gray-50 rounded-lg" title="Redis storage">
              <Database className="w-3.5 h-3.5" />
              <span>{storageInfo.keySizeFormatted}</span>
            </div>
          )}
          {/* Language toggle */}
          <button
            onClick={() => changeLanguage(language === 'en-US' ? 'ko-KR' : 'en-US')}
            className="px-2 py-1 text-xs font-medium border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            {language === 'en-US' ? 'EN' : '한국어'}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Calendar Section */}
        <div className="flex-1 p-2 sm:p-4 overflow-auto">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 h-full flex flex-col">
            {/* Calendar Header */}
            <div className="px-2 sm:px-4 py-2 sm:py-3 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-sm sm:text-lg font-semibold text-gray-800">{format(currentDate || new Date(), 'MMM yyyy')}</h2>
              <div className="flex items-center gap-0.5 sm:gap-1">
                <button onClick={() => setCurrentDate(subMonths(currentDate || new Date(), 1))} className="p-1.5 sm:p-2 hover:bg-gray-100 rounded-lg">
                  <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" />
                </button>
                <button onClick={() => setCurrentDate(new Date())} className="px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm font-medium text-primary-600 hover:bg-primary-50 rounded-lg">{t.today}</button>
                <button onClick={() => setCurrentDate(addMonths(currentDate || new Date(), 1))} className="p-1.5 sm:p-2 hover:bg-gray-100 rounded-lg">
                  <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" />
                </button>
              </div>
            </div>

            {/* Day Headers */}
            <div className="grid grid-cols-7 border-b border-gray-200">
              {[t.sun, t.mon, t.tue, t.wed, t.thu, t.fri, t.sat].map((day, i) => (
                <div key={i} className="px-0.5 sm:px-2 py-1 sm:py-2 text-center text-[10px] sm:text-xs font-medium text-gray-500">
                  <span className="sm:hidden">{day.charAt(0)}</span>
                  <span className="hidden sm:inline">{day}</span>
                </div>
              ))}
            </div>

            {/* Calendar Grid */}
            <div className="flex-1 grid grid-cols-7 grid-rows-6">
              {days.map((day) => {
                const dayEvents = getEventsForDay(day);
                const isCurrentMonth = isSameMonth(day, currentDate || new Date());
                const isToday = isSameDay(day, new Date());
                const isSelected = selectedDate && isSameDay(day, selectedDate);

                return (
                  <div
                    key={day.toISOString()}
                    onClick={() => {
                      setSelectedDate(day);
                      if (isMobile) setShowMobileDateDetails(true);
                    }}
                    className={`min-h-[50px] sm:min-h-[80px] p-0.5 sm:p-1 border-b border-r border-gray-100 cursor-pointer transition-colors ${
                      !isCurrentMonth ? 'bg-gray-50' : 'hover:bg-gray-50'
                    } ${isSelected ? 'bg-primary-50 ring-2 ring-primary-500 ring-inset' : ''}`}
                  >
                    <div className={`w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center rounded-full text-[10px] sm:text-xs mb-0.5 sm:mb-1 ${
                      isToday ? 'bg-primary-600 text-white' : isCurrentMonth ? 'text-gray-900' : 'text-gray-400'
                    }`}>
                      {format(day, 'd')}
                    </div>
                    <div className="space-y-0.5">
                      {dayEvents.slice(0, isMobile ? 2 : 3).map((event) => (
                        <div
                          key={event.id}
                          className="text-[8px] sm:text-[10px] px-0.5 sm:px-1.5 py-0.5 rounded truncate text-white flex items-center gap-0.5"
                          style={{ backgroundColor: getEventTypeColor(event.type, state.customEventTypes || [], state.builtInTypeOverrides) }}
                          title={`${getMembersForEvent(event).map(id => getMemberName(id)).join(', ')}: ${event.title}`}
                        >
                          <span className="truncate">{event.title}</span>
                          {getMembersForEvent(event).length > 1 ? (
                            <span className="font-bold opacity-75 hidden sm:inline">({getMembersForEvent(event).length})</span>
                          ) : (
                            <span className="font-bold opacity-75 hidden sm:inline">({getMemberInitial(event.memberId)})</span>
                          )}
                        </div>
                      ))}
                      {dayEvents.length > (isMobile ? 2 : 3) && (
                        <div className="text-[8px] sm:text-[10px] text-gray-500 px-0.5 sm:px-1">+{dayEvents.length - (isMobile ? 2 : 3)}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div className="px-2 sm:px-4 py-1.5 sm:py-2 border-t border-gray-200 flex items-center justify-center sm:justify-start gap-2 sm:gap-4 text-[10px] sm:text-xs">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-green-500" />
                <span className="text-gray-600">{t.school}</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full" style={{ backgroundColor: BUILT_IN_EVENT_TYPES['flight-restriction'].color }} />
                <span className="text-gray-600">{t.noTravel}</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full" style={{ backgroundColor: BUILT_IN_EVENT_TYPES['travel'].color }} />
                <span className="text-gray-600">{t.trip}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Chat FAB - Floating button at bottom */}
        <button
          onClick={() => setShowMobileChat(true)}
          className="lg:hidden fixed bottom-6 right-6 z-30 w-16 h-16 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full shadow-lg flex items-center justify-center active:scale-95 transition-transform"
        >
          <Bot className="w-8 h-8 text-white" />
          {messages.length > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-white text-xs flex items-center justify-center font-bold">
              {messages.length > 9 ? '9+' : messages.length}
            </span>
          )}
        </button>

        {/* Mobile backdrop overlay */}
        {showMobileChat && (
          <div 
            className="lg:hidden fixed inset-0 bg-black/30 z-30"
            onClick={() => setShowMobileChat(false)}
          />
        )}

        {/* AI Chat Section - Bottom sheet on mobile, side panel on desktop */}
        <div className={`
          fixed lg:relative z-40 lg:z-auto
          inset-x-0 bottom-0 lg:inset-auto
          h-[85vh] lg:h-auto
          lg:w-[380px] xl:w-[420px] 
          border-t lg:border-t-0 lg:border-l border-gray-200 
          bg-white flex flex-col 
          transition-transform duration-300 ease-out
          rounded-t-3xl lg:rounded-none
          shadow-[0_-4px_20px_rgba(0,0,0,0.15)] lg:shadow-none
          ${showMobileChat ? 'translate-y-0' : 'translate-y-full lg:translate-y-0'}
        `}>
          {/* Mobile drag handle */}
          <div className="lg:hidden flex justify-center py-2">
            <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
          </div>

          {/* Chat Header */}
          <div className="px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-purple-600 to-blue-600">
            <div className="flex items-center gap-2 text-white">
              <Bot className="w-5 h-5" />
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{t.aiAssistant}</span>
                  <span className="px-2 py-0.5 text-[10px] bg-white/20 rounded-full">OpenAI</span>
                </div>
                <span className="text-[10px] opacity-75">{t.voiceCalendarWeather}</span>
              </div>
              {/* Voice mode toggle */}
              <button
                onClick={() => setVoiceMode(!voiceMode)}
                className={`ml-auto p-3 rounded-full transition-colors ${voiceMode ? 'bg-white/20' : 'hover:bg-white/10'}`}
                title={voiceMode ? 'Voice mode on' : 'Voice mode off'}
              >
                {voiceMode ? <Volume2 className="w-5 h-5" /> : <MicOff className="w-5 h-5 opacity-60" />}
              </button>
              {/* Mobile close button - inline with voice toggle */}
              <button onClick={() => setShowMobileChat(false)} className="lg:hidden p-3 rounded-full hover:bg-white/10">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Persistent Briefing Buttons */}
          <div className="px-4 py-2 border-b border-gray-200 flex gap-2">
            <button
              onClick={handleMorningBrief}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 bg-gradient-to-r from-amber-400 to-orange-400 text-white rounded-xl hover:from-amber-500 hover:to-orange-500 shadow-sm transition-all text-sm font-medium"
            >
              <span>🌅</span>
              <span>{language === 'ko-KR' ? '아침 브리핑' : 'Morning Brief'}</span>
            </button>
            <button
              onClick={handleEveningBrief}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl hover:from-indigo-600 hover:to-purple-600 shadow-sm transition-all text-sm font-medium"
            >
              <span>🌙</span>
              <span>{language === 'ko-KR' ? '저녁 브리핑' : 'Evening Brief'}</span>
            </button>
          </div>

          {/* Emoji Quick Actions */}
          <EmojiQuickActions
            onMorningBrief={handleMorningBrief}
            onWeather={(loc) => handleQuickAction(`What's the weather at ${loc}?`)}
            onTraffic={(origin, dest) => handleQuickAction(`How's the traffic from ${origin} to ${dest}?`)}
            onTime={() => handleQuickAction("What time is it?")}
            onSmartQuery={(query) => handleQuickAction(query)}
            locations={state.locations || []}
            language={language}
            recentQuery={lastQuery}
          />

          {/* Selected Date Info */}
          {selectedDate && (
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
              <p className="text-sm font-medium text-gray-700">{format(selectedDate, 'EEEE, MMMM d, yyyy')}</p>
              {selectedDayEvents.length > 0 ? (
                <div className="mt-2 space-y-1">
                  {selectedDayEvents.map(event => (
                    <div key={event.id} className="flex items-center gap-2 text-xs group">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: getEventTypeColor(event.type, state.customEventTypes || [], state.builtInTypeOverrides) }} />
                      <span className="text-gray-600 truncate flex-1">{event.title}</span>
                      <button onClick={() => setEditingEvent(event)} className="opacity-0 group-hover:opacity-100 p-1 hover:bg-amber-100 rounded text-amber-600 transition-all" title="Edit">
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button onClick={() => removeEvent(event.id)} className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 rounded text-red-500 transition-all" title="Delete">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-500 mt-1">{t.noEvents}</p>
              )}
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <div className="text-center py-6">
                <Bot className="w-12 h-12 text-purple-200 mx-auto mb-3" />
                <p className="text-gray-600 font-medium">
                  {language === 'ko-KR' ? `안녕하세요! FamilyHub AI입니다.` : `Hi! I'm FamilyHub AI.`}
                </p>
                <p className="text-gray-500 text-sm mt-2 max-w-xs mx-auto">
                  {t.assistantHelp}
                </p>
                <div className="mt-4 space-y-2">
                  <button onClick={() => setInput(language === 'ko-KR' ? "언제 함께 여행할 수 있을까요?" : "When can we all travel together?")} className="w-full text-left text-sm px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700">
                    {t.whenTravel}
                  </button>
                  <button onClick={() => handleMorningBrief()} className="w-full text-left text-sm px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700">
                    {t.morningBrief}
                  </button>
                </div>
              </div>
            )}

            {messages.map((message) => (
              <div key={message.id} className={`flex gap-2 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                  message.role === 'user' ? 'bg-primary-100 text-primary-600' : 'bg-purple-100 text-purple-600'
                }`}>
                  {message.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>
                <div className="flex flex-col gap-1">
                  <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm ${
                    message.role === 'user' ? 'bg-primary-600 text-white rounded-br-md' : 'bg-gray-100 text-gray-800 rounded-bl-md'
                  }`}>
                    <p className="whitespace-pre-wrap">{formatMessageContent(message.content)}</p>
                  </div>
                  {message.provider && (
                    <span className="text-[10px] text-gray-400 ml-1">{message.provider}</span>
                  )}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-2">
                <div className="w-7 h-7 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="bg-gray-100 rounded-2xl rounded-bl-md px-3 py-2">
                  <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                </div>
              </div>
            )}

            {/* Pending Actions */}
            {pendingActions.map((action, index) => (
              <div key={index} className="bg-purple-50 border border-purple-200 rounded-xl p-3">
                <p className="text-sm font-medium text-purple-800 mb-2">
                  {action.type === 'add-event' && <span className="flex items-center gap-1"><Bot className="w-4 h-4" />AI suggestion: {action.title}</span>}
                  {action.type === 'add-flight-restriction' && <span className="flex items-center gap-1"><Plane className="w-4 h-4" />Add restriction for {action.memberName}</span>}
                  {action.type === 'add-travel-window' && <span className="flex items-center gap-1"><Palmtree className="w-4 h-4" />Travel window: {action.title}</span>}
                </p>
                {action.startDate && action.endDate && (
                  <p className="text-xs text-purple-600 mb-2">
                    {format(new Date(action.startDate + 'T12:00:00'), 'MMM d')} - {format(new Date(action.endDate + 'T12:00:00'), 'MMM d, yyyy')}
                  </p>
                )}
                <div className="flex gap-2">
                  <button onClick={() => executeAction(action)} className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700">
                    <Check className="w-4 h-4" />{t.confirm}
                  </button>
                  <button onClick={() => dismissAction(action)} className="px-3 py-1.5 border border-purple-300 text-purple-700 text-sm rounded-lg hover:bg-purple-100">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}

            <div ref={messagesEndRef} />
          </div>

          {/* Input with Voice */}
          <div className="p-4 border-t border-gray-200">
            {/* Large Voice Button - Always show, alert if unsupported on iOS PWA */}
            <button
              type="button"
              onClick={() => {
                if (!speechSupported && speechError) {
                  alert(speechError);
                  return;
                }
                if (isListening) {
                  stopListening();
                } else {
                  startListening();
                }
              }}
              className={`w-full mb-3 py-4 rounded-2xl transition-all flex items-center justify-center gap-3 text-lg font-medium ${
                !speechSupported
                  ? 'bg-gray-400 text-white'
                  : isListening 
                    ? 'bg-red-500 text-white animate-pulse shadow-lg' 
                    : 'bg-gradient-to-r from-purple-500 to-purple-600 text-white hover:from-purple-600 hover:to-purple-700 shadow-md'
              }`}
              disabled={isSpeaking || isLoading}
            >
              {isListening ? (
                <>
                  <MicOff className="w-6 h-6" />
                  <span>{t.tapToStop}</span>
                </>
              ) : (
                <>
                  <Mic className="w-6 h-6" />
                  <span>{!speechSupported ? (language === 'ko-KR' ? '음성 사용불가' : 'Voice Unavailable') : t.tapToSpeak}</span>
                </>
              )}
            </button>
            
            {/* Text Input */}
            <form onSubmit={handleSubmit} className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={isListening ? t.listening : t.typeMessage}
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none text-sm"
                disabled={isLoading || isListening}
              />
              <button type="submit" disabled={isLoading || !input.trim()} className="px-4 py-2.5 bg-purple-600 text-white rounded-xl hover:bg-purple-700 disabled:opacity-50">
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Mobile Date Details Drawer */}
      {showMobileDateDetails && selectedDate && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/30 z-50"
            onClick={() => setShowMobileDateDetails(false)}
          />
          {/* Bottom Sheet */}
          <div className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl shadow-[0_-4px_20px_rgba(0,0,0,0.15)] max-h-[70vh] flex flex-col animate-slide-up">
            {/* Drag handle */}
            <div className="flex justify-center py-2 flex-shrink-0">
              <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
            </div>
            
            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
              <div>
                <p className="text-lg font-semibold text-gray-900">{format(selectedDate, 'EEEE')}</p>
                <p className="text-sm text-gray-500">{format(selectedDate, 'MMMM d, yyyy')}</p>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => {
                    setShowMobileDateDetails(false);
                    setShowAddEvent(true);
                  }}
                  className="p-2 bg-green-100 text-green-600 rounded-full hover:bg-green-200 transition-colors"
                  title="Add Event"
                >
                  <Plus className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => setShowMobileDateDetails(false)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            </div>
            
            {/* Events List */}
            <div className="flex-1 overflow-y-auto p-4">
              {selectedDayEvents.length > 0 ? (
                <div className="space-y-3">
                  {selectedDayEvents.map(event => {
                    const memberIds = getMembersForEvent(event);
                    return (
                      <div 
                        key={event.id} 
                        className="bg-gray-50 rounded-xl p-4 border border-gray-200"
                      >
                        <div className="flex items-start gap-3">
                          {/* Color indicator */}
                          <div 
                            className="w-3 h-full min-h-[40px] rounded-full flex-shrink-0"
                            style={{ backgroundColor: getEventTypeColor(event.type, state.customEventTypes || [], state.builtInTypeOverrides) }}
                          />
                          
                          {/* Event details */}
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-gray-900 text-base">{event.title}</h3>
                            
                            {/* Date range */}
                            <p className="text-sm text-gray-500 mt-1">
                              {format(parseISO(event.startDate), 'MMM d')}
                              {event.startDate !== event.endDate && ` - ${format(parseISO(event.endDate), 'MMM d')}`}
                            </p>
                            
                            {/* Members */}
                            <div className="flex items-center gap-1 mt-2">
                              {memberIds.length > 1 ? (
                                <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">
                                  👥 {memberIds.map(id => getMemberName(id)).join(', ')}
                                </span>
                              ) : (
                                <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">
                                  {getMemberInitial(event.memberId)} {getMemberName(event.memberId)}
                                </span>
                              )}
                              {event.type && (
                                <span className="text-xs bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full capitalize">
                                  {event.type.replace('-', ' ')}
                                </span>
                              )}
                            </div>
                            
                            {/* Description */}
                            {event.description && (
                              <p className="text-sm text-gray-600 mt-2 line-clamp-2">{event.description}</p>
                            )}
                          </div>
                        </div>
                        
                        {/* Action buttons */}
                        <div className="flex gap-2 mt-3 pt-3 border-t border-gray-200">
                          <button 
                            onClick={() => {
                              setShowMobileDateDetails(false);
                              setEditingEvent(event);
                            }}
                            className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-amber-50 text-amber-600 rounded-lg hover:bg-amber-100 transition-colors"
                          >
                            <Pencil className="w-4 h-4" />
                            <span className="font-medium">{t.edit}</span>
                          </button>
                          <button 
                            onClick={() => {
                              if (confirm(t.deleteEvent)) {
                                removeEvent(event.id);
                              }
                            }}
                            className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                            <span className="font-medium">{t.delete}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Calendar className="w-8 h-8 text-gray-400" />
                  </div>
                  <p className="text-gray-600 font-medium">{t.noEventsThisDay}</p>
                  <p className="text-gray-500 text-sm mt-1">{t.availableForActivities}</p>
                  <button 
                    onClick={() => {
                      setShowMobileDateDetails(false);
                      setShowAddEvent(true);
                    }}
                    className="mt-4 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors inline-flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    {t.addEvent}
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Modals */}
      {showBulkImport && <BulkImportModal onClose={() => setShowBulkImport(false)} />}
      {showFamilySettings && <FamilySettingsModal onClose={() => setShowFamilySettings(false)} />}
      {showLocationsSettings && <LocationsSettingsModal onClose={() => setShowLocationsSettings(false)} />}
      {showEventTypeManager && <EventTypeManager onClose={() => setShowEventTypeManager(false)} />}
      {(showAddEvent || editingEvent) && (
        <AddEventModal 
          onClose={() => { setShowAddEvent(false); setEditingEvent(null); }} 
          initialDate={selectedDate || undefined}
          editEvent={editingEvent || undefined}
          onManageTypes={() => { setShowAddEvent(false); setEditingEvent(null); setShowEventTypeManager(true); }}
        />
      )}
    </div>
  );
}
