'use client';

import { useState } from 'react';
import { createClient } from '../utils/supabase/client';

const getURL = () => {
  let url =
    process?.env?.NEXT_PUBLIC_SITE_URL ?? // Set this to your site URL in production env.
    process?.env?.NEXT_PUBLIC_VERCEL_URL ?? // Automatically set by Vercel.
    'http://localhost:3000/'
  // Make sure to include `https://` when not localhost.
  url = url.startsWith('http') ? url : `https://${url}`
  // Make sure to include a trailing `/`.
  url = url.endsWith('/') ? url : `${url}/`
  return url
}

export default function SpotifyLoginButton() {
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const handleLogin = async () => {
    try {
      setLoading(true);
      await supabase.auth.signInWithOAuth({
        provider: 'spotify',
        options: {
          redirectTo: `${getURL()}/auth/callback/spotify`,
          scopes: 'user-read-email user-read-private user-library-read streaming user-read-playback-state user-modify-playback-state',
        },
      });
    } catch (error) {
      console.error('Error logging in with Spotify:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleLogin}
      disabled={loading}
      className="w-full bg-[#1DB954] text-white p-3 rounded-lg flex items-center justify-center gap-2 hover:bg-[#1ed760] transition font-semibold"
      style={{ color: '#FFFFFF', textShadow: '0 0 0 #FFFFFF' }}
    >
      {loading ? (
        <span className="text-white opacity-100">Loading...</span>
      ) : (
        <>
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <path d="M8 12.5a4 2.5 0 0 1 8 0"></path>
            <path d="M8 15a4 2.5 0 0 1 8 0"></path>
            <path d="M8 10a4 2.5 0 0 1 8 0"></path>
          </svg>
          <span className="text-white opacity-100">Login with Spotify</span>
        </>
      )}
    </button>
  );
} 