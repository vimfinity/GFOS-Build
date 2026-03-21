import { useState, useEffect } from 'react';
import type { BuildEvent, RunEventEnvelope, ScanEvent } from '@gfos-build/contracts';
import { getDesktopApi } from './client';

export type JobEvent = BuildEvent | ScanEvent;

export interface UseJobEventsResult {
  events: JobEvent[];
  done: boolean;
  error: string | null;
  startMs: number;
  eventVersion: number;
}

const MAX_CACHED_JOBS = 10;
const MAX_EVENTS_PER_JOB = 20_000;

interface CacheEntry {
  events: JobEvent[];
  done: boolean;
  startMs: number;
}

const jobCache = new Map<string, CacheEntry>();

function getCacheEntry(jobId: string): CacheEntry {
  let entry = jobCache.get(jobId);
  if (!entry) {
    entry = { events: [], done: false, startMs: Date.now() };
    jobCache.set(jobId, entry);
    if (jobCache.size > MAX_CACHED_JOBS) {
      const oldest = jobCache.keys().next().value;
      if (oldest) {
        jobCache.delete(oldest);
      }
    }
  }
  return entry;
}

export function useJobEvents(jobId: string | null): UseJobEventsResult {
  const [error, setError] = useState<string | null>(null);
  const [eventVersion, setEventVersion] = useState(0);
  const [startMs, setStartMs] = useState(() => (jobId ? jobCache.get(jobId)?.startMs ?? Date.now() : Date.now()));

  useEffect(() => {
    if (!jobId) {
      return;
    }

    const entry = getCacheEntry(jobId);
    setStartMs(entry.startMs);
    setError(null);
    setEventVersion((value) => value + 1);

    if (entry.done) {
      return;
    }

    const unsubscribe = getDesktopApi().onRunEvent(jobId, (envelope: RunEventEnvelope) => {
      const current = getCacheEntry(jobId);
      if (envelope.type === 'event' && envelope.event) {
        if (envelope.event.type === 'run:start' && envelope.event.startedAt) {
          current.startMs = envelope.event.startedAt;
          setStartMs(envelope.event.startedAt);
        }
        if (current.events.length >= MAX_EVENTS_PER_JOB) {
          current.events.shift();
        }
        current.events.push(envelope.event);
        setEventVersion((value) => value + 1);
        return;
      }

      if (envelope.type === 'done') {
        current.done = true;
        setEventVersion((value) => value + 1);
        return;
      }

      current.done = true;
      setError(envelope.message ?? 'Job failed.');
      setEventVersion((value) => value + 1);
    });

    return unsubscribe;
  }, [jobId]);

  const cached = jobId ? jobCache.get(jobId) : undefined;
  return {
    events: cached?.events ?? [],
    done: cached?.done ?? false,
    error,
    startMs,
    eventVersion,
  };
}

export async function waitForJobCompletion(jobId: string): Promise<void> {
  const entry = getCacheEntry(jobId);
  if (entry.done) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const unsubscribe = getDesktopApi().onRunEvent(jobId, (envelope: RunEventEnvelope) => {
      if (envelope.type === 'done') {
        getCacheEntry(jobId).done = true;
        unsubscribe();
        resolve();
        return;
      }
      if (envelope.type === 'error') {
        getCacheEntry(jobId).done = true;
        unsubscribe();
        reject(new Error(envelope.message ?? 'Job failed.'));
      }
    });
  });
}

export async function waitForScanCompletion(jobId: string): Promise<Extract<ScanEvent, { type: 'scan:done' }>> {
  const entry = getCacheEntry(jobId);
  const cachedDoneEvent = [...entry.events]
    .reverse()
    .find((event): event is Extract<ScanEvent, { type: 'scan:done' }> => event.type === 'scan:done');

  if (cachedDoneEvent) {
    return cachedDoneEvent;
  }

  return await new Promise<Extract<ScanEvent, { type: 'scan:done' }>>((resolve, reject) => {
    const unsubscribe = getDesktopApi().onRunEvent(jobId, (envelope: RunEventEnvelope) => {
      if (envelope.type === 'event' && envelope.event?.type === 'scan:done') {
        unsubscribe();
        resolve(envelope.event);
        return;
      }

      if (envelope.type === 'error') {
        unsubscribe();
        reject(new Error(envelope.message ?? 'Job failed.'));
      }
    });
  });
}
