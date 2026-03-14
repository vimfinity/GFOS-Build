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
  /** Monotonic revision for cache updates without cloning the full event array. */
  eventVersion: number;
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
  const [error,   setError]   = useState<string | null>(null);
  const [startMs, setStartMs] = useState<number>(     () => cached?.startMs ?? Date.now());
  const [eventVersion, setEventVersion] = useState(0);
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
            entry.events.push(ev);
          } else {
            entry.events.shift();
            entry.events.push(ev);
          }
          setEventVersion((version) => version + 1);
        } else if (envelope.type === 'done') {
          getCacheEntry(id).done = true;
          setEventVersion((version) => version + 1);
        } else if (envelope.type === 'error') {
          setError(envelope.message ?? 'Unknown error');
          getCacheEntry(id).done = true;
          setEventVersion((version) => version + 1);
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
      setError(null);
    } else {
      setStartMs(Date.now());
      setError(null);
    }
    setEventVersion((version) => version + 1);

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

  return {
    events: cached?.events ?? [],
    done: cached?.done ?? false,
    error,
    startMs,
    eventVersion,
  };
}

export async function waitForJobCompletion(jobId: string): Promise<void> {
  const cached = jobCache.get(jobId);
  if (cached?.done) return;

  const base = await getSidecarUrl();
  const wsUrl = base.replace(/^http/, 'ws') + '/api/ws';

  await new Promise<void>((resolve, reject) => {
    const ws = new WebSocket(wsUrl);

    const cleanup = () => {
      ws.onopen = null;
      ws.onmessage = null;
      ws.onerror = null;
      ws.onclose = null;
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    };

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'subscribe', jobId }));
    };

    ws.onmessage = (event: MessageEvent<string>) => {
      try {
        const envelope = JSON.parse(event.data) as WsEnvelope;
        if (envelope.jobId !== jobId) return;

        if (envelope.type === 'done') {
          getCacheEntry(jobId).done = true;
          cleanup();
          resolve();
          return;
        }

        if (envelope.type === 'error') {
          getCacheEntry(jobId).done = true;
          cleanup();
          reject(new Error(envelope.message ?? 'Job failed.'));
        }
      } catch {
        // Ignore malformed frames and wait for a terminal event.
      }
    };

    ws.onerror = () => {
      cleanup();
      reject(new Error('WebSocket connection error while waiting for job completion.'));
    };

    ws.onclose = () => {
      const entry = jobCache.get(jobId);
      if (entry?.done) {
        resolve();
      } else {
        reject(new Error('WebSocket closed before job completion.'));
      }
    };
  });
}
