import uuid

from tests.conftest import bearer, login


async def _make_parent(client, token: str, name_en: str = "Food") -> str:
    res = await client.post(
        "/api/v1/categories", headers=bearer(token),
        json={"name_en": name_en, "name_bn": "খাবার"},
    )
    assert res.status_code == 201, res.text
    return res.json()["id"]


async def _make_sub(client, token: str, parent_id: str, name_en: str = "Groceries") -> str:
    res = await client.post(
        "/api/v1/categories", headers=bearer(token),
        json={"parent_id": parent_id, "name_en": name_en, "name_bn": "বাজার"},
    )
    assert res.status_code == 201, res.text
    return res.json()["id"]


def _expense_body(category_id: str) -> dict:
    return {
        "client_uuid": str(uuid.uuid4()),
        "date": "2026-08-30",
        "category_id": category_id,
        "amount": 50_000,
        "description": "bazar",
    }


async def test_delete_sub_category_uncategorizes_its_expenses(client):
    token = await login(client, "a@example.com", "pass-a")
    parent = await _make_parent(client, token)
    sub = await _make_sub(client, token, parent)

    created = await client.post(
        "/api/v1/expenses", headers=bearer(token), json=_expense_body(sub)
    )
    assert created.status_code == 201
    expense_id = created.json()["id"]

    deleted = await client.delete(f"/api/v1/categories/{sub}", headers=bearer(token))
    assert deleted.status_code == 204

    listed = await client.get("/api/v1/expenses", headers=bearer(token))
    body = listed.json()
    assert body["total"] == 1
    row = next(e for e in body["items"] if e["id"] == expense_id)
    assert row["category_id"] is None
    assert row["category_name_en"] is None
    assert row["category_name_bn"] is None

    # The category itself is gone, not just archived.
    tree = (await client.get("/api/v1/categories", headers=bearer(token))).json()
    parent_node = next(c for c in tree if c["id"] == parent)
    assert all(child["id"] != sub for child in parent_node["children"])


async def test_uncategorized_expense_still_counts_in_reports(client):
    token = await login(client, "a@example.com", "pass-a")
    parent = await _make_parent(client, token)
    sub = await _make_sub(client, token, parent)
    await client.post("/api/v1/expenses", headers=bearer(token), json=_expense_body(sub))
    await client.delete(f"/api/v1/categories/{sub}", headers=bearer(token))

    monthly = await client.get(
        "/api/v1/reports/monthly", headers=bearer(token), params={"month": "2026-08-01"}
    )
    report = monthly.json()
    assert report["total_spent"] == 50_000  # TOTALS doesn't join category - unaffected

    uncategorized = next((c for c in report["by_category"] if c["category_id"] is None), None)
    assert uncategorized is not None
    assert uncategorized["spent"] == 50_000
    assert uncategorized["name_en"] is None


async def test_cannot_delete_top_level_category(client):
    token = await login(client, "a@example.com", "pass-a")
    parent = await _make_parent(client, token)
    res = await client.delete(f"/api/v1/categories/{parent}", headers=bearer(token))
    assert res.status_code == 422


async def test_delete_scoped_to_household(client):
    token_a = await login(client, "a@example.com", "pass-a")
    token_b = await login(client, "b@example.com", "pass-b")
    parent = await _make_parent(client, token_a)
    sub = await _make_sub(client, token_a, parent)

    res = await client.delete(f"/api/v1/categories/{sub}", headers=bearer(token_b))
    assert res.status_code == 404

    # Untouched - still visible to household A.
    tree = (await client.get("/api/v1/categories", headers=bearer(token_a))).json()
    parent_node = next(c for c in tree if c["id"] == parent)
    assert any(child["id"] == sub for child in parent_node["children"])


async def test_recent_endpoint_survives_uncategorized_expense(client):
    """Regression: /expenses/recent groups by category_id including NULL -
    RecentOut.category_ranking must drop that row rather than fail Pydantic
    validation (list[UUID] can't hold None)."""
    token = await login(client, "a@example.com", "pass-a")
    parent = await _make_parent(client, token)
    sub = await _make_sub(client, token, parent)
    await client.post("/api/v1/expenses", headers=bearer(token), json=_expense_body(sub))
    await client.delete(f"/api/v1/categories/{sub}", headers=bearer(token))

    res = await client.get("/api/v1/expenses/recent", headers=bearer(token))
    assert res.status_code == 200
    body = res.json()
    assert body["last"]["category_id"] is None
    assert None not in body["category_ranking"]


async def test_cannot_delete_sub_category_used_by_recurring_rule(client):
    token = await login(client, "a@example.com", "pass-a")
    parent = await _make_parent(client, token)
    sub = await _make_sub(client, token, parent)
    await client.post(
        "/api/v1/recurring", headers=bearer(token),
        json={"name": "Internet", "category_id": sub, "amount": 100_000, "day_of_month": 5},
    )

    res = await client.delete(f"/api/v1/categories/{sub}", headers=bearer(token))
    assert res.status_code == 422
