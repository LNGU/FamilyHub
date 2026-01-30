import { NextRequest, NextResponse } from 'next/server';

interface GeocodeResponse {
  lat: number;
  lng: number;
  formattedAddress: string;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get('address');

  if (!address) {
    return NextResponse.json(
      { error: 'Missing address parameter' },
      { status: 400 }
    );
  }

  const apiKey = process.env.GOOGLE_GEOCODING_API_KEY || process.env.GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: 'Google Geocoding API key not configured', source: 'Google Geocoding API' },
      { status: 500 }
    );
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;
    
    const response = await fetch(url, { cache: 'no-store' });

    if (!response.ok) {
      throw new Error(`Google Geocoding API returned ${response.status}`);
    }

    const data = await response.json();

    if (data.status === 'ZERO_RESULTS' || !data.results || data.results.length === 0) {
      return NextResponse.json(
        { error: 'Address not found', source: 'Google Geocoding API' },
        { status: 404 }
      );
    }

    if (data.status !== 'OK') {
      throw new Error(`Google Geocoding API error: ${data.status}`);
    }

    const result = data.results[0];
    const location = result.geometry.location;

    const geocodeResult: GeocodeResponse = {
      lat: location.lat,
      lng: location.lng,
      formattedAddress: result.formatted_address || address,
    };

    return NextResponse.json(geocodeResult);
  } catch (error) {
    console.error('Geocoding API error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Failed to geocode address: ${message}`, source: 'Google Geocoding API' },
      { status: 500 }
    );
  }
}
