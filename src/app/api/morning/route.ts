import { NextRequest, NextResponse } from 'next/server';

interface LocationParam {
  name: string;
  address?: string;
  lat?: number;
  lng?: number;
}

// Enhanced morning briefing: weather + traffic + today's calendar events
export async function GET(request: NextRequest) {
  const baseUrl = new URL(request.url).origin;
  const { searchParams } = new URL(request.url);
  
  // Optional: pass today's events as query param (JSON encoded)
  const todayEventsParam = searchParams.get('events');
  let todayEvents: Array<{ title: string; startDate: string; memberName?: string }> = [];
  
  if (todayEventsParam) {
    try {
      todayEvents = JSON.parse(decodeURIComponent(todayEventsParam));
    } catch {
      // Ignore parse errors
    }
  }

  // Parse locations from query params (passed from client with user's configured locations)
  const homeParam = searchParams.get('home');
  const workParam = searchParams.get('work');
  
  let homeLocation: LocationParam | null = null;
  let workLocation: LocationParam | null = null;
  
  if (homeParam) {
    try {
      homeLocation = JSON.parse(decodeURIComponent(homeParam));
    } catch { /* ignore */ }
  }
  if (workParam) {
    try {
      workLocation = JSON.parse(decodeURIComponent(workParam));
    } catch { /* ignore */ }
  }

  // If no locations provided, return helpful message
  if (!homeLocation?.address && !workLocation?.address) {
    return NextResponse.json({
      error: 'No locations configured',
      message: 'Please add locations with addresses in the Locations settings to get weather and traffic updates.'
    }, { status: 400 });
  }

  try {
    const promises: Promise<Response>[] = [];
    
    // Fetch weather for locations with addresses
    if (homeLocation?.address) {
      promises.push(fetch(`${baseUrl}/api/weather?address=${encodeURIComponent(homeLocation.address)}&name=${encodeURIComponent(homeLocation.name)}`));
    } else {
      promises.push(Promise.resolve(new Response(JSON.stringify({ error: 'No home address' }))));
    }
    
    if (workLocation?.address) {
      promises.push(fetch(`${baseUrl}/api/weather?address=${encodeURIComponent(workLocation.address)}&name=${encodeURIComponent(workLocation.name)}`));
    } else {
      promises.push(Promise.resolve(new Response(JSON.stringify({ error: 'No work address' }))));
    }
    
    // Fetch traffic if both locations have coordinates
    if (homeLocation?.lat && homeLocation?.lng && workLocation?.lat && workLocation?.lng) {
      promises.push(fetch(`${baseUrl}/api/traffic?originLat=${homeLocation.lat}&originLng=${homeLocation.lng}&destLat=${workLocation.lat}&destLng=${workLocation.lng}&originName=${encodeURIComponent(homeLocation.name)}&destName=${encodeURIComponent(workLocation.name)}`));
    } else {
      promises.push(Promise.resolve(new Response(JSON.stringify({ error: 'No coordinates for traffic' }))));
    }

    const [homeWeatherRes, workWeatherRes, trafficRes] = await Promise.all(promises);

    const homeWeather = await homeWeatherRes.json();
    const workWeather = await workWeatherRes.json();
    const traffic = await trafficRes.json();

    // Don't error out if some data is missing - just include what we have
    const hasWeatherData = !homeWeather.error || !workWeather.error;
    const hasTrafficData = !traffic.error;
    
    if (!hasWeatherData && !hasTrafficData) {
      return NextResponse.json({
        error: 'Failed to fetch data - please configure locations with addresses and coordinates',
        details: {
          homeWeather: homeWeather.error || null,
          workWeather: workWeather.error || null,
          traffic: traffic.error || null
        }
      }, { status: 500 });
    }

    const summary = generateMorningSummary(homeWeather, workWeather, traffic, todayEvents);
    const summaryKo = generateMorningSummaryKo(homeWeather, workWeather, traffic, todayEvents);

    return NextResponse.json({
      homeWeather,
      workWeather,
      traffic,
      todayEvents,
      summary,
      summaryKo
    });
  } catch (error) {
    console.error('Morning commute error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch morning commute data' },
      { status: 500 }
    );
  }
}

interface WeatherData {
  temperature: number;
  description: string;
}

interface TrafficData {
  trafficLevel: 'good' | 'moderate' | 'heavy';
  totalMinutes: number;
  trafficDelayMinutes: number;
}

