from tests.conftest import bearer, login


async def test_login_and_settings(client):
    token = await login(client, "a@example.com", "pass-a")
    res = await client.get("/api/v1/settings", headers=bearer(token))
    assert res.status_code == 200
    assert res.json()["household_name"] == "A"


async def test_wrong_password_and_unknown_email_same_error(client):
    r1 = await client.post(
        "/api/v1/auth/login", json={"email": "a@example.com", "password": "nope"}
    )
    r2 = await client.post(
        "/api/v1/auth/login", json={"email": "ghost@example.com", "password": "nope"}
    )
    assert r1.status_code == r2.status_code == 401
    assert r1.json() == r2.json()


async def test_refresh_rotates_and_old_token_dies(client):
    await login(client, "a@example.com", "pass-a")
    old_cookie = client.cookies.get("refresh_token")
    assert old_cookie

    res = await client.post("/api/v1/auth/refresh")
    assert res.status_code == 200
    new_cookie = client.cookies.get("refresh_token")
    assert new_cookie and new_cookie != old_cookie

    # Replaying the pre-rotation token must fail.
    client.cookies.set("refresh_token", old_cookie, path="/api/v1/auth")
    res = await client.post("/api/v1/auth/refresh")
    assert res.status_code == 401


async def test_refresh_without_cookie_401(client):
    res = await client.post("/api/v1/auth/refresh")
    assert res.status_code == 401


async def test_unauthenticated_settings_401(client):
    res = await client.get("/api/v1/settings")
    assert res.status_code == 401


async def test_pin_set_verify_and_lockout(client):
    token = await login(client, "a@example.com", "pass-a")

    # No PIN yet -> 422 signals the setup flow.
    res = await client.post(
        "/api/v1/auth/pin/verify", headers=bearer(token), json={"pin": "123456"}
    )
    assert res.status_code == 422

    res = await client.put(
        "/api/v1/auth/pin",
        headers=bearer(token),
        json={"password": "pass-a", "pin": "123456"},
    )
    assert res.status_code == 200

    ok = await client.post(
        "/api/v1/auth/pin/verify", headers=bearer(token), json={"pin": "123456"}
    )
    assert ok.json() == {"ok": True}

    # Five wrong attempts lock the PIN...
    for _ in range(5):
        bad = await client.post(
            "/api/v1/auth/pin/verify", headers=bearer(token), json={"pin": "000000"}
        )
        assert bad.json() == {"ok": False}

    # ...so even the CORRECT pin is now rejected with 401.
    locked = await client.post(
        "/api/v1/auth/pin/verify", headers=bearer(token), json={"pin": "123456"}
    )
    assert locked.status_code == 401


async def test_pin_set_requires_password(client):
    token = await login(client, "a@example.com", "pass-a")
    res = await client.put(
        "/api/v1/auth/pin",
        headers=bearer(token),
        json={"password": "wrong", "pin": "123456"},
    )
    assert res.status_code == 401
