"""Every /api route must 401 an unauthenticated request - strictly.

The security audit found GET /debts/emi-calculator serving anonymous 200s:
without valid query params it 422'd, and a looser sweep read 422 as 'auth
kicked in'. This sweep supplies valid params so validation can never mask a
missing auth dependency, and accepts nothing but 401 (405 only for methods a
path doesn't implement).
"""

import httpx

from server.main import create_app

OPEN_PATHS = {
    "/api/v1/auth/login",
    "/api/v1/auth/signup",
    "/api/v1/auth/refresh",
    "/api/v1/auth/logout",
}

UUID0 = "00000000-0000-0000-0000-000000000000"

# Valid query strings per path, so a 422 can never stand in for the 401.
QUERY = {
    "/api/v1/debts/emi-calculator": "principal=100000&annual_rate_bps=1000&term_months=12",
    "/api/v1/reports/category": "date_from=2026-01-01&date_to=2026-01-31",
    "/api/v1/export/csv": "date_from=2026-01-01&date_to=2026-01-31",
    "/api/v1/reports/timeseries": "granularity=day",
}


async def test_every_api_route_rejects_unauthenticated():
    app = create_app()
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://t") as client:
        spec = app.openapi()
        failures = []
        for path, methods in spec["paths"].items():
            if not path.startswith("/api/") or path in OPEN_PATHS:
                continue
            for method in methods:
                if method not in ("get", "post", "patch", "put", "delete"):
                    continue
                concrete = path
                while "{" in concrete:
                    start = concrete.index("{")
                    end = concrete.index("}", start)
                    param = concrete[start + 1 : end]
                    concrete = concrete[:start] + ("2026-01" if param == "period" else UUID0) + concrete[end + 1 :]
                if path in QUERY:
                    concrete += f"?{QUERY[path]}"
                res = await client.request(method.upper(), concrete)
                if res.status_code != 401:
                    failures.append(f"{method.upper()} {path} -> {res.status_code}")
        assert not failures, failures
