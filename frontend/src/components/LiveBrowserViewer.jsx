import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

const WS_URL = import.meta.env.VITE_WS_URL || '';
const API_URL = import.meta.env.VITE_API_URL || '';

function proxyScreenshotUrl(url) {
  if (!url) return url;
  const bucket = 'crop-spray-uploads';
  const idx = url.indexOf(`/${bucket}/`);
  if (idx !== -1) {
    const key = url.substring(idx + bucket.length + 2);
    return `${API_URL}/api/screenshots/${key}`;
  }
  return url;
}

export default function LiveBrowserViewer({ jobId, screenshots = [], isRunning }) {
  const [liveScreenshots, setLiveScreenshots] = useState(screenshots);
  const [currentIndex, setCurrentIndex] = useState(0);
  const containerRef = useRef(null);

  useEffect(() => {
    setLiveScreenshots(screenshots);
    setCurrentIndex(Math.max(0, screenshots.length - 1));
  }, [screenshots]);

  useEffect(() => {
    if (!isRunning || !jobId) return;

    const socket = io(WS_URL, { transports: ['websocket', 'polling'] });

    socket.on('connect', () => {
      socket.emit('join_job', jobId);
    });

    socket.on('job_updated', (data) => {
      if (data.jobId === jobId && data.screenshots?.length > 0) {
        setLiveScreenshots((prev) => {
          const updated = [...prev, ...data.screenshots];
          setCurrentIndex(updated.length - 1);
          return updated;
        });
      }
    });

    return () => {
      socket.emit('leave_job', jobId);
      socket.disconnect();
    };
  }, [jobId, isRunning]);

  if (liveScreenshots.length === 0) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-800 flex items-center justify-center">
          <svg className="w-8 h-8 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <p className="text-gray-400 text-sm">
          {isRunning ? 'Waiting for browser screenshots...' : 'No screenshots available'}
        </p>
        {isRunning && (
          <div className="mt-3 flex items-center justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
            <span className="text-xs text-blue-400">Live</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-300">Browser View</span>
          {isRunning && (
            <span className="flex items-center gap-1.5 text-xs text-blue-400">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
              Live
            </span>
          )}
        </div>
        <span className="text-xs text-gray-500">
          {currentIndex + 1} / {liveScreenshots.length}
        </span>
      </div>

      <div ref={containerRef} className="relative bg-black aspect-video">
        <img
          src={proxyScreenshotUrl(liveScreenshots[currentIndex])}
          alt={`Screenshot ${currentIndex + 1}`}
          className="w-full h-full object-contain"
        />
      </div>

      {liveScreenshots.length > 1 && (
        <div className="flex items-center gap-2 px-4 py-3 border-t border-gray-800">
          <button
            onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
            disabled={currentIndex === 0}
            className="p-1.5 rounded-lg bg-gray-800 text-gray-400 hover:text-white disabled:opacity-30 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <input
            type="range"
            min={0}
            max={liveScreenshots.length - 1}
            value={currentIndex}
            onChange={(e) => setCurrentIndex(parseInt(e.target.value, 10))}
            className="flex-1 accent-primary-500"
          />
          <button
            onClick={() => setCurrentIndex(Math.min(liveScreenshots.length - 1, currentIndex + 1))}
            disabled={currentIndex === liveScreenshots.length - 1}
            className="p-1.5 rounded-lg bg-gray-800 text-gray-400 hover:text-white disabled:opacity-30 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