interface CalendarEvent {
  title: string;
  startDate: string;
  memberName?: string;
}

function generateMorningSummary(
  homeWeather: WeatherData, 
  workWeather: WeatherData, 
  traffic: TrafficData,
  events: CalendarEvent[]
): string {
  let summary = '';

  // Weather at home
  summary += `Good morning! It's currently ${homeWeather.temperature}°C with ${homeWeather.description}. `;

  // Weather difference at work
  if (Math.abs(homeWeather.temperature - workWeather.temperature) > 3) {
    summary += `At work, it'll be ${workWeather.temperature}°C. `;
  }

  // Weather warnings
  if (homeWeather.description.includes('rain') || workWeather.description.includes('rain')) {
    summary += `Don't forget your umbrella! `;
  }
  if (homeWeather.description.includes('snow') || workWeather.description.includes('snow')) {
    summary += `Be careful, there's snow on the roads. `;
  }
  if (homeWeather.temperature > 35) {
    summary += `It's extremely hot today - stay hydrated! `;
  }
  if (homeWeather.temperature < -5) {
    summary += `It's very cold - bundle up and watch for ice! `;
  }

  // Traffic
  if (traffic.trafficLevel === 'good') {
    summary += `Traffic looks good - about ${traffic.totalMinutes} minutes to work. `;
  } else if (traffic.trafficLevel === 'moderate') {
    summary += `There's some traffic - it'll take about ${traffic.totalMinutes} minutes to work, ${traffic.trafficDelayMinutes} minutes more than usual. `;
  } else {
    summary += `Traffic is heavy right now - ${traffic.totalMinutes} minutes to work with ${traffic.trafficDelayMinutes} minutes of delays. You might want to wait a bit. `;
  }

  // Today's calendar events
  if (events.length > 0) {
    summary += `Today on your calendar: `;
    const eventDescriptions = events.map(e => {
      const time = new Date(e.startDate).toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      });
      return `${e.title} at ${time}`;
    });
    summary += eventDescriptions.join(', ') + '.';
  } else {
    summary += `Your calendar is clear today.`;
  }

  return summary;
}

function generateMorningSummaryKo(
  homeWeather: WeatherData, 
  workWeather: WeatherData, 
  traffic: TrafficData,
  events: CalendarEvent[]
): string {
  let summary = '';

  summary += `좋은 아침이에요! 지금 ${homeWeather.temperature}도이고, ${homeWeather.description}입니다. `;

  if (Math.abs(homeWeather.temperature - workWeather.temperature) > 3) {
    summary += `회사는 ${workWeather.temperature}도예요. `;
  }

  if (homeWeather.description.includes('rain') || workWeather.description.includes('rain')) {
    summary += `우산 챙기세요! `;
  }
  if (homeWeather.description.includes('snow') || workWeather.description.includes('snow')) {
    summary += `눈이 오니까 운전 조심하세요. `;
  }
  if (homeWeather.temperature > 35) {
    summary += `오늘 엄청 더워요 - 물 많이 드세요! `;
  }
  if (homeWeather.temperature < -5) {
    summary += `오늘 엄청 추워요 - 따뜻하게 입으세요! `;
  }

  if (traffic.trafficLevel === 'good') {
    summary += `교통이 좋아요 - 출근길 약 ${traffic.totalMinutes}분 걸려요. `;
  } else if (traffic.trafficLevel === 'moderate') {
    summary += `교통이 좀 막혀요 - 출근길 약 ${traffic.totalMinutes}분 걸리고, 평소보다 ${traffic.trafficDelayMinutes}분 더 걸려요. `;
  } else {
    summary += `지금 교통이 많이 막혀요 - 출근길 ${traffic.totalMinutes}분 걸리고, ${traffic.trafficDelayMinutes}분이나 지연돼요. 조금 기다렸다 가시는 게 좋을 것 같아요. `;
  }

  // Today's calendar events
  if (events.length > 0) {
    summary += `오늘 일정: `;
    const eventDescriptions = events.map(e => {
      const time = new Date(e.startDate).toLocaleTimeString('ko-KR', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      });
      return `${time}에 ${e.title}`;
    });
    summary += eventDescriptions.join(', ') + '.';
  } else {
    summary += `오늘은 일정이 없어요.`;
  }

  return summary;
}
