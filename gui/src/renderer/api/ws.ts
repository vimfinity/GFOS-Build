import { useState, useEffect, useRef, useCallback } from 'react';
import { getSidecarUrl } from './client';
import type { WsEnvelope } from '@shared/api';
import type { BuildEvent, ScanEvent } from '@shared/types';

export type JobEvent = BuildEvent | ScanEvent;

export interface UseJobEventsResult {
  events: JobEvent[];
  done: boolean;
  error: string | null;
}

export function useJobEvents(jobId: string | null): UseJobEventsResult {
  const [events, setEvents] = useState<JobEvent[]>([]);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const connect = useCallback(async (id: string) => {
    const base = await getSidecarUrl();
    const wsUrl = base.replace(/^http/, 'ws') + '/api/ws';
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'subscribe', jobId: id }));
    };

    ws.onmessage = (e: MessageEvent<string>) => {
      try {
        const envelope = JSON.parse(e.data) as WsEnvelope;
        if (envelope.jobId !== id) return;
        if (envelope.type === 'event' && envelope.event) {
          setEvents((prev) => [...prev, envelope.event!]);
        } else if (envelope.type === 'done') {
          setDone(true);
        } else if (envelope.type === 'error') {
          setError(envelope.message ?? 'Unknown error');
          setDone(true);
        }
      } catch {
        // ignore malformed
      }
    };

    ws.onerror = () => setError('WebSocket connection error');
    ws.onclose = () => { wsRef.current = null; };
  }, []);

  useEffect(() => {
    if (!jobId) return;
    setEvents([]);
    setDone(false);
    setError(null);
    void connect(jobId);
    return () => {
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [jobId, connect]);

  return { events, done, error };
}
