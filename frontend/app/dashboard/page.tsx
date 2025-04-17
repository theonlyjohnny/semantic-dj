import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/app/utils/supabase/server';
import { getCurrentUserPremiumStatus } from '@/app/utils/spotify-auth';

export default async function Dashboard() {
  const supabase = createClient();
  
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      console.error("No user found");
      redirect('/');
    }
    
    const premiumStatus = await getCurrentUserPremiumStatus();
    
    return (
      <main className="flex min-h-screen flex-col items-center p-8 gap-8">
        <div className="flex w-full max-w-4xl justify-between items-center">
          <h1 className="text-3xl font-bold text-black dark:text-white">Dashboard</h1>
          <Link
            href="/"
            className="text-blue-700 hover:text-blue-900 transition dark:text-blue-400 dark:hover:text-blue-300"
          >
            Back to Home
          </Link>
        </div>
        
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md w-full max-w-4xl">
          <h2 className="text-xl font-semibold mb-4 text-black dark:text-white">Your Spotify Profile</h2>
          
          <div className="flex flex-col md:flex-row gap-6">
            {user.user_metadata?.avatar_url && (
              <img
                src={user.user_metadata.avatar_url}
                alt="User avatar"
                className="w-32 h-32 rounded-full"
              />
            )}
            
            <div className="space-y-2 text-black dark:text-white">
              <p><span className="font-semibold">Name:</span> {user.user_metadata?.name || 'Not available'}</p>
              <p><span className="font-semibold">Email:</span> {user.email || 'Not available'}</p>
              <p><span className="font-semibold">Spotify ID:</span> {user.user_metadata?.provider_id || 'Not available'}</p>
              <p><span className="font-semibold">Premium Status:</span> {premiumStatus === 'premium' ? 'Premium' : 'Free'}</p>
              
              <div className="pt-4">
                <Link
                  href="/auth/logout"
                  className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition"
                >
                  Logout
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  } catch (error) {
    console.error("Dashboard error:", error);
    redirect('/');
  }
} 