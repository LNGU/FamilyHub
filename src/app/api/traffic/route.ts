import { NextRequest, NextResponse } from 'next/server';

interface TrafficResponse {
  route: string;
  originName: string;
  destinationName: string;
  distanceKm: number;
  distanceMiles: number;
  durationMinutes: number;
  trafficDelayMinutes: number;
  totalMinutes: number;
  trafficLevel: 'good' | 'moderate' | 'heavy';
  isPrediction: boolean;
  departureTime?: string;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const originLat = searchParams.get('originLat');
  const originLng = searchParams.get('originLng');
  const destLat = searchParams.get('destLat');
  const destLng = searchParams.get('destLng');
  const originName = searchParams.get('originName') || 'Origin';
  const destName = searchParams.get('destName') || 'Destination';
  const departAt = searchParams.get('departAt');

  if (!originLat || !originLng || !destLat || !destLng) {
    return NextResponse.json(
      { error: 'Missing coordinates. Required: originLat, originLng, destLat, destLng' },
      { status: 400 }
    );
  }
  
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: 'Google Routes API key not configured', source: 'Google Routes API' },
      { status: 500 }
    );
  }

  try {
    const url = 'https://routes.googleapis.com/directions/v2:computeRoutes';
    
    // Always include departureTime for real-time traffic data
    // Must be in the future - add 3 minute buffer to current time
    const now = new Date();
    const departureTime = departAt 
      ? new Date(departAt).toISOString() 
      : new Date(now.getTime() + 180000).toISOString();
    
    console.log(`[Traffic] ${originName} (${originLat},${originLng}) → ${destName} (${destLat},${destLng})`);
    console.log(`[Traffic] Current time: ${now.toLocaleString()} | Departure (+3min): ${new Date(departureTime).toLocaleString()}`);
    
    const requestBody = {
      origin: {
        location: {
          latLng: {
            latitude: parseFloat(originLat),
            longitude: parseFloat(originLng)
          }
        }
      },
      destination: {
        location: {
          latLng: {
            latitude: parseFloat(destLat),
            longitude: parseFloat(destLng)
          }
        }
      },
      travelMode: 'DRIVE',
      routingPreference: 'TRAFFIC_AWARE_OPTIMAL',
      computeAlternativeRoutes: false,
      // departureTime is required for real-time traffic data
      departureTime,
      // Request detailed traffic information on route segments
      extraComputations: ['TRAFFIC_ON_POLYLINE'],
    };
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        // Field mask must include duration for traffic-adjusted time
        // staticDuration gives baseline for calculating delay
        // travelAdvisory contains speed reading intervals for detailed traffic
        'X-Goog-FieldMask': 'routes.duration,routes.staticDuration,routes.distanceMeters,routes.travelAdvisory,routes.legs.travelAdvisory,fallbackInfo'
      },
      cache: 'no-store',
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Google Routes API returned ${response.status}: ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    
    // DETAILED LOGGING - Debug traffic accuracy
    console.log(`[Traffic] ============ API RESPONSE ============`);
    console.log(`[Traffic] Route: ${originName} → ${destName}`);
    console.log(`[Traffic] Raw duration: ${data.routes?.[0]?.duration}`);
    console.log(`[Traffic] Raw staticDuration: ${data.routes?.[0]?.staticDuration}`);
    console.log(`[Traffic] Raw distanceMeters: ${data.routes?.[0]?.distanceMeters}`);
    console.log(`[Traffic] Has fallbackInfo: ${!!data.fallbackInfo}`);
    if (data.fallbackInfo) {
      console.log(`[Traffic] Fallback reason: ${JSON.stringify(data.fallbackInfo)}`);
    }
    console.log(`[Traffic] =========================================`);
    
    // Check if Google fell back to static data (no live traffic available)
    if (data.fallbackInfo) {
      console.warn('Traffic API fallback:', data.fallbackInfo.reason || 'Unknown reason');
    }
    
    if (!data.routes?.length) {
      throw new Error('No route found');
    }
    
    const route = data.routes[0];

    // Parse duration strings (e.g., "1234s" -> 1234)
    const parseDuration = (durationStr: string): number => {
      return parseInt(durationStr?.replace('s', '') || '0', 10);
    };

    const distanceMeters = route.distanceMeters || 0;
    const distanceKm = distanceMeters / 1000;
    
    // staticDuration = travel time without traffic
    // duration = travel time with current traffic conditions
    const totalSeconds = parseDuration(route.duration);
    const staticSeconds = parseDuration(route.staticDuration);
    const trafficDelaySeconds = Math.max(0, totalSeconds - staticSeconds);
    
    const totalMinutes = Math.round(totalSeconds / 60);
    const durationMinutes = Math.round(staticSeconds / 60);
    const trafficDelayMinutes = Math.round(trafficDelaySeconds / 60);

    let trafficLevel: 'good' | 'moderate' | 'heavy' = 'good';
    
    // Use speed reading intervals for more accurate traffic level
    const speedIntervals = route.travelAdvisory?.speedReadingIntervals || [];
    if (speedIntervals.length > 0) {
      const totalIntervals = speedIntervals.length;
      const slowIntervals = speedIntervals.filter((s: { speed: string }) => s.speed === 'SLOW').length;
      const jamIntervals = speedIntervals.filter((s: { speed: string }) => s.speed === 'TRAFFIC_JAM').length;
      const slowPercentage = ((slowIntervals + jamIntervals * 2) / totalIntervals) * 100;
      
      if (jamIntervals > 0 || slowPercentage > 30) {
        trafficLevel = 'heavy';
      } else if (slowPercentage > 10 || trafficDelayMinutes > 5) {
        trafficLevel = 'moderate';
      }
    } else {
      // Fallback to delay-based calculation
      if (trafficDelayMinutes > 15) {
        trafficLevel = 'heavy';
      } else if (trafficDelayMinutes > 5) {
        trafficLevel = 'moderate';
      }
    }

    const result: TrafficResponse = {
      route: `${originName} → ${destName}`,
      originName,
      destinationName: destName,
      distanceKm: Math.round(distanceKm * 10) / 10,
      distanceMiles: Math.round(distanceKm * 0.621371 * 10) / 10,
      durationMinutes,
      trafficDelayMinutes,
      totalMinutes,
      trafficLevel,
      isPrediction: !!departAt,
      departureTime: departAt || undefined
    };
    
    console.log(`[Traffic] FINAL RESULT: ${totalMinutes} min total (${trafficDelayMinutes} min delay) - ${trafficLevel}`);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Traffic API error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Failed to fetch traffic data: ${message}`, source: 'Google Routes API' },
      { status: 500 }
    );
  }
}
