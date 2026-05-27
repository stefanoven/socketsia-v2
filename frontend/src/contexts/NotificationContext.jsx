import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import apiClient from '../api/apiClient.js';

const NotificationContext = createContext({
  status: 'unsupported',
  subscribe: () => {},
  unsubscribe: () => {},
});

/**
 * Convert a URL-safe base64 string to a Uint8Array
 * (required for pushManager.subscribe applicationServerKey).
 */
function urlBase64ToUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export function NotificationProvider({ children }) {
  // 'unsupported' | 'not-subscribed' | 'subscribed' | 'loading'
  const [status, setStatus] = useState('not-subscribed');

  useEffect(() => {
    if (!('PushManager' in window) || !('serviceWorker' in navigator)) {
      setStatus('unsupported');
      return;
    }
    navigator.serviceWorker.ready
      .then(async (reg) => {
        const sub = await reg.pushManager.getSubscription();
        setStatus(sub ? 'subscribed' : 'not-subscribed');
      })
      .catch(() => setStatus('not-subscribed'));
  }, []);

  const subscribe = useCallback(async () => {
    if (!('PushManager' in window)) return;
    setStatus('loading');
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') { setStatus('not-subscribed'); return; }

      const { data } = await apiClient.get('/push/vapid-key');
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(data.publicKey),
      });

      const { endpoint, keys } = sub.toJSON();
      await apiClient.post('/push/subscribe', { endpoint, keys });
      setStatus('subscribed');
    } catch (err) {
      console.error('[Push] Subscribe error:', err);
      setStatus('not-subscribed');
    }
  }, []);

  const unsubscribe = useCallback(async () => {
    setStatus('loading');
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await apiClient.delete('/push/subscribe', { data: { endpoint: sub.endpoint } });
        await sub.unsubscribe();
      }
      setStatus('not-subscribed');
    } catch (err) {
      console.error('[Push] Unsubscribe error:', err);
      setStatus('not-subscribed');
    }
  }, []);

  return (
    <NotificationContext.Provider value={{ status, subscribe, unsubscribe }}>
      {children}
    </NotificationContext.Provider>
  );
}

export const useNotification = () => useContext(NotificationContext);
