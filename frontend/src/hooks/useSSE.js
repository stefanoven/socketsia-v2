import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Global SSE hook — opens a single /api/events connection for the
 * entire authenticated session (mounted in Layout, always active).
 *
 * Returns `connected` (boolean) so the sidebar can show a live-status indicator.
 * Handles alarm/keepalive events centrally so per-page EventSource listeners
 * are no longer needed.
 */
export function useSSE() {
  const queryClient = useQueryClient();
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const es = new EventSource('/api/events', { withCredentials: true });

    // Fired every time the connection is (re)established
    const onOpen = () => setConnected(true);

    // Backend sends a 'ping' event with clientId on first connect
    const onPing = () => setConnected(true);

    const onAlarm = () => {
      queryClient.invalidateQueries({ queryKey: ['alarms'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
    };

    const onKeepalive = () => {
      queryClient.invalidateQueries({ queryKey: ['stats'] });
    };

    es.addEventListener('open',      onOpen);
    es.addEventListener('ping',      onPing);
    es.addEventListener('alarm',     onAlarm);
    es.addEventListener('keepalive', onKeepalive);

    // On error the browser auto-reconnects; mark as disconnected in the meantime
    es.onerror = () => setConnected(false);

    return () => {
      es.close();
      setConnected(false);
    };
  }, [queryClient]);

  return connected;
}
