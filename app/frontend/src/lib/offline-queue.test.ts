/**
 * Drain-logic tests (plan §Testing): mocked fetch, including the
 * 401-refresh-retry path and the never-discard rule.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setAccessToken } from './api-client'
import { drainQueue, enqueue, listQueued, submitWrite } from './offline-queue'

const okJson = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })

async function clearQueue() {
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase('offline-queue')
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
    req.onblocked = () => resolve()
  })
}

beforeEach(async () => {
  await clearQueue()
  setAccessToken('token-0')
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

const BODY = { client_uuid: 'uuid-1', amount: 100 }

describe('submitWrite', () => {
  it('passes through when online', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okJson({ id: 'x' }, 201)))
    const result = await submitWrite('/api/v1/expenses', 'POST', BODY)
    expect(result.status).toBe('saved')
    expect(await listQueued()).toHaveLength(0)
  })

  it('queues on network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')))
    const result = await submitWrite('/api/v1/expenses', 'POST', BODY)
    expect(result.status).toBe('queued')
    expect(await listQueued()).toHaveLength(1)
  })

  it('does NOT queue on a 4xx rejection', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okJson({ detail: 'bad' }, 422)))
    await expect(submitWrite('/api/v1/expenses', 'POST', BODY)).rejects.toThrow()
    expect(await listQueued()).toHaveLength(0)
  })
})

describe('drainQueue', () => {
  it('refreshes BEFORE draining and never stores the auth header', async () => {
    await enqueue({ id: 'uuid-1', path: '/api/v1/expenses', method: 'POST', body: BODY })
    const stored = (await listQueued())[0] as unknown as Record<string, unknown>
    expect(JSON.stringify(stored)).not.toContain('Authorization')

    const calls: { url: string; auth: string | null }[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string, init?: RequestInit) => {
        const headers = new Headers(init?.headers)
        calls.push({ url, auth: headers.get('Authorization') })
        if (url.includes('/auth/refresh')) return Promise.resolve(okJson({ access_token: 'fresh' }))
        return Promise.resolve(okJson({ id: 'x' }, 201))
      }),
    )

    await drainQueue()
    expect(calls[0].url).toContain('/auth/refresh') // rule 2: refresh first
    expect(calls[1].auth).toBe('Bearer fresh')      // rule 1: token attached at send time
    expect(await listQueued()).toHaveLength(0)
  })

  it('keeps entries when refresh fails (signed out)', async () => {
    await enqueue({ id: 'uuid-1', path: '/api/v1/expenses', method: 'POST', body: BODY })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okJson({ detail: 'no' }, 401)))
    await drainQueue()
    expect(await listQueued()).toHaveLength(1) // never discarded
  })

  it('stops on repeated 401 mid-drain, keeps the rest', async () => {
    await enqueue({ id: 'uuid-1', path: '/api/v1/expenses', method: 'POST', body: BODY })
    await enqueue({ id: 'uuid-2', path: '/api/v1/expenses', method: 'POST', body: { client_uuid: 'uuid-2' } })

    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url.includes('/auth/refresh')) return Promise.resolve(okJson({ access_token: 'fresh' }))
        return Promise.resolve(okJson({ detail: 'expired' }, 401)) // even after refresh
      }),
    )
    await drainQueue()
    expect(await listQueued()).toHaveLength(2) // sign-in-to-sync, nothing lost
  })

  it('drops permanently rejected entries but keeps going', async () => {
    await enqueue({ id: 'uuid-1', path: '/api/v1/expenses', method: 'POST', body: BODY })
    await enqueue({ id: 'uuid-2', path: '/api/v1/expenses', method: 'POST', body: { client_uuid: 'uuid-2' } })
    vi.spyOn(console, 'warn').mockImplementation(() => {})

    let expenseCalls = 0
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url.includes('/auth/refresh')) return Promise.resolve(okJson({ access_token: 'fresh' }))
        expenseCalls += 1
        if (expenseCalls === 1) return Promise.resolve(okJson({ detail: 'category gone' }, 404))
        return Promise.resolve(okJson({ id: 'x' }, 201))
      }),
    )
    await drainQueue()
    expect(await listQueued()).toHaveLength(0) // first dropped, second synced
  })

  it('stops on network failure and keeps everything', async () => {
    await enqueue({ id: 'uuid-1', path: '/api/v1/expenses', method: 'POST', body: BODY })
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url.includes('/auth/refresh')) return Promise.resolve(okJson({ access_token: 'fresh' }))
        return Promise.reject(new TypeError('offline again'))
      }),
    )
    await drainQueue()
    expect(await listQueued()).toHaveLength(1)
  })
})
