import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { 
  saveUserPin, 
  hasUserPin, 
  verifyUserPin, 
  getSecretWithPin,
  SecretCategory 
} from '@/lib/secure-vault';

// GET - Check if user has PIN set
export async function GET() {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    const hasPin = await hasUserPin(session.user.email);
    return NextResponse.json({ hasPin });
  } catch (error) {
    console.error('Error checking PIN status:', error);
    return NextResponse.json({ error: 'Failed to check PIN status' }, { status: 500 });
  }
}

// POST - Set or update PIN
export async function POST(request: NextRequest) {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    const { pin } = await request.json();
    
    if (!pin) {
      return NextResponse.json({ error: 'PIN is required' }, { status: 400 });
    }
    
    // Validate PIN format
    if (!/^\d{4,6}$/.test(pin)) {
      return NextResponse.json({ error: 'PIN must be 4-6 digits' }, { status: 400 });
    }
    
    await saveUserPin(session.user.email, pin);
    return NextResponse.json({ success: true, message: 'PIN set successfully' });
  } catch (error) {
    console.error('Error setting PIN:', error);
    const message = error instanceof Error ? error.message : 'Failed to set PIN';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PUT - Verify PIN and optionally retrieve a secret
export async function PUT(request: NextRequest) {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    const { pin, category, key } = await request.json();
    
    if (!pin) {
      return NextResponse.json({ error: 'PIN is required' }, { status: 400 });
    }
    
    // If category and key provided, verify PIN and return the secret
    if (category && key) {
      const validCategories: SecretCategory[] = ['financial', 'identity', 'medical'];
      if (!validCategories.includes(category)) {
        return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
      }
      
      const result = await getSecretWithPin(session.user.email, pin, category, key);
      
      if (!result.success) {
        return NextResponse.json({ 
          success: false, 
          error: result.error,
          locked: result.locked,
          attemptsLeft: result.attemptsLeft,
        }, { status: result.locked ? 429 : 401 });
      }
      
      return NextResponse.json({ 
        success: true, 
        value: result.value 
      });
    }
    
    // Just verify PIN without retrieving a secret
    const result = await verifyUserPin(session.user.email, pin);
    
    if (!result.valid) {
      return NextResponse.json({ 
        success: false, 
        error: result.error,
        locked: result.locked,
        attemptsLeft: result.attemptsLeft,
      }, { status: result.locked ? 429 : 401 });
    }
    
    return NextResponse.json({ success: true, message: 'PIN verified' });
  } catch (error) {
    console.error('Error verifying PIN:', error);
    return NextResponse.json({ error: 'Failed to verify PIN' }, { status: 500 });
  }
}
