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


async def test_body_refresh_rotates_and_replay_is_rejected_after_adoption(client):
    first = await _login_body(client)

    res = await client.post(
        "/api/v1/auth/refresh",
        headers=BODY_TRANSPORT,
        json={"refresh_token": first["refresh_token"]},
    )
    assert res.status_code == 200
    rotated = res.json()
    assert rotated["refresh_token"] and rotated["refresh_token"] != first["refresh_token"]

    # Deferred rotation: the old token is still usable while its successor is
    # unused (lost-response recovery)... but only after the successor is USED
    # does replaying the old one become reuse and get rejected.
    res = await client.post(
        "/api/v1/auth/refresh",
        headers=BODY_TRANSPORT,
        json={"refresh_token": rotated["refresh_token"]},
    )
    assert res.status_code == 200

    replay = await client.post(
        "/api/v1/auth/refresh",
        headers=BODY_TRANSPORT,
        json={"refresh_token": first["refresh_token"]},
    )
    assert replay.status_code == 401

    # The new token still works for API calls.
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


async def test_lost_response_recovery_keeps_the_session(client):
    """The mobile race: the server rotates but the phone never receives the
    response. The phone re-presents its old token - that must WORK (issuing a
    fresh successor and revoking the orphan), not log the user out."""
    first = await _login_body(client)

    # Rotation whose response the "phone" never persisted.
    lost = await client.post(
        "/api/v1/auth/refresh",
        headers=BODY_TRANSPORT,
        json={"refresh_token": first["refresh_token"]},
    )
    assert lost.status_code == 200
    orphan = lost.json()["refresh_token"]

    # Phone retries with the token it still holds - recovery, twice even.
    for _ in range(2):
        retry = await client.post(
            "/api/v1/auth/refresh",
            headers=BODY_TRANSPORT,
            json={"refresh_token": first["refresh_token"]},
        )
        assert retry.status_code == 200
    recovered = retry.json()

    # The orphan successor from the lost response is dead.
    res = await client.post(
        "/api/v1/auth/refresh", headers=BODY_TRANSPORT, json={"refresh_token": orphan}
    )
    assert res.status_code == 401

    # The recovered session works end to end.
    res = await client.get("/api/v1/settings", headers=bearer(recovered["access_token"]))
    assert res.status_code == 200


async def test_reuse_after_adoption_kills_the_whole_chain(client):
    """An old token replayed AFTER its successor was adopted and used is a
    theft signal: every descendant token must die too."""
    t1 = (await _login_body(client))["refresh_token"]

    t2 = (
        await client.post(
            "/api/v1/auth/refresh", headers=BODY_TRANSPORT, json={"refresh_token": t1}
        )
    ).json()["refresh_token"]
    # Adopt-and-use t2 -> t3 exists, t1's grace is over.
    t3 = (
        await client.post(
            "/api/v1/auth/refresh", headers=BODY_TRANSPORT, json={"refresh_token": t2}
        )
    ).json()["refresh_token"]

    # Replaying t2 (has a used successor? no - t3 unused; replay t1 instead,
    # whose successor t2 HAS been used) trips the reuse detector...
    reuse = await client.post(
        "/api/v1/auth/refresh", headers=BODY_TRANSPORT, json={"refresh_token": t1}
    )
    assert reuse.status_code == 401

    # ...and the live descendant t3 is revoked with it.
    res = await client.post(
        "/api/v1/auth/refresh", headers=BODY_TRANSPORT, json={"refresh_token": t3}
    )
    assert res.status_code == 401


async def test_logout_revokes_grace_predecessor_too(client):
    """Explicit logout must leave nothing usable - including the previous
    token still inside its grace window."""
    t1 = (await _login_body(client))["refresh_token"]
    rotated = (
        await client.post(
            "/api/v1/auth/refresh", headers=BODY_TRANSPORT, json={"refresh_token": t1}
        )
    ).json()

    res = await client.post(
        "/api/v1/auth/logout",
        headers={**BODY_TRANSPORT, **bearer(rotated["access_token"])},
        json={"refresh_token": rotated["refresh_token"]},
    )
    assert res.status_code == 204

    # Neither the logged-out token nor its in-grace predecessor works.
    for token in (rotated["refresh_token"], t1):
        res = await client.post(
            "/api/v1/auth/refresh", headers=BODY_TRANSPORT, json={"refresh_token": token}
        )
        assert res.status_code == 401
