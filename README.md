# Personal Finance App

A personal-first household finance manager for a Bangladeshi family. See
`finance_app_spec_v1.1.md` for the product spec (the product name is a
working title — nothing in the code is named after it).

## Layout

```
app/backend/    FastAPI + SQLAlchemy (async) + Alembic  — Python 3.11, uv
app/frontend/   Vite + React + TypeScript PWA           — npm
```

## Run (development)

Copy the environment template once:

```bash
cp .env.example .env   # then edit JWT_SECRET and the seed credentials
```

`BACKEND_PORT` in `.env` (default 8000) sets the API port everywhere —
uvicorn, the Vite dev/preview proxy, and `npm run gen:api` all follow it.

Everything at once (Postgres → migrations → backend + frontend):

```bash
make start
```

`make start-backend` does the same without the frontend; `make backend` /
`make frontend` run a single dev server (Postgres must already be up).
`make stop` stops Postgres; Ctrl+C stops the apps. `make seed` seeds the
database, `make test` runs both suites, `make gen-api` regenerates the
frontend API types. Or run the pieces by hand:

Start the database:

```bash
docker compose up -d
```

Backend (from `app/backend/`):

```bash
uv sync
uv run alembic upgrade head
uv run uvicorn server.main:app --reload --port 8000
```

Frontend (from `app/frontend/`):

```bash
npm install
npm run dev        # http://localhost:5173 — /api is proxied to :8000
```

After changing any Pydantic schema, regenerate the frontend API types
(backend must be running):

```bash
npm run gen:api
```

## Tests

```bash
cd app/backend && uv run pytest
cd app/frontend && npm test
```

## Production (single artifact)

Build the frontend, then let FastAPI serve it — one origin, one process:

```bash
cd app/frontend && npm run build
cd ../backend && STATIC_DIR=$(realpath ../frontend/dist) COOKIE_SECURE=true \
  uv run uvicorn server.main:app --host 0.0.0.0 --port 8000
```

Deploy behind TLS (`COOKIE_SECURE=true` requires it). To reach the app from
both phones, either host the container + a managed Postgres, or expose a
self-hosted instance over Tailscale.

## Deploy to an Ubuntu droplet

A concrete walkthrough for a fresh Ubuntu 22.04/24.04 VPS (DigitalOcean,
Linode, a bare EC2 instance — anything with root SSH access). 1 vCPU / 2GB
RAM is enough for a two-user household app.

### 1. Provision and do initial server setup

Create the droplet, then SSH in as `root` and make a non-root sudo user
(never run the app as root):

```bash
adduser deploy
usermod -aG sudo deploy
rsync --archive --chown=deploy:deploy ~/.ssh /home/deploy   # copy your SSH key over
```

From here on, SSH in as `deploy@<droplet-ip>`. Lock down the firewall —
only SSH, HTTP, and HTTPS need to be reachable; Postgres and the app's own
port (8000) stay internal:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### 2. Install the toolchain

```bash
# Docker (for Postgres) + Compose plugin
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
newgrp docker   # or log out/in for the group change to take effect

# uv (Python 3.11 + package manager, installs its own Python)
curl -LsSf https://astral.sh/uv/install.sh | sh
source $HOME/.local/bin/env

# Node.js 22 (only needed once, to build the frontend bundle)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# Nginx (TLS termination + reverse proxy) and Certbot
sudo apt-get install -y nginx certbot python3-certbot-nginx
```

### 3. Get the code and configure secrets

```bash
git clone <your-repo-url> hishabi   # or scp/rsync the repo up
cd hishabi
cp .env.example .env
```

Edit `.env`: set a long random `JWT_SECRET` (`openssl rand -hex 32`), real
`SEED_USER_1_EMAIL`/`SEED_USER_1_PASSWORD` (and user 2), a strong
`POSTGRES_PASSWORD`, and leave `BACKEND_PORT=8000` unless something else on
the box already uses it. If you change `POSTGRES_PASSWORD`, update the
password embedded in `DATABASE_URL` to match — it isn't derived
automatically.

