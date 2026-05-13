# Trip Planner — Telegram Todo Bot

A collaborative todo-list bot for Telegram groups. Plan groceries, packing, and tasks during a trip — entirely from your group chat with bot commands. Optionally open a Mini App for a richer UI.

## Quick Start — Chat-only mode (recommended)

```bash
cp .env.example .env
# Edit .env: set BOT_TOKEN, generate JWT_SECRET, set CHAT_ONLY=true

npm run docker:chat:up
# or: docker compose -f compose.chat.yml up -d --build
```

Then in @BotFather:
1. `/mybots` → select your bot → **Bot Settings** → **Group Privacy** → **Turn off**
2. Add the bot to your Telegram group — it sends a welcome message with commands

That's it. A single Docker container runs the bot + SQLite. No domain, no nginx, no SSL needed.

### Full stack (with web Mini App)

```bash
# Requires a domain pointing to your VPS
cp .env.example .env
# Set: BOT_TOKEN, JWT_SECRET, DOMAIN, CHAT_ONLY=false

npm run docker:up
# or: docker compose up -d --build
```

Then configure the Mini App in @BotFather: **Bot Settings** → **Configure Mini App** → enter `https://yourdomain.com`.

## Deploy Modes

| Mode | Compose file | Ports | Needs domain | Needs SSL |
|------|-------------|-------|-------------|-----------|
| Chat-only | `compose.chat.yml` | 3001 (internal) | No | No |
| Full (prod) | `compose.yml` | 80, 443 | Yes | Yes |
| Dev (local) | `compose.dev.yml` | 3001 | No | No |

## Bot Commands

### List management

| Command | Description | Example |
|---------|-------------|---------|
| `/newlist <name>` | Create a new list | `/newlist Groceries` |
| `/switch <name>` | Switch active list | `/switch Packing` |
| `/lists` | Show all lists (👉 marks active) | — |
| `/list [name]` | Show items in a list (also sets active) | `/list Groceries` |
| `/current` | Show which list is active | — |
| `/deletelist <name>` | Delete a list and all items | `/deletelist Old` |

### Item management

| Command | Description | Example |
|---------|-------------|---------|
| `/add <items> [#category]` | Add one or more items (comma separated) | `/add milk, bread, eggs #groceries` |
| `/done <numbers>` | Mark items done (comma/space separated) | `/done 1,2,3` |
| `/undo <numbers>` | Undo marks | `/undo 1 3` |

### Help

| Command | Description |
|---------|-------------|
| `/start` | Welcome message + available commands |
| `/help` | Full command reference |

Categories: `#groceries` `#gear` `#tasks` — defaults to `#other`.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `BOT_TOKEN` | Yes | Telegram bot token from @BotFather |
| `JWT_SECRET` | Yes | `openssl rand -hex 32` |
| `CHAT_ONLY` | No | `true` = skip web app, run bot only |
| `DOMAIN` | Full stack | Domain for Mini App (`yourdomain.com`) |
| `DEV_MODE` | Dev | `true` = skip Telegram auth validation |
| `DB_PATH` | No | SQLite path (default: `./data/planning.db`) |
| `PORT` | No | Server port (default: `3001`) |

## Architecture

```
Chat-only mode:                    Full stack:
┌──────────────────┐     ┌──────────────────────────────┐
│ app (Node.js)    │     │ nginx :80/:443                │
│ :3001 internal   │     │   ├─ / → app:3001             │
│                  │     │   └─ /ws → app:3001           │
│ Express REST     │     │                               │
│ WebSocket        │     │ app (Node.js) :3001           │
│ grammY bot       │     │ Express + WS + Bot + SQLite   │
│ SQLite DB        │     └──────────────────────────────┘
└──────────────────┘
```

Bot uses polling (no webhook needed). All runtime in a single Node process.

## Local Development

### Option A: Docker backend

```bash
npm run docker:dev:up       # Backend with hot reload
npm install -w web && npm run dev:web   # Frontend Vite HMR → :5173
```

Backend hot-reloads via `tsx watch`. Source mounted as volume. DB persists in Docker volume.

Wipe DB: `npm run docker:dev:reset`

### Option B: Native

```bash
npm install
npm run dev:app    # → :3001
npm run dev:web    # → :5173
```

## Project Structure

```
planning-assistant/
├── app/                          # Backend (Express + Bot + WS + DB)
│   └── src/
│       ├── index.ts              # Entry point, auto-runs DB migration
│       ├── server.ts             # Express + WebSocket
│       ├── bot.ts                # grammY bot + mention handler
│       ├── db/                   # Drizzle ORM (SQLite)
│       ├── routes/               # REST API (/api/auth, /lists, /items)
│       ├── ws/                   # WebSocket room management
│       ├── bot-commands/         # Telegram command handlers
│       └── middleware/           # JWT auth
├── web/                          # React SPA (Mini App frontend)
│   └── src/
│       ├── components/           # ListTabs, TodoList, AddItemForm, etc.
│       ├── hooks/                # useTelegram, useWebSocket
│       └── lib/                  # API client
├── compose.yml                   # Full stack (nginx + app + certbot)
├── compose.chat.yml              # Chat-only (app only, no nginx)
├── compose.dev.yml               # Dev (app with hot reload + source mount)
├── deploy/
│   ├── Dockerfile                # Multi-stage: web-builder, app, dev
│   └── nginx.conf
├── .env.example
└── AGENTS.md                     # Development notes & gotchas
```

## Renewing SSL (full stack only)

```bash
docker compose --profile certbot run --rm certbot \
  certonly --webroot -w /var/www/certbot \
  -d yourdomain.com
```

Auto-renew cron:
```bash
0 3 * * * cd /path/to/project && docker compose --profile certbot run --rm certbot renew -q && docker compose exec nginx nginx -s reload
```
