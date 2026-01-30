import { NextRequest, NextResponse } from 'next/server';

interface WeatherResponse {
  location: string;
  temperature: number;
  feelsLike: number;
  description: string;
  humidity: number;
  windSpeed: number;
  icon: string;
  sunrise?: string;
  sunset?: string;
}

// Extract city from address (handles "123 Main St SW Seattle, WA 98101" -> "Seattle,WA,US")
function extractCity(address: string): string {
  // Remove ZIP code first
  let cleaned = address.replace(/\d{5}(-\d{4})?/, '').trim();
  
  // Try to find "City, ST" pattern - look for the last occurrence of "word(s), XX" where XX is state
  // This handles: "123 Main St SW Seattle, WA" -> extracts "Seattle, WA"
  const cityStateMatch = cleaned.match(/\b([A-Za-z][A-Za-z\s]*?),\s*([A-Z]{2})\s*$/i);
  if (cityStateMatch) {
    // The city might have directional prefix like "SW Lynnwood" - extract just the city name
    let city = cityStateMatch[1].trim();
    const state = cityStateMatch[2].toUpperCase();
    
    // Remove directional prefixes (SW, NE, etc.) that might be attached
    city = city.replace(/^(SW|SE|NW|NE|N|S|E|W)\s+/i, '').trim();
    
    // Also try to extract just the last word if it looks like a city name
    // "136th St SW Lynnwood" -> "Lynnwood"
    const words = city.split(/\s+/);
    if (words.length > 1) {
      // Take the last word that looks like a city (starts with capital, no numbers)
      for (let i = words.length - 1; i >= 0; i--) {
        if (/^[A-Z][a-z]+$/.test(words[i])) {
          city = words[i];
          break;
        }
      }
    }
    
    return `${city},${state},US`;
  }
  
  // Try splitting by comma
  const parts = cleaned.split(',').map(p => p.trim());
  if (parts.length >= 2) {
    // Last part might be state
    const lastPart = parts[parts.length - 1];
    if (/^[A-Z]{2}$/i.test(lastPart)) {
      // Second to last should be city
      let city = parts[parts.length - 2];
      // Remove street numbers and directions
      city = city.replace(/^\d+\s+/, '').replace(/\b(SW|SE|NW|NE)\b\s*/gi, '').trim();
      // Get last word as city name
      const words = city.split(/\s+/);
      city = words[words.length - 1];
      return `${city},${lastPart.toUpperCase()},US`;
    }
  }
  
  // Fallback: just use the address as-is
  return address;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get('address');
  const locationName = searchParams.get('name') || 'Location';

  if (!address) {
    return NextResponse.json(
      { error: 'Missing address parameter' },
      { status: 400 }
    );
  }

  const apiKey = process.env.OPENWEATHER_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: 'OpenWeather API key not configured', source: 'OpenWeather API' },
      { status: 500 }
    );
  }

  // Try city name first (more reliable with OpenWeatherMap)
  const city = extractCity(address);
  const queries = city !== address ? [city, address] : [address];

  for (const query of queries) {
    try {
      console.log(`[Weather] Trying query: ${query}`);
      const response = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(query)}&appid=${apiKey}&units=metric`,
        { cache: 'no-store' }
      );

      if (!response.ok) {
        console.log(`[Weather] Query "${query}" returned ${response.status}`);
        continue;
      }

      const data = await response.json();

      // Format sunrise/sunset times
      const formatTime = (unix: number, timezone: number): string => {
        const date = new Date((unix + timezone) * 1000);
        const hours = date.getUTCHours();
        const minutes = date.getUTCMinutes();
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const h = hours % 12 || 12;
        return `${h}:${minutes.toString().padStart(2, '0')} ${ampm}`;
      };

      const result: WeatherResponse = {
        location: locationName,
        temperature: Math.round(data.main.temp),
        feelsLike: Math.round(data.main.feels_like),
        description: data.weather[0].description,
        humidity: data.main.humidity,
        windSpeed: Math.round(data.wind.speed * 3.6),
        icon: data.weather[0].icon,
        sunrise: data.sys?.sunrise ? formatTime(data.sys.sunrise, data.timezone || 0) : undefined,
        sunset: data.sys?.sunset ? formatTime(data.sys.sunset, data.timezone || 0) : undefined,
      };

      return NextResponse.json(result);
    } catch (error) {
      console.error(`[Weather] Error for query "${query}":`, error);
    }
  }

  return NextResponse.json(
    { error: 'Failed to fetch weather data', source: 'OpenWeather API' },
    { status: 500 }
  );
}
