"""In-process sliding-window rate limiter for the auth endpoints.

Password login has no lockout (unlike the PIN, which locks after 5 tries),
so brute force was unthrottled - found in the security audit. This is a
deliberately simple, dependency-free limiter: per-process memory, keyed by
(bucket, client-ip, identity). Single-process deployments (this app's mode)
get real protection; a future multi-worker deployment should move this to
the reverse proxy or a shared store.

Disabled when settings.auth_rate_limit_per_5min == 0 (the test suite does
this - it hammers login legitimately).
"""

import time
from collections import defaultdict, deque

from server.core.config import get_settings
from server.core.errors import ServiceError

WINDOW_SECONDS = 300

_hits: dict[tuple[str, str], deque[float]] = defaultdict(deque)


class RateLimitedError(ServiceError):
    status_code = 429
    detail = "Too many attempts - try again in a few minutes"


def check_rate_limit(bucket: str, key: str) -> None:
    """Raise 429 when (bucket, key) exceeded the per-window budget."""
    limit = get_settings().auth_rate_limit_per_5min
    if limit <= 0:
        return
    now = time.monotonic()
    window = _hits[(bucket, key)]
    while window and now - window[0] > WINDOW_SECONDS:
        window.popleft()
    if len(window) >= limit:
        raise RateLimitedError()
    window.append(now)


def reset_rate_limits() -> None:
    """Test hook."""
    _hits.clear()