### 4. Bring up Postgres, migrate, seed

```bash
docker compose up -d
cd app/backend
uv sync
set -a && source ../../.env && set +a
uv run alembic upgrade head
uv run python -m server.db.seed
```

### 5. Build the frontend

```bash
cd ../frontend
npm ci
npm run build      # -> app/frontend/dist
```

### 6. Run the backend as a systemd service

One origin, one process — FastAPI serves the built SPA directly
(`STATIC_DIR`), so there's no separate frontend server or CORS to manage.

```bash
sudo tee /etc/systemd/system/hishabi.service > /dev/null <<'EOF'
[Unit]
Description=Hishabi finance app
After=network.target docker.service

[Service]
Type=simple
User=deploy
WorkingDirectory=/home/deploy/hishabi/app/backend
EnvironmentFile=/home/deploy/hishabi/.env
Environment=STATIC_DIR=/home/deploy/hishabi/app/frontend/dist
Environment=COOKIE_SECURE=true
ExecStart=/home/deploy/.local/bin/uv run uvicorn server.main:app --host 127.0.0.1 --port 8000
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now hishabi
sudo systemctl status hishabi   # should be active (running)
```

The service binds to `127.0.0.1` only — Nginx is the one thing exposed to
the internet, matching the firewall rules from step 1.

### 7. Nginx reverse proxy + TLS

Point your domain's DNS `A` record at the droplet's IP first, then:

```bash
sudo tee /etc/nginx/sites-available/hishabi > /dev/null <<'EOF'
server {
    listen 80;
    server_name your-domain.example;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

sudo ln -s /etc/nginx/sites-available/hishabi /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# Certbot rewrites the server block above for HTTPS and sets up auto-renewal
sudo certbot --nginx -d your-domain.example
```

The app is now reachable at `https://your-domain.example` from both
phones — `COOKIE_SECURE=true` works because TLS terminates at Nginx.

**No domain yet?** Use [Tailscale](https://tailscale.com) instead: `sudo
tailscale up` on the droplet, install Tailscale on both phones, and reach
the app over the tailnet. `tailscale serve https / http://127.0.0.1:8000`
gives you a real HTTPS cert on the `*.ts.net` hostname with no public DNS
or Certbot needed — skip step 7 entirely in that case.

### 8. Updating after a code change

```bash
cd ~/hishabi && git pull
cd app/backend && uv sync && uv run alembic upgrade head
cd ../frontend && npm ci && npm run build
sudo systemctl restart hishabi
```

### 9. Useful operational commands

```bash
sudo systemctl status hishabi        # is it running
sudo journalctl -u hishabi -f        # tail app logs
docker compose logs -f db            # tail Postgres logs
docker compose exec db pg_dump -U finance finance > backup-$(date +%F).sql
```

## End-to-end tests

Playwright drives the built app (service worker active) against the local
backend. One-time system dependency:

```bash
sudo npx playwright install-deps chromium
```

Then, with the backend running and the database seeded:

```bash
cd app/frontend && npm run test:e2e
```

## Definition of Done — status

| # | Criterion | Status |
|---|---|---|
| 1 | Expense entry < 5s | Flow built for 3 taps; **measure on a real phone** |
| 2 | Airplane-mode write syncs, no duplicates | Queue logic unit-tested; e2e written (needs install-deps) |
| 3 | TDS matches last year within ৳1 | **Blocked on verified NBR slabs** (spec §13 Q1) |
| 4 | Reports reconcile with CSV | Automated test passes |
| 5 | Both languages, 1,00,000 grouping | Formatting unit-tested; toggle on every screen |
| 6 | Installs to Android home screen | Manifest + SW built; **confirm on a device** |
| 7 | Both users, logged-by + for-whom recorded | logged-by automatic; for-member UI arrives with Phase 2 members |
| 8 | No family names in source | grep clean |
