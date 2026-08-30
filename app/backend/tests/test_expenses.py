import uuid

from tests.conftest import bearer, login


async def _make_category(client, token: str) -> str:
    res = await client.post(
        "/api/v1/categories",
        headers=bearer(token),
        json={"name_en": "Groceries", "name_bn": "বাজার"},
    )
    assert res.status_code == 201, res.text
    return res.json()["id"]


def _expense_body(category_id: str, client_uuid: str | None = None) -> dict:
    return {
        "client_uuid": client_uuid or str(uuid.uuid4()),
        "date": "2026-08-30",
        "category_id": category_id,
        "amount": 50_000,  # ৳500 in poisha
        "description": "bazar",
    }


async def test_create_and_list(client):
    token = await login(client, "a@example.com", "pass-a")
    cat = await _make_category(client, token)

    res = await client.post(
        "/api/v1/expenses", headers=bearer(token), json=_expense_body(cat)
    )
    assert res.status_code == 201
    body = res.json()
    assert body["amount"] == 50_000
    assert body["amount_bdt"] == 50_000  # defaults to amount for BDT
    assert body["category_name_bn"] == "বাজার"

    listed = await client.get("/api/v1/expenses", headers=bearer(token))
    assert listed.json()["total"] == 1


async def test_idempotent_replay_no_duplicate(client):
    """The offline-queue contract: replaying the same client_uuid returns
    the SAME row and never creates a second one."""
    token = await login(client, "a@example.com", "pass-a")
    cat = await _make_category(client, token)
    key = str(uuid.uuid4())

    first = await client.post(
        "/api/v1/expenses", headers=bearer(token), json=_expense_body(cat, key)
    )
    assert first.status_code == 201

    replay = await client.post(
        "/api/v1/expenses", headers=bearer(token), json=_expense_body(cat, key)
    )
    assert replay.status_code == 200  # replay signalled, not re-created
    assert replay.json()["id"] == first.json()["id"]

    listed = await client.get("/api/v1/expenses", headers=bearer(token))
    assert listed.json()["total"] == 1


async def test_household_scoping(client):
    """A token for household B must not see, modify, or delete A's rows."""
    token_a = await login(client, "a@example.com", "pass-a")
    token_b = await login(client, "b@example.com", "pass-b")
    cat_a = await _make_category(client, token_a)

    created = await client.post(
        "/api/v1/expenses", headers=bearer(token_a), json=_expense_body(cat_a)
    )
    expense_id = created.json()["id"]

    # B's list is empty.
    assert (await client.get("/api/v1/expenses", headers=bearer(token_b))).json()["total"] == 0

    # B cannot patch or delete A's expense - 404, indistinguishable from absent.
    patched = await client.patch(
        f"/api/v1/expenses/{expense_id}", headers=bearer(token_b), json={"amount": 1}
    )
    assert patched.status_code == 404
    deleted = await client.delete(
        f"/api/v1/expenses/{expense_id}", headers=bearer(token_b)
    )
    assert deleted.status_code == 404

    # B cannot log an expense into A's category.
    res = await client.post(
        "/api/v1/expenses", headers=bearer(token_b), json=_expense_body(cat_a)
    )
    assert res.status_code == 404

    # B cannot hijack A's client_uuid to read A's row.
    key = str(uuid.uuid4())
    await client.post(
        "/api/v1/expenses", headers=bearer(token_a), json=_expense_body(cat_a, key)
    )
    cat_b = await _make_category(client, token_b)
    hijack = await client.post(
        "/api/v1/expenses", headers=bearer(token_b), json=_expense_body(cat_b, key)
    )
    assert hijack.status_code == 404  # conflict exists but is not B's to see


async def test_patch_and_delete(client):
    token = await login(client, "a@example.com", "pass-a")
    cat = await _make_category(client, token)
    created = await client.post(
        "/api/v1/expenses", headers=bearer(token), json=_expense_body(cat)
    )
    expense_id = created.json()["id"]

    patched = await client.patch(
        f"/api/v1/expenses/{expense_id}",
        headers=bearer(token),
        json={"amount": 75_000},
    )
    assert patched.json()["amount"] == 75_000
    assert patched.json()["amount_bdt"] == 75_000

    res = await client.delete(f"/api/v1/expenses/{expense_id}", headers=bearer(token))
    assert res.status_code == 204
    assert (await client.get("/api/v1/expenses", headers=bearer(token))).json()["total"] == 0


async def test_recent_ranking(client):
    token = await login(client, "a@example.com", "pass-a")
    cat = await _make_category(client, token)
    for _ in range(3):
        await client.post(
            "/api/v1/expenses", headers=bearer(token), json=_expense_body(cat)
        )
    res = await client.get("/api/v1/expenses/recent", headers=bearer(token))
    body = res.json()
    assert body["last"]["category_id"] == cat
    assert body["category_ranking"][0] == cat
