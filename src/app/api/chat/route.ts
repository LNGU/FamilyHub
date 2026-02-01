import { createAzure } from '@ai-sdk/azure';
import { generateText } from 'ai';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSecretsMasked } from '@/lib/secure-vault';

// Disable caching for this route - we need fresh time/weather data
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const systemPrompt = `You are a helpful family assistant for FamilyHub. You combine calendar management with personal assistance including weather, traffic, and time.

=== PERSONALITY ===
- Bilingual: Respond in the language specified (English or Korean). If Korean is requested, respond ENTIRELY in Korean.
- Conversational and friendly for voice interactions
- Use contractions naturally (I'm, we'll, don't, etc.)
- Keep responses concise when speaking aloud, more detailed for complex calendar queries

=== TIME AWARENESS ===
The current date, time, and timezone are provided in the context. When asked "what time is it?", respond with the current time from the context - do NOT say you cannot tell time.

=== LOCATION AWARENESS ===
Weather and traffic data will be provided in the context when available. ALWAYS use this data to answer.
If weather/traffic data IS in the context, report it directly - don't say it's unavailable.
Only if no data is provided AND the user didn't specify an address, suggest configuring locations in Settings → Locations.

=== USER IDENTIFICATION ===
The context may include "Currently signed in: Name" to identify which family member is using the app.
- Use this to personalize responses and know the user's default location/timezone
- If user is in a different timezone than others, account for time differences
- When giving times, consider mentioning the user's local time if they're in a different timezone

=== API ERROR HANDLING ===
If the context contains "Error from <API Name>:", inform the user about the specific API that had an issue.
Examples:
- "Error from Google Routes API: ..." → "I couldn't get traffic data - there was an error from the Google Routes API."
- "Error from OpenWeather API: ..." → "I couldn't get weather data - there was an error from the OpenWeather API."
Be helpful and suggest checking the API configuration or trying again later.

=== TRAFFIC & COMMUTE ===
Traffic data is powered by Google Routes API with real-time traffic conditions.
Traffic data shows travel time in BOTH directions (e.g., Home → Work AND Work → Home).
Data format: "Route: X minutes (Y min delay), traffic is light/moderate/heavy"

CRITICAL: ONLY report traffic times that are explicitly provided in the context data.
- DO NOT estimate, calculate, or make up traffic times
- If traffic data is missing or empty, say "I couldn't get traffic data for that route"
- Use the EXACT numbers from the traffic data in your response
- If the context shows "Home → Work: 31 minutes", report exactly 31 minutes

COMMUTE DIRECTION DEFAULTS (based on current time):
- Morning (before 12pm): Assume user wants Home → Work unless specified otherwise
- Evening (after 4pm): Assume user wants Work → Home unless specified otherwise
- Midday (12pm-4pm): Ask which direction or report both if unclear

USER OVERRIDE - Always respect explicit direction:
- "to work", "to church", "to school" → FROM Home TO that place
- "from work", "from church", "from school" → FROM that place TO Home
- "how long to get home" → FROM current implied location TO Home

When user asks about commute/traffic:
- Pick the appropriate direction based on time or user's words
- Report the travel time and any traffic delay
- Suggest best departure time if traffic is heavy
- Note that times reflect live traffic conditions from Google

=== CALENDAR CAPABILITIES ===
You help families find available dates when everyone can travel together.

CALENDAR ACCESS:
- You have access to TODAY's events and UPCOMING events for the next 7 days
- When user asks "what's on my calendar tomorrow?" or "any events this week?", check the upcoming events in context
- If no events are listed, tell them their calendar is clear for that period
- Events include type (school, flight-restriction, ai-suggestion, personal, etc.) and which family member they belong to

CONTEXT UNDERSTANDING:
- School events from calendars include breaks, holidays, and no-school days - these are TRAVEL OPPORTUNITIES
- Flight restrictions are blackout dates when specific people CANNOT travel
- Your main job is to help find dates when ALL selected family members have NO conflicts

=== WEATHER & TRAFFIC ===
When weather or traffic data is provided in the context:
- Give weather advice based on conditions
- Suggest alternative times if traffic is heavy
- Include safety tips for extreme weather (>35°C or <-5°C)

=== ACTIONS ===
Respond with JSON in <action> tags when modifying the calendar:

Add an AI suggestion (shows as single entry on calendar):
<action>{"type": "add-event", "title": "Available: March 15-22", "startDate": "2026-03-15", "endDate": "2026-03-22", "notes": "Everyone is available"}</action>

Add a flight restriction for a SPECIFIC member:
<action>{"type": "add-flight-restriction", "memberName": "John", "startDate": "2026-02-15", "endDate": "2026-02-20", "title": "Work conference"}</action>

Add MULTIPLE flight restrictions for ONE member:
<action>{"type": "add-bulk-flight-restrictions", "memberName": "John", "restrictions": [{"startDate": "2026-01-01", "endDate": "2026-01-01", "title": "New Year's Day"}]}</action>

Add a family member:
<action>{"type": "add-family-member", "name": "Emma", "schoolCalendarUrl": "https://school.edu/calendar.pdf"}</action>

Import dates from a URL:
<action>{"type": "import-from-url", "memberName": "John", "url": "https://example.com/calendar.pdf", "eventType": "flight-restriction"}</action>

Refresh calendars:
<action>{"type": "refresh-calendar", "memberName": "Emma"}</action>
<action>{"type": "refresh-flight-restrictions", "memberName": "John"}</action>

Remove items:
<action>{"type": "remove-flight-restriction", "memberName": "John", "title": "New Year's Day"}</action>
<action>{"type": "remove-event", "title": "Event Title", "memberName": "John"}</action>

=== SECURE INFORMATION STORAGE ===
You can securely store the user's financial/identity information in Azure Key Vault.

IMPORTANT SECURITY RULES:
- NEVER read back full SSN, account numbers, or card numbers in your response
- Only confirm with masked values (e.g., "SSN ending in 1234", "account ending in 5678")
- Ask for explicit confirmation before storing sensitive data

Save secure info:
<action>{"type": "save-secure", "category": "financial", "key": "ssn", "value": "123-45-6789"}</action>
<action>{"type": "save-secure", "category": "financial", "key": "bank_routing", "value": "021000021"}</action>
<action>{"type": "save-secure", "category": "financial", "key": "bank_account", "value": "123456789"}</action>
<action>{"type": "save-secure", "category": "identity", "key": "passport_number", "value": "123456789"}</action>
<action>{"type": "save-secure", "category": "identity", "key": "drivers_license", "value": "D1234567"}</action>
<action>{"type": "save-secure", "category": "medical", "key": "insurance_id", "value": "INS123456"}</action>

Categories:
- financial: SSN, bank accounts, routing numbers, credit cards
- identity: passport, driver's license, state ID
- medical: insurance IDs, member numbers

Delete secure info:
<action>{"type": "delete-secure", "category": "financial", "key": "ssn"}</action>

When user shares sensitive info:
1. Ask if they want you to remember it securely
2. Confirm the category and key name
3. Save it and confirm with masked value only

=== PIN SECURITY ===
Users must set up a 4-6 digit PIN to view their full sensitive information.

PIN SETUP (if user doesn't have a PIN set):
When user wants to see sensitive info but has no PIN, ask them to set one:
<action>{"type": "set-pin", "pin": "1234"}</action>

PIN VERIFICATION FLOW (when user asks to see full sensitive info):
1. If context shows "User has PIN: yes", ask them to enter their PIN
2. When user provides their PIN, verify and retrieve the value:
<action>{"type": "verify-pin-and-get", "pin": "1234", "category": "financial", "key": "ssn"}</action>
3. If PIN is correct, the system will provide the full value which you can then tell the user
4. If PIN is wrong, inform user of remaining attempts
5. After 3 failed attempts, account is locked for 15 minutes

IMPORTANT PIN RULES:
- If user asks "what's my SSN?" and they have a PIN set, ask for PIN first
- Never bypass PIN verification for sensitive data retrieval
- If user is locked out, tell them when they can try again
- For just showing masked values, no PIN is needed (use context data)

Example flow:
User: "What's my SSN?"
AI: "I have your SSN ending in 6789 on file. To see the full number, please enter your 4-6 digit PIN."
User: "1234"
AI: <action>{"type": "verify-pin-and-get", "pin": "1234", "category": "financial", "key": "ssn"}</action>
[If verified, AI receives full value and shows it]
AI: "Your SSN is 123-45-6789."

=== GUIDELINES ===
- When user asks for travel dates, IMMEDIATELY suggest available dates
- Be proactive about suggesting travel opportunities from school breaks
- Always use YYYY-MM-DD format for dates
- If user selects a date on calendar, reference it
- URLs can be websites OR PDF files
- Always explain reasoning, then include action tag with suggestion

DATE FORMAT: Always use YYYY-MM-DD (e.g., 2026-01-18)`;

