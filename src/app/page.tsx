'use client';

import { useSession } from 'next-auth/react';
import { MainView } from '@/components/MainView';
import { Loader2, Calendar } from 'lucide-react';

export default function Home() {
  const { status } = useSession();

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50">
        <div className="w-16 h-16 bg-gradient-to-br from-primary-500 to-purple-700 rounded-2xl flex items-center justify-center mb-4">
          <Calendar className="w-8 h-8 text-white" />
        </div>
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
        <p className="mt-4 text-gray-600">Loading FamilyHub...</p>
      </div>
    );
  }

  // Allow unauthenticated access for now (auth is optional)
  return <MainView />;
}
