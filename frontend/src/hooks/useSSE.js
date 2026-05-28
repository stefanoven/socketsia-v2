import { useEffect, useState } from 'react';

/**
 * Global SSE hook — tracks the /api/events connection status for the
 * sidebar indicator only. This hook does NOT handle query invalidation;
 * each page that needs real-time data manages its own SSE listener to
 * guarantee instant updates.
 */
export function useSSE() {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const es = new EventSource('/api/events', { withCredentials: true });

    const onOpen = () => setConnected(true);

    es.addEventListener('open', onOpen);
    es.addEventListener('ping', onOpen); // backend sends ping event on first connect
    es.onerror = () => setConnected(false); // browser auto-reconnects

    return () => {
      es.close();
      setConnected(false);
    };
  }, []);

  return connected;
}
