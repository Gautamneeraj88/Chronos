import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { toast } from 'sonner';
import type { LiveNotification } from '../types';

const NOTIFIER_URL = import.meta.env.VITE_NOTIFIER_URL ?? 'http://localhost:3003';
const MAX_STORED = 50;

interface NotificationCtx {
  notifications: LiveNotification[];
  unread: number;
  markAllRead: () => void;
  connected: boolean;
}

const Ctx = createContext<NotificationCtx>({
  notifications: [],
  unread: 0,
  markAllRead: () => {},
  connected: false,
});

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<LiveNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [connected, setConnected] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  const push = useCallback((n: LiveNotification) => {
    setNotifications((prev) => [n, ...prev].slice(0, MAX_STORED));
    setUnread((c) => c + 1);

    // Show a toast
    const label = n.status === 'COMPLETED' ? 'Execution completed' : 'Execution failed';
    const toastFn = n.status === 'COMPLETED' ? toast.success : toast.error;
    toastFn(label, {
      description: `Workflow ${n.workflowId.slice(0, 8)}… · ${n.executionId.slice(0, 8)}…`,
      duration: 5000,
    });
  }, []);

  useEffect(() => {
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    function connect() {
      const es = new EventSource(`${NOTIFIER_URL}/sse`);
      esRef.current = es;

      es.onopen = () => setConnected(true);

      es.addEventListener('notification', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data) as LiveNotification;
          push(data);
        } catch { /* ignore parse errors */ }
      });

      es.onerror = () => {
        setConnected(false);
        es.close();
        // Retry after 5s
        retryTimer = setTimeout(connect, 5000);
      };
    }

    connect();

    return () => {
      esRef.current?.close();
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [push]);

  const markAllRead = useCallback(() => setUnread(0), []);

  return (
    <Ctx.Provider value={{ notifications, unread, markAllRead, connected }}>
      {children}
    </Ctx.Provider>
  );
}

export function useNotifications() {
  return useContext(Ctx);
}
