import { NextRequest, NextResponse } from 'next/server';
import Redis from 'ioredis';

const STORAGE_KEY = 'family-hub-data';

const DEFAULT_STATE = {
  familyMembers: [],
  events: [],
  travelPlans: [],
  customEventTypes: [],
  builtInTypeOverrides: [],
  locations: [],
};

function getRedisClient() {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    throw new Error('REDIS_URL environment variable is not set');
  }
  return new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  });
}

export async function GET() {
  const redis = getRedisClient();
  try {
    const data = await redis.get(STORAGE_KEY);
    
    if (!data) {
      return NextResponse.json(DEFAULT_STATE);
    }
    
    const parsed = JSON.parse(data);
    return NextResponse.json({
      familyMembers: parsed.familyMembers || [],
      events: parsed.events || [],
      travelPlans: parsed.travelPlans || [],
      customEventTypes: parsed.customEventTypes || [],
      builtInTypeOverrides: parsed.builtInTypeOverrides || [],
      locations: parsed.locations || [],
    });
  } catch (error) {
    console.error('Error loading data from Redis:', error);
    return NextResponse.json(
      { error: 'Failed to load data' },
      { status: 500 }
    );
  } finally {
    await redis.quit();
  }
}

export async function POST(request: NextRequest) {
  const redis = getRedisClient();
  try {
    const data = await request.json();
    await redis.set(STORAGE_KEY, JSON.stringify(data));
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving data to Redis:', error);
    return NextResponse.json(
      { error: 'Failed to save data' },
      { status: 500 }
    );
  } finally {
    await redis.quit();
  }
}

export async function PUT() {
  const redis = getRedisClient();
  try {
    const data = await redis.get(STORAGE_KEY);
    const sizeBytes = data ? Buffer.byteLength(data, 'utf8') : 0;
    
    const info = await redis.info('memory');
    const usedMemoryMatch = info.match(/used_memory:(\d+)/);
    const usedMemory = usedMemoryMatch ? parseInt(usedMemoryMatch[1], 10) : 0;
    
    return NextResponse.json({
      keySize: sizeBytes,
      keySizeFormatted: formatBytes(sizeBytes),
      redisMemory: usedMemory,
      redisMemoryFormatted: formatBytes(usedMemory),
    });
  } catch (error) {
    console.error('Error getting storage info:', error);
    return NextResponse.json(
      { error: 'Failed to get storage info' },
      { status: 500 }
    );
  } finally {
    await redis.quit();
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
