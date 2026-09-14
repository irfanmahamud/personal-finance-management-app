"""Header-less refresh-token transport for the native app.

RN has no dependable cookie jar, so a client that sends
`X-Token-Transport: body` gets the refresh token in the response body and
sends it back in the request body. Everything else - rotation, single-use
replay rejection, revocation on logout - is the same code path as the
cookie flow, and these tests exist to prove exactly that.
"""

from tests.conftest import bearer

BODY_TRANSPORT = {"X-Token-Transport": "body"}


async def _login_body(client, email="a@example.com", password="pass-a"):
    res = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
        headers=BODY_TRANSPORT,
    )
    assert res.status_code == 200, res.text
    return res.json()


async def test_login_returns_refresh_token_only_when_asked(client):
    plain = await client.post(
        "/api/v1/auth/login", json={"email": "a@example.com", "password": "pass-a"}
    )
    assert plain.json()["refresh_token"] is None

    body = await _login_body(client)
    assert body["refresh_token"]
    assert body["access_token"]


async def test_body_refresh_rotates_and_replay_is_rejected(client):
    first = await _login_body(client)
    # The cookie the same response set would otherwise be used as a fallback -
    # clear it so this proves the BODY path, not the cookie path.
    client.cookies.clear()

    res = await client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": first["refresh_token"]},
        headers=BODY_TRANSPORT,
    )
    assert res.status_code == 200
    rotated = res.json()
    assert rotated["refresh_token"] and rotated["refresh_token"] != first["refresh_token"]

    # The rotated-out token is single-use.
    client.cookies.clear()
    replay = await client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": first["refresh_token"]},
        headers=BODY_TRANSPORT,
    )
    assert replay.status_code == 401

    # The new access token works.
    res = await client.get("/api/v1/settings", headers=bearer(rotated["access_token"]))
    assert res.status_code == 200


async def test_body_logout_revokes_the_token(client):
    tokens = await _login_body(client)
    client.cookies.clear()

    res = await client.post(
        "/api/v1/auth/logout", json={"refresh_token": tokens["refresh_token"]}
    )
    assert res.status_code == 204

    client.cookies.clear()
    res = await client.post(
        "/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]}
    )
    assert res.status_code == 401


async def test_signup_body_transport(client):
    res = await client.post(
        "/api/v1/auth/signup",
        json={"email": "native@example.com", "password": "passw0rd!", "household_name": "N"},
        headers=BODY_TRANSPORT,
    )
    assert res.status_code == 201
    assert res.json()["refresh_token"]


async def test_body_takes_precedence_over_a_stale_cookie(client):
    """A stale cookie must not be able to hijack a body-transport refresh."""
    first = await _login_body(client)
    stale_cookie = client.cookies.get("refresh_token")
    assert stale_cookie

    # Rotate once via the body, leaving the cookie pointing at a dead token.
    res = await client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": first["refresh_token"]},
        headers=BODY_TRANSPORT,
    )
    assert res.status_code == 200
    live = res.json()["refresh_token"]

    client.cookies.set("refresh_token", stale_cookie, path="/api/v1/auth")
    res = await client.post(
        "/api/v1/auth/refresh", json={"refresh_token": live}, headers=BODY_TRANSPORT
    )
    assert res.status_code == 200, "the live body token should win over the dead cookie"


async def test_refresh_with_no_body_and_no_cookie_401(client):
    client.cookies.clear()
    res = await client.post("/api/v1/auth/refresh", json={})
    assert res.status_code == 401
