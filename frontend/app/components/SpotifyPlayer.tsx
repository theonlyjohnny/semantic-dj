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

interface SpotifyArtist {
  name: string;
  uri: string;
}

interface SpotifyTrack {
  name: string;
  uri: string;
  album: {
    images: { url: string }[];
  };
  artists: SpotifyArtist[];
}

interface QueueState {
  prevTrack2: SpotifyTrack | null;
  prevTrack: SpotifyTrack | null;
  currentTrack: SpotifyTrack | null;
  nextTrackInQueue: SpotifyTrack | null;
  nextTrackInQueue2: SpotifyTrack | null;
  nextTrackInQueue3: SpotifyTrack | null;
  nextTrackInQueue4: SpotifyTrack | null;
}


export default function SpotifyPlayer() {
  const [player, setPlayer] = useState<any>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<any>(null);
  const [prevTrack, setPrevTrack] = useState<any>(null);
  const [prevTrack2, setPrevTrack2] = useState<any>(null);
  const [nextTrackInQueue, setNextTrackInQueue] = useState<any>(null);
  const [nextTrackInQueue2, setNextTrackInQueue2] = useState<any>(null);
  const [nextTrackInQueue3, setNextTrackInQueue3] = useState<any>(null);
  const [nextTrackInQueue4, setNextTrackInQueue4] = useState<any>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [animationDirection, setAnimationDirection] = useState<'left' | 'right' | 'up' | 'down' | null>(null);
  const [volume, setVolume] = useState(50);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentFlow, setCurrentFlow] = useState<'flow1' | 'flow2' | 'flow3'>('flow1');
  const playerRef = useRef<any>(null);
  const scriptRef = useRef<HTMLScriptElement | null>(null);
  const [showAlternateFlows, setShowAlternateFlows] = useState(false);
  const [alternateFlow1, setAlternateFlow1] = useState<QueueState | null>(null);
  const [alternateFlow3, setAlternateFlow3] = useState<QueueState | null>(null);

  // Utility function to randomly shuffle an array using Fisher-Yates algorithm
  const shuffleArray = <T,>(array: T[]): T[] => {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
  };

  // Toggle play/pause state and ensure playback is on the correct device
  const togglePlay = useCallback(async () => {
    if (!player || !deviceId) return;
    
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.provider_token) {
      setError('No Spotify access token found. Please sign in with Spotify.');
      return;
    }

    try {
      const response = await fetch('https://api.spotify.com/v1/me/player', {
        headers: {
          'Authorization': `Bearer ${session.provider_token}`
        }
      });

      if (response.status === 204 || 
          (response.ok && (await response.json()).device?.id !== deviceId)) {
        await transferPlayback(deviceId, session.provider_token);
      }
      
      await player.togglePlay();
    } catch (error) {
      console.error('Error toggling playback:', error);
      setError('Failed to toggle playback. Please try again.');
    }
  }, [player, deviceId]);

  // Space key handler to toggle play/pause
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // Ignore space key if focus is in an input field
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (event.code === 'Space' && player) {
        event.preventDefault();
        togglePlay();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [player, togglePlay]);

  // Initialize the Spotify Web Playback SDK
  useEffect(() => {
    const initializePlayer = async () => {
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session?.provider_token) {
          setError('No Spotify access token found. Please sign in with Spotify.');
          setIsLoading(false);
          return;
        }

        // Load the Spotify Web Playback SDK if not already loaded
        if (!window.Spotify) {
          scriptRef.current = document.createElement("script");
          scriptRef.current.src = "https://sdk.scdn.co/spotify-player.js";
          scriptRef.current.async = true;
          document.body.appendChild(scriptRef.current);

          // Wait for SDK to load
          await new Promise<void>((resolve) => {
            window.onSpotifyWebPlaybackSDKReady = resolve;
          });
        }

        // Initialize the Spotify player
        const player = new window.Spotify.Player({
          name: 'Vibe Jockey Player',
          getOAuthToken: async (cb: (token: string) => void) => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.provider_token) {
              cb(session.provider_token);
            }
          },
          volume: 0.5
        });

        playerRef.current = player;

        // Set up event listeners for player state changes
        player.addListener('ready', ({ device_id }: { device_id: string }) => {
          console.log('Ready with Device ID', device_id);
          setDeviceId(device_id);
          setIsLoading(false);
        });

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

        player.addListener('authentication_error', async ({ message }: { message: string }) => {
          console.error('Failed to authenticate', message);
          const { data: { session } } = await supabase.auth.getSession();
          if (!session?.provider_token) {
            setError('Failed to authenticate with Spotify. Please sign in again.');
            setIsLoading(false);
          }
        });

        player.addListener('account_error', ({ message }: { message: string }) => {
          console.error('Failed to validate Spotify account', message);
          setError('Failed to validate Spotify account');
          setIsLoading(false);
        });

        // Track state changes and update the UI
        player.addListener('player_state_changed', async (state: any) => {
          if (!state) return;
          
          console.log('Track Window:', {
            current: state.track_window.current_track,
            previous: state.track_window.previous_tracks,
            next: state.track_window.next_tracks
          });
          
          // Update current and previous tracks from the player state
          setCurrentTrack(state.track_window.current_track);
          
          if (state.track_window.previous_tracks.length > 0) {
            setPrevTrack(state.track_window.previous_tracks[0]);
          }
          if (state.track_window.previous_tracks.length > 1) {
            setPrevTrack2(state.track_window.previous_tracks[1]);
          }
          
          // Update next tracks from player state
          if (state.track_window.next_tracks.length > 0) {
            setNextTrackInQueue(state.track_window.next_tracks[0]);
          }
          if (state.track_window.next_tracks.length > 1) {
            setNextTrackInQueue2(state.track_window.next_tracks[1]);
          }
          
          // Fetch additional tracks from queue API for a fuller display
          const supabase = createClient();
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.provider_token) {
            try {
              const response = await fetch('https://api.spotify.com/v1/me/player/queue', {
                headers: {
                  'Authorization': `Bearer ${session.provider_token}`
                }
              });
              
              if (response.ok) {
                const queue = await response.json();
                if (queue.queue) {
                  if (queue.queue.length > 2) {
                    setNextTrackInQueue3(queue.queue[2]);
                  }
                  if (queue.queue.length > 3) {
                    setNextTrackInQueue4(queue.queue[3]);
                  }
                }
              }
            } catch (error) {
              console.error('Error fetching queue:', error);
            }
          }
          
          // Update play state
          setIsPlaying(!state.paused);
        });

        // Connect to Spotify and fetch initial queue
        await player.connect();
        setPlayer(player);

        if (session?.provider_token) {
          try {
            const response = await fetch('https://api.spotify.com/v1/me/player/queue', {
              headers: {
                'Authorization': `Bearer ${session.provider_token}`
              }
            });
            
            if (response.ok) {
              const queue = await response.json();
              if (queue.queue) {
                if (queue.queue.length > 1) {
                  setNextTrackInQueue2(queue.queue[1]);
                }
                if (queue.queue.length > 2) {
                  setNextTrackInQueue3(queue.queue[2]);
                }
                if (queue.queue.length > 3) {
                  setNextTrackInQueue4(queue.queue[3]);
                }
              }
            }
          } catch (error) {
            console.error('Error fetching initial queue:', error);
          }
        }
      } catch (err) {
        console.error('Error initializing player:', err);
        setError('Failed to initialize player');
        setIsLoading(false);
      }
    };

    initializePlayer();

    // Cleanup function to disconnect player and remove SDK script
    return () => {
      if (playerRef.current) {
        playerRef.current.disconnect();
      }
      if (scriptRef.current) {
        document.body.removeChild(scriptRef.current);
      }
    };
  }, []);

  // Skip to the next track and update the queue display
  const nextTrack = async () => {
    if (!player || isAnimating) return;
    setIsAnimating(true);
    setAnimationDirection('left');
    
    // Update track states before skipping
    setPrevTrack2(prevTrack);
    setPrevTrack(currentTrack);
    setCurrentTrack(nextTrackInQueue);
    setNextTrackInQueue(nextTrackInQueue2);
    setNextTrackInQueue2(nextTrackInQueue3);
    setNextTrackInQueue3(nextTrackInQueue4);
    setNextTrackInQueue4(null);
    
    await player.nextTrack();
    
    // Fetch the latest track in the queue to update the display
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.provider_token) {
      try {
        const response = await fetch('https://api.spotify.com/v1/me/player/queue', {
          headers: {
            'Authorization': `Bearer ${session.provider_token}`
          }
        });
        
        if (response.ok) {
          const queue = await response.json();
          if (queue.queue && queue.queue.length > 3) {
            setNextTrackInQueue4(queue.queue[3]);
          }
        }
      } catch (error) {
        console.error('Error fetching queue:', error);
      }
    }
    
    setTimeout(() => {
      setIsAnimating(false);
      setAnimationDirection(null);
    }, 500);
  };

  // Go back to the previous track and update the queue display
  const previousTrack = async () => {
    if (!player || isAnimating) return;
    setIsAnimating(true);
    setAnimationDirection('right');
    
    // Update track states before going back
    setNextTrackInQueue2(nextTrackInQueue);
    setNextTrackInQueue(currentTrack);
    setCurrentTrack(prevTrack);
    setPrevTrack(prevTrack2);
    setPrevTrack2(null);
    
    await player.previousTrack();
    setTimeout(() => {
      setIsAnimating(false);
      setAnimationDirection(null);
    }, 500);
  };

  // Set the player volume and update local volume state
  const setPlayerVolume = async (value: number) => {
    if (!player) return;
    await player.setVolume(value / 100);
    setVolume(value);
  };

  // Toggle visibility of alternate flow options
  const toggleAlternateFlows = () => {
    setShowAlternateFlows(!showAlternateFlows);
  };

  // Generate randomized alternate flows from the current queue
  const updateAlternateFlows = async () => {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.provider_token) return;

    try {
      const response = await fetch('https://api.spotify.com/v1/me/player/queue', {
        headers: {
          'Authorization': `Bearer ${session.provider_token}`
        }
      });
      
      if (response.ok) {
        const queue = await response.json();
        if (queue.queue && queue.queue.length > 0) {
          // Get future tracks and create two different shuffled versions
          const futureTracks = queue.queue.slice(2) as SpotifyTrack[];
          const shuffled1 = shuffleArray(futureTracks);
          const shuffled3 = shuffleArray(futureTracks);

          // Set up alternate flow 1
          setAlternateFlow1({
            prevTrack2: null,
            prevTrack: null,
            currentTrack: shuffled1[0] || null,
            nextTrackInQueue: shuffled1[1] || null,
            nextTrackInQueue2: shuffled1[2] || null,
            nextTrackInQueue3: shuffled1[3] || null,
            nextTrackInQueue4: shuffled1[4] || null
          });

          // Set up alternate flow 3
          setAlternateFlow3({
            prevTrack2: null,
            prevTrack: null,
            currentTrack: shuffled3[0] || null,
            nextTrackInQueue: shuffled3[1] || null,
            nextTrackInQueue2: shuffled3[2] || null,
            nextTrackInQueue3: shuffled3[3] || null,
            nextTrackInQueue4: shuffled3[4] || null
          });
        }
      }
    } catch (error) {
      console.error('Error fetching queue for alternate flows:', error);
    }
  };

  // Change the current flow and update the Spotify queue accordingly
  const changeFlow = async (flow: 'flow1' | 'flow2' | 'flow3') => {
    if (currentFlow === flow || isAnimating) return;
    
    setIsAnimating(true);
    // Set animation direction based on which flow is selected
    if (flow === 'flow1') {
      setAnimationDirection('up');
    } else if (flow === 'flow3') {
      setAnimationDirection('down');
    } else {
      setAnimationDirection('left');
    }
    
    // Get the queue data for the selected flow
    let newQueue: QueueState | null = null;
    if (flow === 'flow1' && alternateFlow1) {
      newQueue = alternateFlow1;
    } else if (flow === 'flow3' && alternateFlow3) {
      newQueue = alternateFlow3;
    }

    // If we have queue data, update the Spotify queue
    if (newQueue) {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.provider_token) {
        try {
          const stateResponse = await fetch('https://api.spotify.com/v1/me/player', {
            headers: {
              'Authorization': `Bearer ${session.provider_token}`
            }
          });

          if (stateResponse.ok) {
            // Get the tracks to add from the selected flow
            const tracksToAdd = [
              newQueue.currentTrack,
              newQueue.nextTrackInQueue,
              newQueue.nextTrackInQueue2,
              newQueue.nextTrackInQueue3,
              newQueue.nextTrackInQueue4
            ].filter(track => track?.uri);

            if (tracksToAdd.length > 0 && tracksToAdd[0]?.uri) {
              // Start playing the first track immediately
              await fetch('https://api.spotify.com/v1/me/player/play', {
                method: 'PUT',
                headers: {
                  'Authorization': `Bearer ${session.provider_token}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  uris: [tracksToAdd[0].uri]
                })
              });

              // Add the rest of the tracks to the queue
              for (let i = 1; i < tracksToAdd.length; i++) {
                const track = tracksToAdd[i];
                if (track?.uri) {
                  await fetch('https://api.spotify.com/v1/me/player/queue?uri=' + encodeURIComponent(track.uri), {
                    method: 'POST',
                    headers: {
                      'Authorization': `Bearer ${session.provider_token}`
                    }
                  });
                  await new Promise(resolve => setTimeout(resolve, 100));
                }
              }
              
              // Update local state with the new track order
              setTimeout(() => {
                setPrevTrack2(null);
                setPrevTrack(null);
                setCurrentTrack(tracksToAdd[0]);
                setNextTrackInQueue(tracksToAdd[1] || null);
                setNextTrackInQueue2(tracksToAdd[2] || null);
                setNextTrackInQueue3(tracksToAdd[3] || null);
                setNextTrackInQueue4(tracksToAdd[4] || null);
                setCurrentFlow(flow);
                
                // After switching to flow 1 or 3, reset both alternate flows
                if (flow !== 'flow2') {
                  updateAlternateFlows();
                }
                
                setTimeout(() => {
                  setIsAnimating(false);
                  setAnimationDirection(null);
                }, 500);
              }, 250);
            }
          }
        } catch (error) {
          console.error('Error updating Spotify queue:', error);
          setIsAnimating(false);
          setAnimationDirection(null);
        }
      }
    } else {
      // For Flow 2 or if alternate flows aren't ready, keep current queue
      setTimeout(() => {
        const currentQueue = {
          prevTrack2,
          prevTrack,
          currentTrack,
          nextTrackInQueue,
          nextTrackInQueue2,
          nextTrackInQueue3,
          nextTrackInQueue4
        };

        setPrevTrack2(currentQueue.prevTrack2);
        setPrevTrack(currentQueue.prevTrack);
        setCurrentTrack(currentQueue.currentTrack);
        setNextTrackInQueue(currentQueue.nextTrackInQueue);
        setNextTrackInQueue2(currentQueue.nextTrackInQueue2);
        setNextTrackInQueue3(currentQueue.nextTrackInQueue3);
        setNextTrackInQueue4(currentQueue.nextTrackInQueue4);
        setCurrentFlow(flow);
        
        setTimeout(() => {
          setIsAnimating(false);
          setAnimationDirection(null);
        }, 500);
      }, 250);
    }
  };

  // Update alternate flows when they are displayed
  useEffect(() => {
    if (showAlternateFlows) {
      updateAlternateFlows();
    }
  }, [showAlternateFlows]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center w-full h-full">
        <div className="w-64 h-64 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center w-full h-full">
        <p className="text-center text-red-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-8">
      <div className="relative w-full max-w-7xl h-[calc(100vh-200px)] flex items-center justify-center overflow-hidden">
        <div className="w-full">
          <div className="flex items-center justify-center">
            <div className="flex flex-col items-center gap-6">
              <div className="flex items-center gap-3">
                {prevTrack2?.album?.images[0]?.url && (
                  <div className="relative w-32 h-32 sm:w-40 sm:h-40 md:w-48 md:h-48 lg:w-56 lg:h-56 flex-shrink-0">
                    <img
                      src={prevTrack2.album.images[0].url}
                      alt="Previous track 2"
                      className="w-full h-full rounded-lg object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent to-black/50 rounded-lg"></div>
                  </div>
                )}

                {prevTrack?.album?.images[0]?.url && (
                  <div className="relative w-32 h-32 sm:w-40 sm:h-40 md:w-48 md:h-48 lg:w-56 lg:h-56 flex-shrink-0">
                    <img
                      src={prevTrack.album.images[0].url}
                      alt="Previous track"
                      className="w-full h-full rounded-lg object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent to-black/50 rounded-lg"></div>
                  </div>
                )}

                <button
                  onClick={togglePlay}
                  className="relative group w-32 h-32 sm:w-40 sm:h-40 md:w-48 md:h-48 lg:w-56 lg:h-56 flex-shrink-0 hover:scale-105 focus:outline-none transition-transform duration-300"
                >
                  {currentTrack?.album?.images[0]?.url ? (
                    <>
                      <img
                        src={currentTrack.album.images[0].url}
                        alt={currentTrack.name || 'Album cover'}
                        className="w-full h-full rounded-lg shadow-xl object-cover"
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all duration-300 ease-in-out rounded-lg">
                        {isPlaying ? (
                          <svg className="w-16 h-16 text-white opacity-0 group-hover:opacity-100 transition-all duration-300 ease-in-out" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        ) : (
                          <svg className="w-16 h-16 text-white opacity-0 group-hover:opacity-100 transition-all duration-300 ease-in-out" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="w-full h-full rounded-lg shadow-xl bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                      <svg className="w-16 h-16 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                      </svg>
                    </div>
                  )}
                </button>

                <div className="flex flex-col gap-6">
                  <div className={`transition-all duration-500 ease-in-out ${
                    showAlternateFlows ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-full'
                  }`}>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => changeFlow('flow1')}
                        className={`px-4 py-2 rounded-full font-medium select-none ${
                          currentFlow === 'flow1'
                            ? 'bg-gray-800 dark:bg-gray-600 text-white'
                            : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                        }`}
                      >
                        Flow 1
                      </button>
                      {alternateFlow1 && [
                        alternateFlow1.currentTrack,
                        alternateFlow1.nextTrackInQueue,
                        alternateFlow1.nextTrackInQueue2,
                        alternateFlow1.nextTrackInQueue3,
                        alternateFlow1.nextTrackInQueue4
                      ].filter(track => track?.album?.images[0]?.url)
                       .map((track, index) => (
                        <div key={`flow1-${index}`} className="relative w-32 h-32 sm:w-40 sm:h-40 md:w-48 md:h-48 lg:w-56 lg:h-56 flex-shrink-0 opacity-75">
                          <img
                            src={track?.album?.images[0]?.url}
                            alt={track?.name}
                            className="w-full h-full rounded-lg object-cover"
                          />
                          <div className="absolute inset-0 bg-purple-600/20 rounded-lg"></div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {[nextTrackInQueue, nextTrackInQueue2, nextTrackInQueue3, nextTrackInQueue4].map((track, index) => (
                      track?.album?.images[0]?.url && (
                        <div key={`next-${index}`} className="relative w-32 h-32 sm:w-40 sm:h-40 md:w-48 md:h-48 lg:w-56 lg:h-56 flex-shrink-0">
                          <img
                            src={track.album.images[0].url}
                            alt={`Next track ${index + 1}`}
                            className="w-full h-full rounded-lg object-cover"
                          />
                          <div className="absolute inset-0 bg-gradient-to-l from-transparent to-black/50 rounded-lg"></div>
                        </div>
                      )
                    ))}
                  </div>

                  <div className={`transition-all duration-500 ease-in-out ${
                    showAlternateFlows ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-full'
                  }`}>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => changeFlow('flow3')}
                        className={`px-4 py-2 rounded-full font-medium select-none ${
                          currentFlow === 'flow3'
                            ? 'bg-gray-800 dark:bg-gray-600 text-white'
                            : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                        }`}
                      >
                        Flow 3
                      </button>
                      {alternateFlow3 && [
                        alternateFlow3.currentTrack,
                        alternateFlow3.nextTrackInQueue,
                        alternateFlow3.nextTrackInQueue2,
                        alternateFlow3.nextTrackInQueue3,
                        alternateFlow3.nextTrackInQueue4
                      ].filter(track => track?.album?.images[0]?.url)
                       .map((track, index) => (
                        <div key={`flow3-${index}`} className="relative w-32 h-32 sm:w-40 sm:h-40 md:w-48 md:h-48 lg:w-56 lg:h-56 flex-shrink-0 opacity-75">
                          <img
                            src={track?.album?.images[0]?.url}
                            alt={track?.name}
                            className="w-full h-full rounded-lg object-cover"
                          />
                          <div className="absolute inset-0 bg-pink-600/20 rounded-lg"></div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={toggleAlternateFlows}
          className="absolute right-8 px-4 py-2 rounded-full font-medium select-none bg-gray-800 dark:bg-gray-600 text-white"
        >
          {showAlternateFlows ? 'Hide Flows' : 'Show Flows'}
        </button>
      </div>

      <div className="w-full max-w-7xl flex items-center justify-between px-8">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-4">
            <button
              onClick={previousTrack}
              className="p-3 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 transition-all duration-300 transform hover:scale-105 focus:outline-none"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={nextTrack}
              className="p-3 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 transition-all duration-300 transform hover:scale-105 focus:outline-none"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {currentTrack && (
            <div className="text-sm">
              <p className="font-medium text-gray-800 dark:text-gray-200">{currentTrack.name}</p>
              <p className="text-gray-600 dark:text-gray-400">{currentTrack.artists?.map((artist: SpotifyArtist) => artist.name).join(', ')}</p>
            </div>
          )}
        </div>

        <div className="w-64">
          <input
            type="range"
            min="0"
            max="100"
            value={volume}
            onChange={(e) => setPlayerVolume(Number(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 transition-all duration-300 ease-in-out"
          />
        </div>
      </div>
    </div>
  );
} 