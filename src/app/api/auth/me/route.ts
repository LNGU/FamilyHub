import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../[...nextauth]/route';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    console.log('[Auth] No user signed in');
    return NextResponse.json({ signedIn: false }, { status: 401 });
  }
  
  console.log(`[Auth] Signed in: ${session.user.email} (${session.user.name})`);
  
  return NextResponse.json({
    signedIn: true,
    user: {
      name: session.user.name,
      email: session.user.email,
      image: session.user.image,
    }
  });
}
