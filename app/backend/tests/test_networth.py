from datetime import date

from tests.conftest import bearer, login


async def test_current_net_worth_combines_assets_investments_and_debts(client):
    token = await login(client, "a@example.com", "pass-a")

    await client.post(
        "/api/v1/networth/assets", headers=bearer(token),
        json={"category": "cash_bank", "name": "Savings account", "value": 200_000_00},
    )
    await client.post(
        "/api/v1/networth/assets", headers=bearer(token),
        json={"category": "vehicle", "name": "Car", "value": 800_000_00},
    )
    await client.post(
        "/api/v1/investments", headers=bearer(token),
        json={"instrument_type": "fdr", "name": "FDR", "amount": 100_000_00},
    )
    await client.post(
        "/api/v1/debts", headers=bearer(token),
        json={"name": "Car loan", "debt_type": "bank_loan", "principal": 300_000_00},
    )

    result = await client.get("/api/v1/networth/current", headers=bearer(token))
    assert result.status_code == 200, result.text
    body = result.json()
    assert body["cash_bank"] == 200_000_00
    assert body["vehicle"] == 800_000_00
    assert body["investments"] == 100_000_00
    assert body["total_assets"] == 200_000_00 + 800_000_00 + 100_000_00
    assert body["total_liabilities"] == 300_000_00
    assert body["net_worth"] == body["total_assets"] - 300_000_00


async def test_current_upserts_this_months_snapshot(client):
    token = await login(client, "a@example.com", "pass-a")
    await client.post(
        "/api/v1/networth/assets", headers=bearer(token),
        json={"category": "cash_bank", "name": "Cash", "value": 100_000_00},
    )

    await client.get("/api/v1/networth/current", headers=bearer(token))
    history_1 = (await client.get("/api/v1/networth/history", headers=bearer(token))).json()
    assert len(history_1) == 1
    assert history_1[0]["net_worth"] == 100_000_00

    # A second asset added, then viewing again updates THIS month's row,
    # not a duplicate.
    await client.post(
        "/api/v1/networth/assets", headers=bearer(token),
        json={"category": "cash_bank", "name": "More cash", "value": 50_000_00},
    )
    await client.get("/api/v1/networth/current", headers=bearer(token))
    history_2 = (await client.get("/api/v1/networth/history", headers=bearer(token))).json()
    assert len(history_2) == 1
    assert history_2[0]["net_worth"] == 150_000_00
    assert history_2[0]["snapshot_date"] == date.today().replace(day=1).isoformat()


async def test_asset_patch_records_new_valuation(client):
    token = await login(client, "a@example.com", "pass-a")
    created = (
        await client.post(
            "/api/v1/networth/assets", headers=bearer(token),
            json={"category": "gold_jewelry", "name": "Gold", "value": 50_000_00},
        )
    ).json()

    patched = await client.patch(
        f"/api/v1/networth/assets/{created['id']}", headers=bearer(token),
        json={"value": 60_000_00},
    )
    assert patched.status_code == 200, patched.text
    body = patched.json()
    assert body["value"] == 60_000_00
    assert body["valued_on"] == date.today().isoformat()
    assert body["logged_by_user_id"] is not None


async def test_deactivate_hides_asset_from_net_worth(client):
    token = await login(client, "a@example.com", "pass-a")
    created = (
        await client.post(
            "/api/v1/networth/assets", headers=bearer(token),
            json={"category": "property", "name": "Flat", "value": 5_000_000_00},
        )
    ).json()

    before = (await client.get("/api/v1/networth/current", headers=bearer(token))).json()
    assert before["property"] == 5_000_000_00

    await client.patch(
        f"/api/v1/networth/assets/{created['id']}", headers=bearer(token), json={"active": False}
    )
    after = (await client.get("/api/v1/networth/current", headers=bearer(token))).json()
    assert after["property"] == 0

    default_list = (await client.get("/api/v1/networth/assets", headers=bearer(token))).json()
    assert default_list == []
    with_inactive = (
        await client.get("/api/v1/networth/assets?include_inactive=true", headers=bearer(token))
    ).json()
    assert len(with_inactive) == 1


async def test_assets_scoped_to_household(client):
    token_a = await login(client, "a@example.com", "pass-a")
    token_b = await login(client, "b@example.com", "pass-b")
    created = (
        await client.post(
            "/api/v1/networth/assets", headers=bearer(token_a),
            json={"category": "other", "name": "Something", "value": 1_000_00},
        )
    ).json()

    foreign_patch = await client.patch(
        f"/api/v1/networth/assets/{created['id']}", headers=bearer(token_b), json={"value": 1}
    )
    assert foreign_patch.status_code == 404

    foreign_delete = await client.delete(
        f"/api/v1/networth/assets/{created['id']}", headers=bearer(token_b)
    )
    assert foreign_delete.status_code == 404

    foreign_list = (await client.get("/api/v1/networth/assets", headers=bearer(token_b))).json()
    assert foreign_list == []

    # Household B's own net worth must not see A's asset either.
    b_networth = (await client.get("/api/v1/networth/current", headers=bearer(token_b))).json()
    assert b_networth["total_assets"] == 0