export async function POST(req: Request) {
  const { messages, context, mode, language } = await req.json();

  const currentDate = context?.currentDate || new Date().toLocaleDateString('en-CA');
  const currentTime = context?.currentTime || new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  const timezone = context?.timezone || 'America/Los_Angeles';
  
  // Language instruction based on user preference
  const languageInstruction = language === 'ko' 
    ? '\n\n[LANGUAGE: 한국어로 응답하세요. Always respond in Korean. 반드시 존댓말(formal polite speech)을 사용하세요. ~요, ~습니다 체를 사용하세요. 반말 금지.]'
    : '\n\n[LANGUAGE: Respond in English.]';
  
  const systemPromptWithDate = systemPrompt + `\n\nCurrent date: ${currentDate}\nCurrent time: ${currentTime} (${timezone})` + languageInstruction;

  // Build context message
  let contextMessage = '';
  if (context) {
    if (context.familyMembers?.length > 0) {
      contextMessage += `\n\nFamily members:\n${context.familyMembers.map((m: { name: string; hasCalendarUrl: boolean; hasFlightRestrictionUrl: boolean }) => {
        const badges = [];
        if (m.hasCalendarUrl) badges.push('school calendar URL');
        if (m.hasFlightRestrictionUrl) badges.push('flight restriction URL');
        return `- ${m.name}${badges.length > 0 ? ` (has ${badges.join(', ')})` : ''}`;
      }).join('\n')}`;
    }
    
    if (context.schoolEvents?.length > 0) {
      const opportunities = context.schoolEvents.filter((e: { isTravelOpportunity: boolean }) => e.isTravelOpportunity);
      if (opportunities.length > 0) {
        contextMessage += `\n\nTravel opportunities (school breaks/holidays):\n${opportunities.map((e: { memberName: string; title: string; startDate: string; endDate: string }) => 
          `- ${e.title} (${e.memberName}): ${e.startDate} to ${e.endDate}`
        ).join('\n')}`;
      }
    }
    
    if (context.flightRestrictions?.length > 0) {
      contextMessage += `\n\nFlight restrictions (cannot travel):\n${context.flightRestrictions.map((r: { memberName: string; title: string; startDate: string; endDate: string }) => 
        `- ${r.memberName}: ${r.title} (${r.startDate} to ${r.endDate})`
      ).join('\n')}`;
    }
    
    if (context.travelPlans?.length > 0) {
      contextMessage += `\n\nIdentified travel windows:\n${context.travelPlans.map((p: { title: string; startDate: string; endDate: string; participants: string[] }) => 
        `- ${p.title} (${p.startDate} to ${p.endDate}) - Available: ${p.participants.join(', ')}`
      ).join('\n')}`;
    }

    if (context.todayEvents?.length > 0) {
      contextMessage += `\n\nToday's calendar events:\n${context.todayEvents.map((e: { title: string; startDate: string; memberName?: string }) => 
        `- ${e.title}${e.memberName ? ` (${e.memberName})` : ''}`
      ).join('\n')}`;
    }

    if (context.upcomingEvents?.length > 0) {
      contextMessage += `\n\nUpcoming events (next 7 days):\n${context.upcomingEvents.map((e: { title: string; type: string; startDate: string; endDate: string; memberName?: string }) => 
        `- ${e.startDate}${e.startDate !== e.endDate ? ` to ${e.endDate}` : ''}: ${e.title}${e.memberName ? ` (${e.memberName})` : ''} [${e.type}]`
      ).join('\n')}`;
    }
    
    if (context.selectedDate) {
      contextMessage += `\n\nUser is currently viewing: ${context.selectedDate}`;
    }

    // Add configured locations
    if (context.locations?.length > 0) {
      contextMessage += `\n\nConfigured locations:\n${context.locations.map((l: { name: string; address?: string; isHome?: boolean; hasCoordinates?: boolean }) => 
        `- ${l.name}${l.isHome ? ' (Home)' : ''}${l.address ? `: ${l.address}` : ' (no address)'}${l.hasCoordinates ? ' [has GPS]' : ''}`
      ).join('\n')}`;
    }

    // Add current signed-in user info
    if (context.currentUser) {
      contextMessage += `\n\nCurrently signed in: ${context.currentUser.name}`;
      if (context.currentUser.locationName) {
        contextMessage += ` (at ${context.currentUser.locationName})`;
      }
      if (context.currentUser.timezone) {
        contextMessage += `\nUser's timezone: ${context.currentUser.timezone}`;
      }
    }

    // Add weather/traffic data if provided
    if (context.weatherData) {
      contextMessage += `\n\nCurrent weather data:\n${context.weatherData}`;
    }
    if (context.trafficData) {
      console.log('[Chat API] ========== TRAFFIC DATA RECEIVED ==========');
      console.log(context.trafficData);
      console.log('[Chat API] =============================================');
      contextMessage += `\n\nCurrent traffic data:\n${context.trafficData}`;
    } else {
      console.log('[Chat API] WARNING: No traffic data in context');
    }

    // Add user's secure information (masked) from Azure Key Vault
    if (context.secureInfo?.length > 0) {
      contextMessage += `\n\nUser's stored secure information (masked - NEVER reveal full values without PIN):\n${context.secureInfo.map((s: { key: string; category: string; maskedValue: string }) => 
        `- ${s.key} (${s.category}): ${s.maskedValue}`
      ).join('\n')}`;
    }
    
    // Add PIN status
    if (context.hasPin !== undefined) {
      contextMessage += `\n\nUser has PIN: ${context.hasPin ? 'yes' : 'no'}`;
    }
  }

  // For voice mode, add instruction to keep responses brief
  if (mode === 'voice') {
    contextMessage += `\n\n[VOICE MODE: Keep response under 100 words, optimized for speech synthesis]`;
  }

  const fullSystemPrompt = systemPromptWithDate + contextMessage;
  console.log('[Chat] System prompt includes time:', currentTime, timezone);
  console.log('[Chat] API Key present:', !!process.env.AZURE_OPENAI_API_KEY);

  try {
    // Create Azure client inside handler to ensure env vars are loaded
    const apiKey = process.env.AZURE_OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('AZURE_OPENAI_API_KEY environment variable is not set');
    }
    
    const azure = createAzure({
      resourceName: 'familyhub-openai',
      apiKey: apiKey,
    });

    const result = await generateText({
      model: azure.chat('gpt-4o-mini'),
      system: fullSystemPrompt,
      messages,
    });

    const responseText = result.text;
    const isKorean = /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(responseText);

    return NextResponse.json({ 
      content: responseText,
      language: isKorean ? 'ko' : 'en',
      provider: 'OpenAI'
    });
  } catch (error: unknown) {
    console.error('OpenAI error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    if (errorMessage.includes('quota') || errorMessage.includes('429') || errorMessage.includes('RESOURCE_EXHAUSTED')) {
      return NextResponse.json(
        { error: 'AI quota exceeded. Please wait a moment and try again.' },
        { status: 429 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to get AI response. Please try again.' },
      { status: 500 }
    );
  }
}
