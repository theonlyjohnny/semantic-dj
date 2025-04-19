import SpotifyPlayer from '../components/SpotifyPlayer';
import Link from 'next/link';

export default function PlayerPage() {
  return (
    <main className="flex min-h-screen flex-col items-center p-4">
      <div className="w-full max-w-5xl flex justify-start">
        <Link
          href="/"
          className="text-black dark:text-white hover:text-gray-600 dark:hover:text-gray-300 transition p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          ←
        </Link>
      </div>

      <div className="flex-1 w-full flex items-center justify-center">
        <SpotifyPlayer />
      </div>
    </main>
  );
} 