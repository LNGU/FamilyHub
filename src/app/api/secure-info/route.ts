import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { saveSecret, getSecret, deleteSecret, getSecretsMasked, SecretCategory } from '@/lib/secure-vault';

// GET - List user's stored info (masked only - never expose full values)
export async function GET() {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    const secrets = await getSecretsMasked(session.user.email);
    return NextResponse.json({ secrets });
  } catch (error) {
    console.error('Error fetching secrets:', error);
    return NextResponse.json({ error: 'Failed to fetch secure information' }, { status: 500 });
  }
}

// POST - Save sensitive info to Azure Key Vault
export async function POST(request: NextRequest) {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    const { category, key, value } = await request.json();
    
    // Validate required fields
    if (!category || !key || !value) {
      return NextResponse.json({ error: 'Category, key, and value are required' }, { status: 400 });
    }
    
    // Validate category
    const validCategories: SecretCategory[] = ['financial', 'identity', 'medical'];
    if (!validCategories.includes(category)) {
      return NextResponse.json({ 
        error: `Invalid category. Must be one of: ${validCategories.join(', ')}` 
      }, { status: 400 });
    }
    
    // Validate key format (alphanumeric, underscores, hyphens only)
    if (!/^[a-zA-Z0-9_-]+$/.test(key)) {
      return NextResponse.json({ 
        error: 'Key must contain only letters, numbers, underscores, and hyphens' 
      }, { status: 400 });
    }
    
    await saveSecret(session.user.email, category, key, value);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving secret:', error);
    return NextResponse.json({ error: 'Failed to save secure information' }, { status: 500 });
  }
}

// DELETE - Remove sensitive info from Azure Key Vault
export async function DELETE(request: NextRequest) {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category') as SecretCategory;
  const key = searchParams.get('key');
  
  if (!category || !key) {
    return NextResponse.json({ error: 'Category and key are required' }, { status: 400 });
  }
  
  const validCategories: SecretCategory[] = ['financial', 'identity', 'medical'];
  if (!validCategories.includes(category)) {
    return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
  }
  
  try {
    await deleteSecret(session.user.email, category, key);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting secret:', error);
    return NextResponse.json({ error: 'Failed to delete secure information' }, { status: 500 });
  }
}

// PUT - Retrieve a specific secret value (for user to view their own data)
// This is the ONLY endpoint that returns unmasked values - use with caution
export async function PUT(request: NextRequest) {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    const { category, key } = await request.json();
    
    if (!category || !key) {
      return NextResponse.json({ error: 'Category and key are required' }, { status: 400 });
    }
    
    const validCategories: SecretCategory[] = ['financial', 'identity', 'medical'];
    if (!validCategories.includes(category)) {
      return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
    }
    
    const value = await getSecret(session.user.email, category, key);
    
    if (value === null) {
      return NextResponse.json({ error: 'Secret not found' }, { status: 404 });
    }
    
    return NextResponse.json({ value });
  } catch (error) {
    console.error('Error retrieving secret:', error);
    return NextResponse.json({ error: 'Failed to retrieve secure information' }, { status: 500 });
  }
}
