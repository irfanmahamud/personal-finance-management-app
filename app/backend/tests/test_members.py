from datetime import date

from tests.conftest import bearer, login


async def test_create_and_list_members(client):
    token = await login(client, "a@example.com", "pass-a")

    created = await client.post(
        "/api/v1/members", headers=bearer(token),
        json={"name": "Child One", "name_bn": "সন্তান", "relation": "child",
              "dob": "2020-05-01", "monthly_allowance": 50_000},
    )
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["active"] is True
    assert body["monthly_allowance"] == 50_000
    assert body["dob"] == "2020-05-01"

    listed = (await client.get("/api/v1/members", headers=bearer(token))).json()
    assert len(listed) == 1
    assert listed[0]["id"] == body["id"]


async def test_default_list_excludes_inactive_but_flag_includes(client):
    token = await login(client, "a@example.com", "pass-a")
    created = (
        await client.post(
            "/api/v1/members", headers=bearer(token), json={"name": "Grandparent"}
        )
    ).json()

    await client.patch(
        f"/api/v1/members/{created['id']}", headers=bearer(token), json={"active": False}
    )
    default_list = (await client.get("/api/v1/members", headers=bearer(token))).json()
    assert default_list == []

    with_inactive = (
        await client.get("/api/v1/members?include_inactive=true", headers=bearer(token))
    ).json()
    assert len(with_inactive) == 1
    assert with_inactive[0]["active"] is False


async def test_patch_updates_fields(client):
    token = await login(client, "a@example.com", "pass-a")
    created = (
        await client.post(
            "/api/v1/members", headers=bearer(token), json={"name": "Kid", "monthly_allowance": 10_000}
        )
    ).json()

    patched = await client.patch(
        f"/api/v1/members/{created['id']}", headers=bearer(token),
        json={"monthly_allowance": 20_000, "relation": "child"},
    )
    assert patched.status_code == 200
    body = patched.json()
    assert body["monthly_allowance"] == 20_000
    assert body["relation"] == "child"
    assert body["name"] == "Kid"  # untouched


async def test_members_scoped_to_household(client):
    token_a = await login(client, "a@example.com", "pass-a")
    token_b = await login(client, "b@example.com", "pass-b")
    created = (
        await client.post("/api/v1/members", headers=bearer(token_a), json={"name": "A's kid"})
    ).json()

    foreign = await client.patch(
        f"/api/v1/members/{created['id']}", headers=bearer(token_b), json={"monthly_allowance": 1}
    )
    assert foreign.status_code == 404

    foreign_list = (await client.get("/api/v1/members", headers=bearer(token_b))).json()
    assert foreign_list == []


async def test_expenses_filter_by_member(client):
    token = await login(client, "a@example.com", "pass-a")
    member = (
        await client.post("/api/v1/members", headers=bearer(token), json={"name": "Kid"})
    ).json()
    cat = (
        await client.post(
            "/api/v1/categories", headers=bearer(token),
            json={"name_en": "Health", "name_bn": "স্বাস্থ্য"},
        )
    ).json()["id"]

    import uuid as uuid_mod
    await client.post(
        "/api/v1/expenses", headers=bearer(token),
        json={"client_uuid": str(uuid_mod.uuid4()), "date": date.today().isoformat(),
              "category_id": cat, "amount": 5_000, "for_member_id": member["id"]},
    )
    await client.post(
        "/api/v1/expenses", headers=bearer(token),
        json={"client_uuid": str(uuid_mod.uuid4()), "date": date.today().isoformat(),
              "category_id": cat, "amount": 3_000},  # household, not this member
    )

    filtered = (
        await client.get(f"/api/v1/expenses?member_id={member['id']}", headers=bearer(token))
    ).json()
    assert filtered["total"] == 1
    assert filtered["items"][0]["amount"] == 5_000
