import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import { ScrapingConfig } from '@/types';

const datePatterns = [
  /(\d{1,2})\/(\d{1,2})\/(\d{4})/,
  /(\d{4})-(\d{2})-(\d{2})/,
  /(\w+)\s+(\d{1,2}),?\s*(\d{4})?/i,
  /(\d{1,2})\s+(\w+)\s+(\d{4})?/i,
  /(\w+)\s+(\d{1,2})\s*-\s*(\d{1,2}),?\s*(\d{4})?/i,
];

function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  
  const cleaned = dateStr.trim();
  const nativeDate = new Date(cleaned);
  if (!isNaN(nativeDate.getTime())) {
    return nativeDate;
  }

  for (const pattern of datePatterns) {
    const match = cleaned.match(pattern);
    if (match) {
      const parsed = new Date(cleaned);
      if (!isNaN(parsed.getTime())) {
        return parsed;
      }
    }
  }

  return null;
}

const defaultSelectors = {
  eventSelectors: [
    '.event', '.calendar-event', '.event-item', '[class*="event"]',
    '.calendar-item', '.schedule-item', 'article', '.post',
    'tr', 'li', '.card', '[class*="calendar"]'
  ],
  titleSelectors: [
    '.event-title', '.title', 'h2', 'h3', 'h4', '.name',
    '[class*="title"]', '[class*="name"]', 'a', 'strong', '.summary'
  ],
  dateSelectors: [
    '.event-date', '.date', 'time', '[datetime]', '.when',
    '[class*="date"]', '[class*="time"]', '.start-date'
  ],
  descriptionSelectors: [
    '.event-description', '.description', '.details', 'p',
    '[class*="description"]', '[class*="detail"]', '.summary'
  ]
};

interface ScrapedEvent {
  title: string;
  date: string | null;
  description: string;
}

function scrapeWithSelectors(
  $: cheerio.CheerioAPI,
  config?: ScrapingConfig
): ScrapedEvent[] {
  const events: ScrapedEvent[] = [];
  
  const eventSelectors = config?.eventSelector 
    ? [config.eventSelector] 
    : defaultSelectors.eventSelectors;
  
  const titleSelectors = config?.titleSelector
    ? [config.titleSelector]
    : defaultSelectors.titleSelectors;
    
  const dateSelectors = config?.dateSelector
    ? [config.dateSelector]
    : defaultSelectors.dateSelectors;
    
  const descSelectors = config?.descriptionSelector
    ? [config.descriptionSelector]
    : defaultSelectors.descriptionSelectors;

  for (const eventSel of eventSelectors) {
    const containers = $(eventSel);
    
    if (containers.length > 0) {
      containers.each((_, el) => {
        const $el = $(el);
        
        let title = '';
        for (const titleSel of titleSelectors) {
          const titleEl = $el.find(titleSel).first();
          if (titleEl.length) {
            title = titleEl.text().trim();
            if (title) break;
          }
        }
        
        if (!title) {
          title = $el.clone().children().remove().end().text().trim();
        }
        
        let dateStr = '';
        for (const dateSel of dateSelectors) {
          const dateEl = $el.find(dateSel).first();
          if (dateEl.length) {
            dateStr = dateEl.attr('datetime') || dateEl.text().trim();
            if (dateStr) break;
          }
        }
        
        let description = '';
        for (const descSel of descSelectors) {
          const descEl = $el.find(descSel).first();
          if (descEl.length && descEl.text() !== title) {
            description = descEl.text().trim();
            if (description) break;
          }
        }
        
        if (title && title.length > 2) {
          events.push({ title, date: dateStr || null, description });
        }
      });
      
      if (events.length > 0) break;
    }
  }
  
  return events;
}

function scrapeTableFormat($: cheerio.CheerioAPI): ScrapedEvent[] {
  const events: ScrapedEvent[] = [];
  
  $('table').each((_, table) => {
    const $table = $(table);
    
    $table.find('tr').each((_, row) => {
      const $row = $(row);
      const cells = $row.find('td, th');
      
      if (cells.length >= 2) {
        const texts = cells.map((_, cell) => $(cell).text().trim()).get();
        
        for (let i = 0; i < texts.length; i++) {
          const parsed = parseDate(texts[i]);
          if (parsed) {
            const otherTexts = texts.filter((_, idx) => idx !== i).join(' ').trim();
            if (otherTexts) {
              events.push({
                title: otherTexts.substring(0, 200),
                date: texts[i],
                description: ''
              });
            }
            break;
          }
        }
      }
    });
  });
  
  return events;
}

function isPdfUrl(url: string, contentType?: string): boolean {
  return url.toLowerCase().endsWith('.pdf') || 
         contentType?.toLowerCase().includes('application/pdf') || false;
}

export async function POST(request: Request) {
  try {
    const { url, scrapingConfig } = await request.json();

    if (!url) {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      );
    }

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,application/pdf,*/*;q=0.8',
      },
    });
    
    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch page: ${response.status} ${response.statusText}` },
        { status: 400 }
      );
    }

    const contentType = response.headers.get('content-type') || '';
    let scrapedEvents: ScrapedEvent[] = [];

    if (isPdfUrl(url, contentType)) {
      return NextResponse.json(
        { error: 'PDF files are not supported. Please use manual entry or bulk import for calendar events.' },
        { status: 400 }
      );
    } else {
      const html = await response.text();
      const $ = cheerio.load(html);
      
      $('script, style, nav, footer, header').remove();
      
      const plainText = $('body').text().replace(/\s+/g, ' ').trim();
      
      scrapedEvents = scrapeWithSelectors($, scrapingConfig);
      
      if (scrapedEvents.length === 0) {
        scrapedEvents = scrapeTableFormat($);
      }
      
      const events = scrapedEvents
        .map(event => {
          const parsedDate = parseDate(event.date || '');
          return {
            summary: event.title,
            description: event.description,
            dtstart: parsedDate?.toISOString() || null,
            dtend: parsedDate?.toISOString() || null,
          };
        })
        .filter(event => event.dtstart !== null);

      return NextResponse.json({ 
        events,
        totalFound: scrapedEvents.length,
        withValidDates: events.length,
        isPdf: false,
        rawContent: plainText.substring(0, 15000)
      });
    }
  } catch (error) {
    console.error('Error scraping calendar:', error);
    return NextResponse.json(
      { error: 'Failed to scrape calendar page' },
      { status: 500 }
    );
  }
}
