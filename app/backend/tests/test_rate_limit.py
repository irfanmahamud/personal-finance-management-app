"""The limiter itself, unit-tested directly (the suite disables it app-wide)."""

from server.core import ratelimit


def test_rate_limiter_blocks_after_budget(monkeypatch):
    ratelimit.reset_rate_limits()
    monkeypatch.setattr(
        "server.core.ratelimit.get_settings",
        lambda: type("S", (), {"auth_rate_limit_per_5min": 3})(),
    )
    for _ in range(3):
        ratelimit.check_rate_limit("login", "1.2.3.4:x@example.com")
    try:
        ratelimit.check_rate_limit("login", "1.2.3.4:x@example.com")
        raise AssertionError("expected RateLimitedError")
    except ratelimit.RateLimitedError as e:
        assert e.status_code == 429

    # A different identity from the same ip is not blocked...
    ratelimit.check_rate_limit("login", "1.2.3.4:y@example.com")
    # ...nor the same identity from a different ip.
    ratelimit.check_rate_limit("login", "5.6.7.8:x@example.com")


def test_rate_limiter_disabled_at_zero(monkeypatch):
    ratelimit.reset_rate_limits()
    monkeypatch.setattr(
        "server.core.ratelimit.get_settings",
        lambda: type("S", (), {"auth_rate_limit_per_5min": 0})(),
    )
    for _ in range(100):
        ratelimit.check_rate_limit("login", "1.2.3.4:x@example.com")


def test_window_expiry(monkeypatch):
    ratelimit.reset_rate_limits()
    monkeypatch.setattr(
        "server.core.ratelimit.get_settings",
        lambda: type("S", (), {"auth_rate_limit_per_5min": 1})(),
    )
    clock = [1000.0]
    monkeypatch.setattr("server.core.ratelimit.time.monotonic", lambda: clock[0])
    ratelimit.check_rate_limit("login", "k")
    clock[0] += ratelimit.WINDOW_SECONDS + 1
    ratelimit.check_rate_limit("login", "k")  # old hit aged out - no raise


def test_client_key_prefers_forwarded_for():
    """Behind nginx every request.client is 127.0.0.1 - without XFF keying,
    all users would share one refresh budget and 429 each other."""
    from server.api.v1.routers.auth import _client_key

    class Client:
        host = "127.0.0.1"

    class Req:
        def __init__(self, headers):
            self.headers = headers
            self.client = Client()

    proxied_a = _client_key(Req({"x-forwarded-for": "203.0.113.7, 127.0.0.1"}), "")
    proxied_b = _client_key(Req({"x-forwarded-for": "198.51.100.9"}), "")
    direct = _client_key(Req({}), "x@example.com")
    assert proxied_a == "203.0.113.7:"
    assert proxied_b == "198.51.100.9:"
    assert direct == "127.0.0.1:x@example.com"
