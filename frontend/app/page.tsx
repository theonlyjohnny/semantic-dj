import Link from 'next/link';
import SpotifyLoginButton from './components/SpotifyLoginButton';
import SpotifyPlayer from './components/SpotifyPlayer';
import { createClient } from './utils/supabase/server';

export default async function Home() {
  const supabase = createClient();

  try {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    
    // Debug logging
    console.log('Session:', JSON.stringify(session, null, 2));
    console.log('User:', JSON.stringify(user, null, 2));
    
    // Try different token locations
    const accessToken = user?.app_metadata?.provider_token || 
                       session?.provider_token ||
                       session?.access_token ||
                       (user?.identities?.[0] as any)?.access_token;
    
    console.log('Access Token:', accessToken ? 'Found token' : 'No token found');

    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-4 gap-4">
        <div className="z-10 max-w-5xl w-full items-center justify-center font-mono text-sm flex">
          <h1 className="text-3xl font-bold text-black dark:text-white">Vibe Jockey</h1>
        </div>

        <div className="flex flex-col items-center gap-4 w-full max-w-md">
          {user ? (
            <>
              <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md w-full flex flex-col gap-4">
                <h2 className="text-xl font-semibold text-black dark:text-white">Welcome, {user.user_metadata.name || user.email}</h2>
                <p className="text-black dark:text-white">You are logged in via Spotify</p>
                {user.user_metadata.avatar_url && (
                  <img
                    src={user.user_metadata.avatar_url}
                    alt="User avatar"
                    className="w-20 h-20 rounded-full mx-auto"
                  />
                )}
                <Link
                  href="/dashboard"
                  className="w-full bg-green-500 text-white p-2 rounded-lg text-center hover:bg-green-600 transition"
                >
                  Go to Dashboard
                </Link>
                <Link
                  href="/auth/logout"
                  className="w-full bg-red-500 text-white p-2 rounded-lg text-center hover:bg-red-600 transition"
                >
                  Logout
                </Link>
              </div>
              <SpotifyPlayer accessToken={accessToken} />
            </>
          ) : (
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md w-full flex flex-col gap-4">
              <h2 className="text-xl font-semibold text-black dark:text-white">Login to Vibe Jockey</h2>
              <p className="text-black dark:text-white">Connect with your Spotify account to get started</p>
              <SpotifyLoginButton />
            </div>
          )}
        </div>
      </main>
    );
  } catch (error) {
    console.error('Error loading user session:', error);
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-4 gap-4">
        <div className="z-10 max-w-5xl w-full items-center justify-center font-mono text-sm flex">
          <h1 className="text-3xl font-bold text-black dark:text-white">Vibe Jockey</h1>
        </div>
        <div className="flex flex-col items-center gap-4 w-full max-w-md">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md w-full flex flex-col gap-4">
            <h2 className="text-xl font-semibold text-black dark:text-white">Login to Vibe Jockey</h2>
            <p className="text-black dark:text-white">Connect with your Spotify account to get started</p>
            <SpotifyLoginButton />
          </div>
        </div>
      </main>
    );
  }
}
