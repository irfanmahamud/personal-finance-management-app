/**
 * App-level offline write queue (plan §M7, §Auth).
 *
 * The three rules that make replay safe with in-memory access tokens:
 *  1. NEVER store the Authorization header - only method, path, body and
 *     client_uuid. The token is attached at send time by api().
 *  2. Refresh BEFORE draining: on reconnect the access token is stale or
 *     (after a reload) gone; the refresh cookie survives, so refresh first.
 *  3. Not Workbox Background Sync - it replays raw Requests with their
 *     original (stale) auth header, which is exactly wrong here.
 *
 * Entries are idempotent server-side via client_uuid (UNIQUE), so a drain
 * that dies halfway and re-runs can never create duplicates.
 */

import { api, ApiError, refreshAccessToken } from './api-client'

const DB_NAME = 'offline-queue'
const STORE = 'writes'

export interface QueuedWrite {
  id: string // client_uuid doubles as the queue key
  path: string
  method: string
  body: unknown
  queuedAt: number
}

type Listener = (count: number) => void
const listeners = new Set<Listener>()

export function onQueueChange(fn: Listener): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

async function notify(): Promise<void> {
  const count = (await listQueued()).length
  listeners.forEach((fn) => fn(count))
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE, { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB unavailable'))
  })
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode)
        const req = run(t.objectStore(STORE))
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error ?? new Error('IndexedDB error'))
        t.oncomplete = () => db.close()
      }),
  )
}

export async function enqueue(entry: Omit<QueuedWrite, 'queuedAt'>): Promise<void> {
  await tx('readwrite', (s) => s.put({ ...entry, queuedAt: Date.now() }))
  await notify()
}

export function listQueued(): Promise<QueuedWrite[]> {
  return tx('readonly', (s) => s.getAll() as IDBRequest<QueuedWrite[]>)
}

async function remove(id: string): Promise<void> {
  await tx('readwrite', (s) => s.delete(id))
  await notify()
}

function isNetworkError(err: unknown): boolean {
  // fetch rejects with TypeError when the network is unreachable.
  return err instanceof TypeError
}

/**
 * Submit a write: straight through when online, queued when the network
 * fails. Returns 'saved' | 'queued' so the UI can say which happened -
 * a user who can't tell whether an expense saved will log it twice.
 */
export async function submitWrite<T>(
  path: string,
  method: string,
  body: { client_uuid: string },
): Promise<{ status: 'saved'; data: T } | { status: 'queued' }> {
  try {
    const data = await api<T>(path, { method, body: JSON.stringify(body) })
    return { status: 'saved', data }
  } catch (err) {
    if (isNetworkError(err)) {
      await enqueue({ id: body.client_uuid, path, method, body })
      return { status: 'queued' }
    }
    throw err
  }
}

let draining = false

/**
 * Drain the queue. Rule 2: refresh first. A 401 mid-drain gets one
 * refresh-and-retry (inside api()); if an entry still 401s the drain
 * stops and everything stays queued - never discarded.
 */
export async function drainQueue(): Promise<void> {
  if (draining) return
  draining = true
  try {
    const entries = await listQueued()
    if (entries.length === 0) return

    if (!(await refreshAccessToken())) return // signed out: keep entries

    for (const entry of entries.sort((a, b) => a.queuedAt - b.queuedAt)) {
      try {
        await api(entry.path, {
          method: entry.method,
          body: JSON.stringify(entry.body),
        })
        await remove(entry.id)
      } catch (err) {
        if (isNetworkError(err)) return // offline again: stop, retry later
        if (err instanceof ApiError && err.status === 401) return // sign in to sync
        if (err instanceof ApiError && err.status >= 400 && err.status < 500) {
          // Permanently rejected (e.g. category deleted meanwhile): a retry
          // can never succeed, so drop it rather than wedge the queue.
          console.warn('dropping permanently rejected queued write', entry, err.detail)
          await remove(entry.id)
          continue
        }
        return // 5xx: transient, keep and stop
      }
    }
  } finally {
    draining = false
  }
}

/** Wire drain triggers: app start and reconnect. */
export function initOfflineQueue(): void {
  window.addEventListener('online', () => void drainQueue())
  void drainQueue()
  void notify()
}
