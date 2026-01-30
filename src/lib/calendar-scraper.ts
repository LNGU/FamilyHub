import { CalendarEvent, FamilyMember, ScrapingConfig } from '@/types';
import { v4 as uuidv4 } from 'uuid';

interface ScrapedEvent {
  summary?: string;
  description?: string;
  dtstart?: string | null;
  dtend?: string | null;
}

export async function scrapeCalendarFromUrl(
  url: string,
  memberId: string,
  scrapingConfig?: ScrapingConfig,
  eventType: 'school' | 'flight-restriction' = 'school'
): Promise<CalendarEvent[]> {
  try {
    // Use our API route to scrape the calendar page
    const response = await fetch('/api/calendar/fetch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url, scrapingConfig }),
    });

    const text = await response.text();
    
    // Try to parse as JSON
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      console.error('Invalid JSON response:', text.substring(0, 200));
      throw new Error('Failed to fetch calendar - received invalid response');
    }

    if (!response.ok) {
      throw new Error(data.error || 'Failed to scrape calendar');
    }

    const { events, totalFound, withValidDates } = data;
    
    console.log(`Scraped ${totalFound} events, ${withValidDates} with valid dates`);
    
    return events.map((event: ScrapedEvent) => ({
      id: uuidv4(),
      title: event.summary || (eventType === 'flight-restriction' ? 'Blackout Date' : 'Untitled Event'),
      description: event.description || '',
      startDate: event.dtstart ? new Date(event.dtstart).toISOString() : new Date().toISOString(),
      endDate: event.dtend ? new Date(event.dtend).toISOString() : new Date().toISOString(),
      allDay: true,
      type: eventType,
      memberId,
      source: 'scraped' as const,
      sourceUrl: url,
    }));
  } catch (error) {
    console.error('Error scraping calendar:', error);
    throw error;
  }
}

export async function syncSchoolCalendar(
  member: FamilyMember,
  existingEvents: CalendarEvent[]
): Promise<CalendarEvent[]> {
  if (!member.schoolCalendarUrl) {
    return existingEvents;
  }

  // Remove old scraped school events from this member
  const otherEvents = existingEvents.filter(
    (e) => !(e.memberId === member.id && e.source === 'scraped' && e.type === 'school')
  );

  // Scrape new events
  const newEvents = await scrapeCalendarFromUrl(
    member.schoolCalendarUrl, 
    member.id,
    member.scrapingConfig,
    'school'
  );

  return [...otherEvents, ...newEvents];
}

export async function syncFlightRestrictionsFromUrl(
  member: FamilyMember,
  existingEvents: CalendarEvent[]
): Promise<CalendarEvent[]> {
  if (!member.flightRestrictionUrl) {
    return existingEvents;
  }

  // Remove old scraped flight restriction events from this member
  const otherEvents = existingEvents.filter(
    (e) => !(e.memberId === member.id && e.source === 'scraped' && e.type === 'flight-restriction')
  );

  // Scrape new events
  const newEvents = await scrapeCalendarFromUrl(
    member.flightRestrictionUrl, 
    member.id,
    member.flightRestrictionScrapingConfig,
    'flight-restriction'
  );

  return [...otherEvents, ...newEvents];
}
