// Test script for Google Routes API with real-time traffic
// Run with: node scripts/test-traffic-api.js
//
// Get an API key:
// 1. Go to https://console.cloud.google.com/
// 2. Create a project or select an existing one
// 3. Enable "Routes API" in APIs & Services
// 4. Create credentials -> API key
// 5. (Optional) Restrict key to Routes API for security
//
// Or pass as argument: node scripts/test-traffic-api.js your_key_here

const token = process.argv[2] || process.env.GOOGLE_MAPS_API_KEY;

if (!token) {
  console.log('Usage: node scripts/test-traffic-api.js <GOOGLE_MAPS_API_KEY>');
  console.log('Or set GOOGLE_MAPS_API_KEY environment variable');
  console.log('\nGet an API key: https://console.cloud.google.com/ -> Enable Routes API');
  process.exit(1);
}

// ============================================
// CONFIGURE YOUR TEST ROUTE HERE
// ============================================
const testRoute = {
  name: 'Downtown to Airport',
  origin: {
    name: 'Downtown Seattle',
    lat: 47.6062,
    lng: -122.3321
  },
  destination: {
    name: 'Seattle-Tacoma Airport',
    lat: 47.4502,
    lng: -122.3088
  }
};

// ============================================

async function testGoogleRoutes() {
  const { origin, destination, name } = testRoute;
  
  console.log('\n🗺️  GOOGLE ROUTES API TEST (with real-time traffic)');
  console.log('='.repeat(50));
  console.log(`Route: ${origin.name} → ${destination.name}`);
  console.log(`Time: ${new Date().toLocaleString()}`);
  console.log(`Departure: NOW (${new Date().toISOString()})`);
  console.log('='.repeat(50));
  
  try {
    const url = 'https://routes.googleapis.com/directions/v2:computeRoutes';
    
    // IMPORTANT: departureTime is required for real-time traffic data
    // Must be in the future - add 1 minute buffer to current time
    const departureTime = new Date(Date.now() + 60000).toISOString();
    
    const requestBody = {
      origin: {
        location: {
          latLng: {
            latitude: origin.lat,
            longitude: origin.lng
          }
        }
      },
      destination: {
        location: {
          latLng: {
            latitude: destination.lat,
            longitude: destination.lng
          }
        }
      },
      travelMode: 'DRIVE',
      routingPreference: 'TRAFFIC_AWARE_OPTIMAL',
      computeAlternativeRoutes: false,
      departureTime,  // Required for live traffic!
      trafficModel: 'BEST_GUESS'  // Matches Google Maps app behavior
    };
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': token,
        // Field mask must include duration for traffic data, fallbackInfo to detect static fallback
        'X-Goog-FieldMask': 'routes.duration,routes.staticDuration,routes.distanceMeters,routes.polyline,fallbackInfo'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || `API returned ${response.status}`);
    }

    const data = await response.json();
    
    // Check if Google fell back to static data (no live traffic available)
    if (data.fallbackInfo) {
      console.log('\n⚠️  TRAFFIC FALLBACK DETECTED:');
      console.log(`   Reason: ${data.fallbackInfo.reason || 'Unknown'}`);
      console.log('   (Results may not reflect real-time traffic)');
    }
    
    if (!data.routes?.length) {
      throw new Error('No route found');
    }
    
    const route = data.routes[0];
    
    // Parse duration strings (e.g., "1234s" -> 1234)
    const parseDuration = (durationStr) => {
      return parseInt(durationStr?.replace('s', '') || '0', 10);
    };
    
    const distanceMeters = route.distanceMeters || 0;
    const distanceKm = distanceMeters / 1000;
    const distanceMiles = (distanceKm * 0.621371).toFixed(1);
    
    // staticDuration = travel time without traffic
    // duration = travel time with current traffic conditions
    const durationSeconds = parseDuration(route.duration);
    const staticSeconds = parseDuration(route.staticDuration);
    const trafficDelaySeconds = Math.max(0, durationSeconds - staticSeconds);
    
    const durationMinutes = Math.round(durationSeconds / 60);
    const noTrafficMinutes = Math.round(staticSeconds / 60);
    const trafficDelay = Math.round(trafficDelaySeconds / 60);
    
    console.log('\n📊 GOOGLE ROUTES API RESULTS:');
    console.log(`   Distance: ${distanceMiles} miles (${distanceKm.toFixed(1)} km)`);
    console.log(`   Duration (no traffic): ${noTrafficMinutes} min`);
    console.log(`   Duration (with traffic): ${durationMinutes} min`);
    console.log(`   Traffic delay: ${trafficDelay > 0 ? '+' : ''}${trafficDelay} min`);
    
    // Traffic level
    let trafficLevel = 'good';
    if (trafficDelay > 15) trafficLevel = 'heavy 🔴';
    else if (trafficDelay > 5) trafficLevel = 'moderate 🟡';
    else trafficLevel = 'good 🟢';
    console.log(`   Traffic level: ${trafficLevel}`);
    
    // Confirm real-time data
    if (!data.fallbackInfo) {
      console.log(`   ✅ Real-time traffic data (not static)`);
    }
    
    console.log('\n📱 COMPARE IN BROWSER:');
    console.log(`   Google Maps: https://www.google.com/maps/dir/${origin.lat},${origin.lng}/${destination.lat},${destination.lng}`);
    console.log(`   Waze: https://www.waze.com/ul?ll=${destination.lat},${destination.lng}&navigate=yes&from=${origin.lat},${origin.lng}`);
    
    console.log('\n💡 Pricing: https://developers.google.com/maps/documentation/routes/usage-and-billing');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.message.includes('401') || error.message.includes('403')) {
      console.log('   Check that your API key is valid and Routes API is enabled');
    }
  }
}

testGoogleRoutes();
