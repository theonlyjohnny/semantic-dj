'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { createClient } from '../utils/supabase/client';

declare global {
  interface Window {
    Spotify: any;
    onSpotifyWebPlaybackSDKReady: () => void;
  }
}

async function transferPlayback(deviceId: string, accessToken: string) {
  const response = await fetch('https://api.spotify.com/v1/me/player', {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      device_ids: [deviceId],
      play: true
    })
  });

  if (!response.ok) {
    throw new Error('Failed to transfer playback');
  }
}

export default function SpotifyPlayer() {
  const [player, setPlayer] = useState<any>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<any>(null);
  const [volume, setVolume] = useState(50);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const playerRef = useRef<any>(null);
  const scriptRef = useRef<HTMLScriptElement | null>(null);

  const togglePlay = useCallback(async () => {
    if (!player || !deviceId) return;
    
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.provider_token) {
      console.error('No Spotify access token found');
      return;
    }

    try {
      // Check current player state
      const response = await fetch('https://api.spotify.com/v1/me/player', {
        headers: {
          'Authorization': `Bearer ${session.provider_token}`
        }
      });

      // If we get a 204 (no active device) or we're not the active device, transfer playback
      if (response.status === 204 || 
          (response.ok && (await response.json()).device?.id !== deviceId)) {
        await transferPlayback(deviceId, session.provider_token);
      }
      
      // Then toggle play
      await player.togglePlay();
    } catch (error) {
      console.error('Error toggling playback:', error);
    }
  }, [player, deviceId]);

  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // Don't handle space if we're in an input field
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (event.code === 'Space' && player) {
        event.preventDefault();
        togglePlay();
      }
    };

    window.addEventListener('keydown', handleKeyPress);

    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, [player, togglePlay]);

  useEffect(() => {
    const initializePlayer = async () => {
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session?.provider_token) {
          setError('No Spotify access token found');
          setIsLoading(false);
          return;
        }

        // Check if script is already loaded
        if (!window.Spotify) {
          scriptRef.current = document.createElement("script");
          scriptRef.current.src = "https://sdk.scdn.co/spotify-player.js";
          scriptRef.current.async = true;
          document.body.appendChild(scriptRef.current);

          // Wait for script to load
          await new Promise<void>((resolve) => {
            window.onSpotifyWebPlaybackSDKReady = resolve;
          });
        }

        const player = new window.Spotify.Player({
          name: 'Vibe Jockey Player',
          getOAuthToken: (cb: (token: string) => void) => {
            cb(session.provider_token as string);
          },
          volume: 0.5
        });

        playerRef.current = player;

        // Ready
        player.addListener('ready', ({ device_id }: { device_id: string }) => {
          console.log('Ready with Device ID', device_id);
          setDeviceId(device_id);
          setIsLoading(false);
        });

        // Not Ready
        player.addListener('not_ready', ({ device_id }: { device_id: string }) => {
          console.log('Device ID has gone offline', device_id);
          setError('Player is not ready');
          setIsLoading(false);
        });

        player.addListener('initialization_error', ({ message }: { message: string }) => {
          console.error('Failed to initialize', message);
          setError('Failed to initialize player');
          setIsLoading(false);
        });

        player.addListener('authentication_error', ({ message }: { message: string }) => {
          console.error('Failed to authenticate', message);
          setError('Failed to authenticate with Spotify');
          setIsLoading(false);
        });

        player.addListener('account_error', ({ message }: { message: string }) => {
          console.error('Failed to validate Spotify account', message);
          setError('Failed to validate Spotify account');
          setIsLoading(false);
        });

        player.addListener('player_state_changed', (state: any) => {
          if (!state) return;
          setCurrentTrack(state.track_window.current_track);
          setIsPlaying(!state.paused);
        });

        // Connect to the player!
        await player.connect();
        setPlayer(player);
      } catch (err) {
        console.error('Error initializing player:', err);
        setError('Failed to initialize player');
        setIsLoading(false);
      }
    };

    initializePlayer();

    return () => {
      if (playerRef.current) {
        playerRef.current.disconnect();
      }
      if (scriptRef.current) {
        document.body.removeChild(scriptRef.current);
      }
    };
  }, []);

  const nextTrack = async () => {
    if (!player) return;
    await player.nextTrack();
  };

  const previousTrack = async () => {
    if (!player) return;
    await player.previousTrack();
  };

  const setPlayerVolume = async (value: number) => {
    if (!player) return;
    await player.setVolume(value / 100);
    setVolume(value);
  };

  if (isLoading) {
    return (
      <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg">
        <p className="text-center">Loading player...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg">
        <p className="text-center text-red-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md">
      <div className="flex items-center gap-4 mb-4">
        {currentTrack?.album?.images[0]?.url && (
          <img
            src={currentTrack.album.images[0].url}
            alt="Album cover"
            className="w-16 h-16 rounded"
          />
        )}
        <div className="flex-1">
          <h3 className="font-semibold text-black dark:text-white">
            {currentTrack?.name || 'No track playing'}
          </h3>
          <p className="text-gray-600 dark:text-gray-300">
            {currentTrack?.artists?.[0]?.name || 'Unknown artist'}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-center gap-4 mb-4">
        <button
          onClick={previousTrack}
          className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 focus:outline-none focus:ring-0"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 20L9 12l10-8v16zM5 19V5v14z" />
          </svg>
        </button>
        <button
          onClick={togglePlay}
          className="p-3 rounded-full bg-green-500 hover:bg-green-600 text-white focus:outline-none focus:ring-0"
        >
          {isPlaying ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="6" y="4" width="4" height="16" />
              <rect x="14" y="4" width="4" height="16" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          )}
        </button>
        <button
          onClick={nextTrack}
          className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 focus:outline-none focus:ring-0"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 4l10 8-10 8V4zM19 5v14" />
          </svg>
        </button>
      </div>

      <div className="flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 5L6 9H2v6h4l5 4V5z" />
        </svg>
        <input
          type="range"
          min="0"
          max="100"
          value={volume}
          onChange={(e) => setPlayerVolume(Number(e.target.value))}
          className="flex-1 focus:outline-none focus:ring-0"
        />
      </div>
    </div>
  );
} 