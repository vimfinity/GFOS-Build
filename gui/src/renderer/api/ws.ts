import { useState, useEffect, useRef, useCallback } from 'react';
import { getSidecarUrl } from './client';
import type { WsEnvelope } from '@shared/api';
import type { BuildEvent, ScanEvent } from '@shared/types';

export type JobEvent = BuildEvent | ScanEvent;

export interface UseJobEventsResult {
  events: JobEvent[];
  done: boolean;
  error: string | null;
  /** Wall-clock ms when the first event for this job was received. Stable across remounts. */
  startMs: number;
}

// ---------------------------------------------------------------------------
// Module-level event cache so navigating away and back replays the log.
// Caps at MAX_CACHED_JOBS most-recent jobs; each job at MAX_EVENTS_PER_JOB
// lines to avoid unbounded memory usage.
// ---------------------------------------------------------------------------
const MAX_CACHED_JOBS    = 10;
const MAX_EVENTS_PER_JOB = 20_000;

interface CacheEntry {
  events: JobEvent[];
  done: boolean;
  /** Wall-clock ms when the first event arrived. Used to offset the elapsed timer. */
  startMs: number;
}

const jobCache = new Map<string, CacheEntry>();

function getCacheEntry(id: string): CacheEntry {
  let entry = jobCache.get(id);
  if (!entry) {
    entry = { events: [], done: false, startMs: Date.now() };
    jobCache.set(id, entry);
    // Evict oldest entry if over cap
    if (jobCache.size > MAX_CACHED_JOBS) {
      const oldest = jobCache.keys().next().value;
      if (oldest) jobCache.delete(oldest);
    }
  }
  return entry;
}

export function useJobEvents(jobId: string | null): UseJobEventsResult {
  const cached = jobId ? jobCache.get(jobId) : undefined;

  // Initialise from cache so a re-mount sees the existing log immediately
  const [events,  setEvents]  = useState<JobEvent[]>(() => cached?.events  ?? []);
  const [done,    setDone]    = useState<boolean>(    () => cached?.done    ?? false);
  const [error,   setError]   = useState<string | null>(null);
  const [startMs, setStartMs] = useState<number>(     () => cached?.startMs ?? Date.now());
  const wsRef = useRef<WebSocket | null>(null);

  const connect = useCallback(async (id: string) => {
    const base   = await getSidecarUrl();
    const wsUrl  = base.replace(/^http/, 'ws') + '/api/ws';
    const ws     = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'subscribe', jobId: id }));
    };

    ws.onmessage = (e: MessageEvent<string>) => {
      try {
        const envelope = JSON.parse(e.data) as WsEnvelope;
        if (envelope.jobId !== id) return;

        if (envelope.type === 'event' && envelope.event) {
          const ev    = envelope.event!;
          const entry = getCacheEntry(id);

          // Anchor startMs to the server-reported start time when run:start arrives.
          // The server replays run:start to late-joining subscribers so this is reliable.
          if (ev.type === 'run:start') {
            entry.startMs = ev.startedAt;
            setStartMs(ev.startedAt);
          } else if (entry.events.length === 0) {
            // Fallback: anchor to first event if run:start was somehow missed
            entry.startMs = Date.now();
            setStartMs(entry.startMs);
          }

          if (entry.events.length < MAX_EVENTS_PER_JOB) {
            entry.events = [...entry.events, ev];
          }
          setEvents(entry.events);
        } else if (envelope.type === 'done') {
          getCacheEntry(id).done = true;
          setDone(true);
        } else if (envelope.type === 'error') {
          setError(envelope.message ?? 'Unknown error');
          getCacheEntry(id).done = true;
          setDone(true);
        }
      } catch {
        // ignore malformed frames
      }
    };

    ws.onerror = () => setError('WebSocket connection error');
    ws.onclose = () => { wsRef.current = null; };
  }, []);

  useEffect(() => {
    if (!jobId) return;

    // Sync startMsRef from cache on every jobId change
    const entry = jobCache.get(jobId);
    if (entry) {
      setStartMs(entry.startMs);
      setEvents(entry.events);
      setDone(entry.done);
    }

    // If the job is already done and cached, skip reconnecting
    if (entry?.done) {
      setError(null);
      return;
    }

    // Live job — (re)connect to receive new events on top of the cache
    setError(null);
    void connect(jobId);
    return () => {
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [jobId, connect]);

  return { events, done, error, startMs };
}
