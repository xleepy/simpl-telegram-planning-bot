# AGENTS.md — Development Notes & Gotchas

## Golden rule: ask when in doubt

If you are unsure about a user's intent, a configuration value, a runtime behavior, or the correct approach — **ask the user before making changes**. Do not guess. A 30-second clarification prevents hours of debugging.

## CLI availability

Several Docker Compose files serve different purposes:

| File | Purpose | Start command |
|------|---------|---------------|
| `compose.chat.yml` | Production chat-only (bot + DB, no nginx) | `npm run docker:chat:up` |
| `compose.yml` | Full stack (nginx + app + certbot) | `npm run docker:up` |
| `compose.dev.yml` | Dev (app with hot reload + source mount) | `npm run docker:dev:up` |

## Architecture decisions

### Why CommonJS for the backend

The app (`app/`) compiles TypeScript to JavaScript and runs via `node dist/index.js` in production. ESM requires `.js` extensions on all relative imports (`import './foo.js'`), which TypeScript can be configured to require in source, but CommonJS works without them. Avoid ESM churn — keep `"module": "CommonJS"` in `app/tsconfig.json` and remove `"type": "module"` from `app/package.json`.

### Why SQLite + Drizzle ORM

Single-file, zero-config database. No separate DB container needed. `drizzle-kit push` syncs the schema on every startup — no migration files to maintain for this scale.

### Why polling instead of webhooks

The bot uses grammY polling (long-polling). No inbound webhook URL needed, no public endpoint required. Works behind NAT, ngrok, or any VPS without inbound firewall rules. The trade-off is ~1-2s latency vs webhooks, which is fine for a todo bot.

### Why a single Node process

Express HTTP server, WebSocket server, and grammY bot all run in one Node event loop. They share the same SQLite connection (no locking issues) and start together from `app/src/index.ts`. No IPC, no process manager needed inside the container.

## Common gotchas

### Docker: npm ci fails with workspaces

npm workspaces store `package-lock.json` at the **repo root**, not inside `app/` or `web/`. The Dockerfile copies only the workspace's `package.json`, so `npm ci` can't find the lockfile. **Use `npm install` in Dockerfiles** instead of `npm ci`.

### Docker: missing `target` in compose.yml

Without `target: app` in `compose.yml`, Docker builds all stages and uses the **last one** (`dev`). The dev stage expects source mounted via volume — without it, the container crashes with `Cannot find module '/app/src/index.ts'`. Always specify `target: app` for production.

### Docker: restart does not reload .env

`docker compose restart` reuses the existing container with its original environment. `.env` changes are only picked up by `docker compose up -d` (which recreates the container).

### DB: no such table on first run

`drizzle-kit push` must run on every startup to ensure tables exist. It was originally gated behind `DEV_MODE=true` and failed in production. Now it runs unconditionally in `index.ts`. `drizzle-kit` must be a regular dependency (not devDependency) so it survives `npm prune --omit=dev`.

### Telegram: web_app buttons and domain registration

`web_app` inline keyboard buttons require the domain to be registered in @BotFather (**Configure Mini App**, not just **Menu Button**). This domain must match the URL in the button exactly. ngrok free tier changes URLs every restart, breaking this. Solutions:
- Use `CHAT_ONLY=true` to skip web_app buttons entirely
- Use ngrok's free static domain (`--domain=your-name.ngrok-free.app`)
- Use a real domain with certbot SSL

### Telegram: bot privacy mode blocks mentions

By default, bots in groups only see `/commands` and replies to their own messages. To handle mentions (`@botname`), the bot's **Group Privacy must be turned off** in @BotFather. Even then, the bot sees **all** group messages — the mention handler filters client-side.

### Telegram: chat_instance ≠ ctx.chat.id

The Mini App initData provides `chat_instance` (an opaque hash) which is different from `ctx.chat.id` (the actual Telegram chat ID). For scoping to match between Mini App and bot commands, extract `chat.id` from initData's `chat` field. The bot falls back to `chat_instance` if `chat` is absent (private chat with bot).

### Frontend: optimistic updates cause duplicates

When the React app both optimistically updates local state AND receives the same update via WebSocket broadcast, items appear twice. Solution: do **not** update local state optimistically in mutation handlers. Let the WebSocket broadcast be the single source of truth.

### Frontend: changing useCallback deps causes WS reconnection

`useWebSocket`'s `onMessage` callback depends on `activeListId`. When the user switches tabs, the callback reference changes, the WebSocket disconnects and reconnects. Solution: use a `useRef` for the active list ID inside the callback — keep the callback dependency array empty (`[]`).

### Frontend: Vite blocks ngrok hosts

Vite's dev server rejects unknown hosts by default. Add `allowedHosts: ['.ngrok-free.app']` in `vite.config.ts` for Telegram testing via ngrok.

### Host nginx conflicts with Docker nginx

If the VPS has a host-level nginx running on ports 80/443, the Docker nginx container can't bind them. Stop and disable the host nginx: `sudo systemctl stop nginx && sudo systemctl disable nginx`.

### Let's Encrypt rate limits

50 certificates per registered domain per week. If you hit this, switch to the staging environment for testing or wait for the reset window shown in the error.

## Adding new bot commands

1. Add the handler to the appropriate file in `app/src/bot-commands/`
2. Register it in the setup function exported from that file
3. The setup functions are called from `app/src/bot.ts` → `createBot()`
4. Update `/help` and `/start` text in `bot-commands/start.ts`
5. Update the command table in README

Each chat has an in-memory "active list" tracked in `bot-commands/lists.ts` via `activeLists` Map. Use `getActiveList(chatId)` and `setActiveList(chatId, listId)` to manage it. This is ephemeral — lost on restart, but harmless (user just re-selects with `/switch` or `/list`).

## Adding frontend components

1. Create the component in `web/src/components/`
2. Import and use in `App.tsx`
3. For new hooks, add to `web/src/hooks/`
4. The Vite dev server proxies `/api` and `/ws` to `localhost:3001` (Docker or local)

## Testing with ngrok

```bash
# Claim free static domain at https://dashboard.ngrok.com/cloud-edge/domains
ngrok http --domain=your-name.ngrok-free.app 5173

# Update .env: DOMAIN=your-name.ngrok-free.app
# Update @BotFather: Configure Mini App → https://your-name.ngrok-free.app
```

Point ngrok at Vite (:5173), not Express (:3001). Vite proxies API/WS calls to the backend automatically and serves the React app with HMR.
