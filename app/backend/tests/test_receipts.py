import uuid

from tests.conftest import bearer, login

TINY_PNG = bytes.fromhex(
    "89504e470d0a1a0a0000000d4948445200000001000000010802000000907753"
    "de0000000c4944415478da6360606060000000050001a5f645400000000049454e44ae426082"
)


async def _make_category(client, token: str) -> str:
    res = await client.post(
        "/api/v1/categories", headers=bearer(token),
        json={"name_en": "Groceries", "name_bn": "বাজার"},
    )
    return res.json()["id"]


async def test_upload_and_fetch_receipt(client):
    token = await login(client, "a@example.com", "pass-a")

    uploaded = await client.post(
        "/api/v1/receipts", headers=bearer(token),
        files={"file": ("receipt.png", TINY_PNG, "image/png")},
    )
    assert uploaded.status_code == 201, uploaded.text
    body = uploaded.json()
    assert body["mime_type"] == "image/png"
    assert body["size_bytes"] == len(TINY_PNG)

    fetched = await client.get(f"/api/v1/receipts/{body['id']}", headers=bearer(token))
    assert fetched.status_code == 200
    assert fetched.content == TINY_PNG
    assert fetched.headers["content-type"] == "image/png"


async def test_upload_rejects_unsupported_type(client):
    token = await login(client, "a@example.com", "pass-a")
    result = await client.post(
        "/api/v1/receipts", headers=bearer(token),
        files={"file": ("doc.pdf", b"%PDF-1.4 fake", "application/pdf")},
    )
    assert result.status_code == 422


async def test_upload_rejects_oversized_file(client):
    token = await login(client, "a@example.com", "pass-a")
    too_big = b"\x00" * (8 * 1024 * 1024 + 1)
    result = await client.post(
        "/api/v1/receipts", headers=bearer(token),
        files={"file": ("big.jpg", too_big, "image/jpeg")},
    )
    assert result.status_code == 422


async def test_attach_receipt_to_expense_on_create_and_patch(client):
    token = await login(client, "a@example.com", "pass-a")
    cat = await _make_category(client, token)
    receipt_id = (
        await client.post(
            "/api/v1/receipts", headers=bearer(token),
            files={"file": ("receipt.png", TINY_PNG, "image/png")},
        )
    ).json()["id"]

    created = await client.post(
        "/api/v1/expenses", headers=bearer(token),
        json={"client_uuid": str(uuid.uuid4()), "date": "2026-08-30",
              "category_id": cat, "amount": 50_000, "receipt_id": receipt_id},
    )
    assert created.status_code == 201, created.text
    assert created.json()["receipt_id"] == receipt_id

    # Attach after the fact via PATCH too.
    other_receipt_id = (
        await client.post(
            "/api/v1/receipts", headers=bearer(token),
            files={"file": ("receipt2.png", TINY_PNG, "image/png")},
        )
    ).json()["id"]
    patched = await client.patch(
        f"/api/v1/expenses/{created.json()['id']}", headers=bearer(token),
        json={"receipt_id": other_receipt_id},
    )
    assert patched.status_code == 200
    assert patched.json()["receipt_id"] == other_receipt_id


async def test_receipts_scoped_to_household(client):
    token_a = await login(client, "a@example.com", "pass-a")
    token_b = await login(client, "b@example.com", "pass-b")
    receipt_id = (
        await client.post(
            "/api/v1/receipts", headers=bearer(token_a),
            files={"file": ("receipt.png", TINY_PNG, "image/png")},
        )
    ).json()["id"]

    foreign_fetch = await client.get(f"/api/v1/receipts/{receipt_id}", headers=bearer(token_b))
    assert foreign_fetch.status_code == 404

    foreign_delete = await client.delete(f"/api/v1/receipts/{receipt_id}", headers=bearer(token_b))
    assert foreign_delete.status_code == 404

    cat_b = await _make_category(client, token_b)
    cross_household_attach = await client.post(
        "/api/v1/expenses", headers=bearer(token_b),
        json={"client_uuid": str(uuid.uuid4()), "date": "2026-08-30",
              "category_id": cat_b, "amount": 1_000, "receipt_id": receipt_id},
    )
    assert cross_household_attach.status_code == 404


async def test_delete_receipt(client):
    token = await login(client, "a@example.com", "pass-a")
    receipt_id = (
        await client.post(
            "/api/v1/receipts", headers=bearer(token),
            files={"file": ("receipt.png", TINY_PNG, "image/png")},
        )
    ).json()["id"]

    deleted = await client.delete(f"/api/v1/receipts/{receipt_id}", headers=bearer(token))
    assert deleted.status_code == 204

    missing = await client.get(f"/api/v1/receipts/{receipt_id}", headers=bearer(token))
    assert missing.status_code == 404
