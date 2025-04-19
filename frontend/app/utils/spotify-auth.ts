import { createClient } from './supabase/server';

export interface SpotifyUser {
  id: string;
  display_name: string;
  email: string;
  product: 'premium' | 'free';
  images: Array<{ url: string }>;
}

export async function getSpotifyUser(accessToken: string): Promise<SpotifyUser> {
  const response = await fetch('https://api.spotify.com/v1/me', {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });
  
  if (!response.ok) {
    throw new Error('Failed to fetch Spotify user data');
  }
  
  return response.json();
}

export async function getCurrentUserPremiumStatus(): Promise<'premium' | 'free'> {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session?.provider_token) {
    throw new Error('No Spotify access token found');
  }
  
  const user = await getSpotifyUser(session.provider_token);
  return user.product;
} 