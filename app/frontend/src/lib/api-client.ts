/**
 * The single choke point for API calls.
 *
 * Every mutation in the app goes through this module - it is what the M7
 * offline queue wraps. Rules that matter later (plan §Auth):
 *  - The Authorization header is attached at SEND time, never stored with
 *    a queued request.
 *  - A 401 triggers exactly one refresh-and-retry. A second 401 propagates,
 *    so callers (and the M7 queue) can stop and surface "sign in to sync".
 *  - Concurrent 401s share one in-flight refresh - no refresh stampede,
 *    and no rotation race (each refresh token is single-use server-side).
 */

let accessToken: string | null = null

export function setAccessToken(token: string | null): void {
  accessToken = token
}

export function getAccessToken(): string | null {
  return accessToken
}

export class ApiError extends Error {
  status: number
  detail: string

  constructor(status: number, detail: string) {
    super(detail)
    this.status = status
    this.detail = detail
  }
}

let refreshInFlight: Promise<boolean> | null = null

/** Refresh the access token via the httpOnly cookie. Shared across callers. */
export async function refreshAccessToken(): Promise<boolean> {
  refreshInFlight ??= (async () => {
    try {
      const res = await fetch('/api/v1/auth/refresh', { method: 'POST' })
      if (!res.ok) return false
      const body = (await res.json()) as { access_token: string }
      accessToken = body.access_token
      return true
    } catch {
      return false
    } finally {
      refreshInFlight = null
    }
  })()
  return refreshInFlight
}

async function rawRequest(path: string, init: RequestInit): Promise<Response> {
  const headers = new Headers(init.headers)
  if (init.body != null) headers.set('Content-Type', 'application/json')
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`)
  return fetch(path, { ...init, headers })
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res = await rawRequest(path, init)

  // One refresh-and-retry. Auth endpoints are excluded: a 401 from login is
  // a wrong password, and a 401 from refresh is a dead session - retrying
  // either through refresh would loop.
  if (res.status === 401 && !path.startsWith('/api/v1/auth/')) {
    if (await refreshAccessToken()) {
      res = await rawRequest(path, init)
    }
  }

  if (!res.ok) {
    let detail = res.statusText
    try {
      detail = ((await res.json()) as { detail?: string }).detail ?? detail
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, detail)
  }
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}
