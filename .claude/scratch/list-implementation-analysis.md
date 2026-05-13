# List Implementation Analysis — planning-assistant

## 1. Database Schema

**File:** `/Users/lain/repos/planning-assistant/app/src/db/schema.ts`

The `lists` table (Drizzle ORM, SQLite):

```ts
export const lists = sqliteTable('lists', {
  id: text('id').primaryKey(),              // UUID v4
  chatInstance: text('chat_instance').notNull(), // Telegram chat ID (scoping)
  name: text('name').notNull(),             // human-readable name
  createdBy: text('created_by').notNull(),  // Telegram user ID
  createdAt: text('created_at').notNull(),  // ISO 8601 timestamp
});
```

The `items` table references lists via a foreign key with `ON DELETE CASCADE`:

```ts
listId: text('list_id').notNull().references(() => lists.id, { onDelete: 'cascade' }),
```

**DB initialization:** `/Users/lain/repos/planning-assistant/app/src/db/index.ts`
- Uses `better-sqlite3` + `drizzle-orm/better-sqlite3`
- DB file at `./data/planning.db` (configurable via `DB_PATH` env var)
- WAL journal mode, foreign keys ON
- Schema pushed on startup via `npx drizzle-kit push` in `app/src/index.ts` (line 8)

**Key pattern:** All IDs are UUID v4 strings. Timestamps are ISO 8601 text strings. Lists are scoped to a `chatInstance` (the Telegram chat ID).

---

## 2. API Routes (REST)

### List Routes: `/Users/lain/repos/planning-assistant/app/src/routes/lists.ts`

All routes are mounted at `/api/lists` and require JWT auth via `authMiddleware`.

| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/api/lists` | (inline) | Fetch all lists for `chatInstance`, ordered by `createdAt` |
| `POST` | `/api/lists` | (inline) | Create a new list. Body: `{ name: string }`. Checks for duplicate names. Returns 201. |
| `PATCH` | `/api/lists/:id` | (inline) | Rename a list. Body: `{ name: string }`. Checks ownership via `chatInstance`. Checks for duplicate names (excluding self). |
| `DELETE` | `/api/lists/:id` | (inline) | Delete a list. Checks ownership. Cascades to items automatically. Returns `{ deleted: true }`. |

**Key patterns:**
- All operations scope by `req.auth!.chatInstance` (from JWT)
- Name uniqueness is enforced per chat (duplicate check before create/rename)
- 409 Conflict returned for duplicate names
- 404 returned when list not found or doesn't belong to chat
- `userId` stored as `createdBy` on create

### Item Routes: `/Users/lain/repos/planning-assistant/app/src/routes/items.ts`

Mounted at `/api/lists` as well (shared base path). All routes require JWT auth.

| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/api/lists/:listId/items` | (inline) | Get all items for a list, ordered by `createdAt` |
| `POST` | `/api/lists/:listId/items` | (inline) | Add item. Body: `{ text, category? }`. **Broadcasts** `item_added` via WebSocket. |
| `PATCH` | `/api/lists/:listId/items/:itemId` | (inline) | Update item. Body: `{ text?, completed?, category? }`. **Broadcasts** `item_updated`. |
| `DELETE` | `/api/lists/:listId/items/:itemId` | (inline) | Delete item. **Broadcasts** `item_deleted`. |

**Note:** List create/rename/delete operations do NOT broadcast via WebSocket (unlike item operations). Only item CRUD broadcasts to other clients.

### Auth Routes: `/Users/lain/repos/planning-assistant/app/src/routes/auth.ts`

Mounted at `/api/auth`. Returns JWT token with `{ userId, chatInstance }` payload. The `chatInstance` is extracted from Telegram initData's `chat.id` field (or falls back to `chat_instance` hash or `user-{id}` for private chats).

### Server mounting: `/Users/lain/repos/planning-assistant/app/src/server.ts`

```ts
app.use('/api', authRoutes);       // /api/auth
app.use('/api/lists', listRoutes);  // /api/lists
app.use('/api/lists', itemRoutes);  // /api/lists/:listId/items
```

---

## 3. Bot Commands

### List commands: `/Users/lain/repos/planning-assistant/app/src/bot-commands/lists.ts`

**In-memory active list tracking:**

```ts
const activeLists = new Map<string, string>();  // chatId -> listId
export function getActiveList(chatId: string): string | undefined;
export function setActiveList(chatId: string, listId: string): void;
```

This is ephemeral — lost on restart.

| Command | Handler | Description |
|---------|---------|-------------|
| `/newlist <name>` | `bot.command('newlist', ...)` | Create a list. Checks duplicates. Auto-sets as active. |
| `/lists` | `bot.command('lists', ...)` | List all lists for chat. Shows 👉 for active list. If empty, may show Mini App button (unless `CHAT_ONLY=true`). |
| `/deletelist <name>` | `bot.command('deletelist', ...)` | Delete list by name. Clears active list if it was the deleted one. |
| `/current` | `bot.command('current', ...)` | Show active list name. |
| `/switch <name>` | `bot.command('switch', ...)` | Switch active list by name. |

### Item commands: `/Users/lain/repos/planning-assistant/app/src/bot-commands/items.ts`

Imports `{ getActiveList, setActiveList }` from `./lists`.

| Command | Handler | Description |
|---------|---------|-------------|
| `/add <text> [#category]` | `bot.command('add', ...)` | Add items to active list. Supports comma/newline-separated items and `#category` suffix. Auto-creates a "Default" list if none exists. |
| `/list [name]` | `bot.command('list', ...)` | Show list items. With name arg: switches to that list and shows it. Without: shows active list. Sets active list as side effect. |
| `/done <numbers>` | `bot.command('done', ...)` | Mark items done by 1-based index. |
| `/undo <numbers>` | `bot.command('undo', ...)` | Unmark items. |

### Bot setup: `/Users/lain/repos/planning-assistant/app/src/bot.ts`

```ts
import { setupListCommands } from "./bot-commands/lists";
// ...
setupListCommands(bot);  // called in createBot()
```

### Start/help: `/Users/lain/repos/planning-assistant/app/src/bot-commands/start.ts`

Documents all commands including list commands in `/start` and `/help` responses.

---

## 4. Frontend Components

### App root: `/Users/lain/repos/planning-assistant/web/src/App.tsx`

**State management:**

```ts
const [lists, setLists] = useState<ListData[]>([]);
const [activeListId, setActiveListId] = useState<string | null>(null);
const [items, setItems] = useState<ItemData[]>([]);
const [showListManager, setShowListManager] = useState(false);
```

**Data flow:**
1. Auth → JWT token
2. `api.getLists()` → `setLists(result)` → first list becomes `activeListId`
3. When `activeListId` changes → `api.getItems(activeListId)` → `setItems(result)`
4. WebSocket messages filtered by `activeListIdRef.current` to avoid stale closures

**List CRUD handlers (all call `apiWithToken(auth.token)`):**

| Handler | API call | Local state update |
|---------|----------|-------------------|
| `handleCreateList(name)` | `api.createList(name)` | `setLists(prev => [...prev, list])` + set as active |
| `handleRenameList(id, name)` | `api.renameList(id, name)` | `setLists(prev => prev.map(...))` |
| `handleDeleteList(id)` | `api.deleteList(id)` | `setLists(prev => prev.filter(...))` + clear active if needed |

**Important gotcha from AGENTS.md:** The frontend does NOT optimistically update local state for items (only lists). Item mutations rely on WebSocket broadcasts as the single source of truth to avoid duplicates.

### ListTabs: `/Users/lain/repos/planning-assistant/web/src/components/ListTabs.tsx`

Horizontal scrollable tab bar showing list names. Active tab highlighted. "+" button opens ListManager. Props:
- `lists`: `{ id, name }[]`
- `activeListId`: string | null
- `onSelect`: `(id: string) => void`
- `onCreate`: `() => void` (opens ListManager modal)

### ListManager: `/Users/lain/repos/planning-assistant/web/src/components/ListManager.tsx`

Modal dialog for list management. Props:
- `lists`, `activeListId`
- `onClose`, `onCreate`, `onRename`, `onDelete`

Features:
- **Create:** Text input + "Create" button (Enter to submit)
- **Rename:** Inline edit (click "Rename" → shows input + Save/Cancel buttons)
- **Delete:** "Delete" button with `window.confirm()` confirmation
- Active list highlighted with CSS class `active-list`
- Empty state message: "No lists yet. Create one above."

### Other components:

| Component | File | Role |
|-----------|------|------|
| `TodoList` | `/Users/lain/repos/planning-assistant/web/src/components/TodoList.tsx` | Renders items split into pending/completed sections. Delegates to `ItemRow`. |
| `ItemRow` | `/Users/lain/repos/planning-assistant/web/src/components/ItemRow.tsx` | Single item: checkbox toggle + category dot + text + delete button. |
| `AddItemForm` | `/Users/lain/repos/planning-assistant/web/src/components/AddItemForm.tsx` | Text input + category picker (Groceries/Gear/Tasks/Other) + Add button. |
| `PresenceBar` | `/Users/lain/repos/planning-assistant/web/src/components/PresenceBar.tsx` | Shows online user dots (fed by WebSocket `presence` events). |
| `CategoryDot` | `/Users/lain/repos/planning-assistant/web/src/components/CategoryDot.tsx` | Colored dot per category. |

---

## 5. Frontend API Library

**File:** `/Users/lain/repos/planning-assistant/web/src/lib/api.ts`

```ts
export function apiWithToken(token: string) {
  const headers = getAuthHeader(token);
  return {
    getLists:    () => request<any[]>('/lists', { headers }),
    createList:  (name) => request<any>('/lists', { method: 'POST', headers, body: { name } }),
    renameList:  (id, name) => request<any>(`/lists/${id}`, { method: 'PATCH', headers, body: { name } }),
    deleteList:  (id) => request<any>(`/lists/${id}`, { method: 'DELETE', headers }),
    getItems:    (listId) => request<any[]>(`/lists/${listId}/items`, { headers }),
    addItem:     (listId, text, category) => request<any>(`/lists/${listId}/items`, { method: 'POST', headers, body: { text, category } }),
    updateItem:  (listId, itemId, updates) => request<any>(`/lists/${listId}/items/${itemId}`, { method: 'PATCH', headers, body: updates }),
    deleteItem:  (listId, itemId) => request<any>(`/lists/${listId}/items/${itemId}`, { method: 'DELETE', headers }),
  };
}
```

Base path: `/api`. All requests use `Content-Type: application/json` and `Authorization: Bearer <token>`.

---

## 6. WebSocket Events

**File:** `/Users/lain/repos/planning-assistant/app/src/ws/rooms.ts`

**Room model:** `Map<chatInstance, Set<Client>>` — each Telegram chat is a room.

**Client structure:**
```ts
{ ws: WebSocket, userId: string, chatInstance: string, firstName: string }
```

**Events broadcast by the server:**

| Event type | Triggered by | Payload |
|------------|-------------|---------|
| `item_added` | `POST /api/lists/:listId/items` | `{ type, listId, item }` |
| `item_updated` | `PATCH /api/lists/:listId/items/:itemId` | `{ type, listId, item }` |
| `item_deleted` | `DELETE /api/lists/:listId/items/:itemId` | `{ type, listId, itemId }` |
| `presence` | Client connects/disconnects, sends `hello` | `{ type, users: [{ userId, firstName }] }` |

**IMPORTANT: List create/rename/delete operations do NOT broadcast via WebSocket.** Only item-level changes are broadcast. This means when one user creates/deletes/renames a list, other connected clients in the same chat do NOT see the change in real time — they would need to refresh.

**Frontend WebSocket hook:** `/Users/lain/repos/planning-assistant/web/src/hooks/useWebSocket.ts`
- Connects to `ws://host/ws?token=<jwt>`
- Sends `{ type: 'hello', firstName }` on open
- Auto-reconnects every 3 seconds on close
- Returns `{ send }` for outbound messages

**Message handling in App.tsx** (line 58-85):
```ts
const handleWsMessage = useCallback((data) => {
  switch (data.type) {
    case 'item_added':    // append to items if same listId
    case 'item_updated':  // replace item in items if same listId
    case 'item_deleted':  // remove item from items if same listId
    case 'presence':      // update onlineUsers
  }
}, []);  // empty deps — uses activeListIdRef to avoid reconnection
```

---

## 7. JWT Auth Middleware

**File:** `/Users/lain/repos/planning-assistant/app/src/middleware/jwt-auth.ts`

- `signToken({ userId, chatInstance })` → JWT with 7-day expiry
- `verifyToken(token)` → `{ userId, chatInstance }` payload
- `authMiddleware` → Express middleware that extracts `Authorization: Bearer <token>`, verifies, and sets `req.auth`

All list and item routes use `authMiddleware`. The bot bypasses JWT entirely — it uses Telegram's built-in auth.

---

## 8. CRUD Patterns Summary

### Pattern for creating a list:

1. **Frontend:** User types name in `ListManager` → `handleCreateList(name)` in `App.tsx`
2. **API call:** `POST /api/lists` with `{ name }` → JWT auth extracts `chatInstance` and `userId`
3. **Backend:** Checks duplicate name → generates UUID → inserts into `lists` table → returns 201 with full list object
4. **Frontend:** Appends to `lists` state, sets as `activeListId`
5. **No WebSocket broadcast** — other clients won't see the new list until page refresh

### Pattern for renaming a list:

1. **Frontend:** `ListManager` inline edit → `handleRenameList(id, name)` in `App.tsx`
2. **API call:** `PATCH /api/lists/:id` with `{ name }`
3. **Backend:** Validates ownership (checks `chatInstance`) → checks duplicate name → updates DB → returns updated list
4. **Frontend:** Maps over `lists` state to update name
5. **No WebSocket broadcast**

### Pattern for deleting a list:

1. **Frontend:** `ListManager` → confirm dialog → `handleDeleteList(id)` in `App.tsx`
2. **API call:** `DELETE /api/lists/:id`
3. **Backend:** Validates ownership → deletes (cascades to items via FK) → returns `{ deleted: true }`
4. **Frontend:** Filters list from `lists` state; if deleted list was active, picks first remaining list or null
5. **No WebSocket broadcast**

### Pattern for the bot (list commands):

1. Bot uses `/newlist`, `/deletelist`, `/switch` — direct DB operations
2. Active list tracked in `Map<chatId, listId>` (ephemeral in-memory, lost on restart)
3. On `/add` with no active list, auto-creates "Default" list (or uses first existing)
4. On `/delete`, clears active list if the deleted one was active

---

## 9. All File Paths (for reference)

```
app/src/db/schema.ts              — Drizzle schema (lists + items tables)
app/src/db/index.ts               — DB connection setup (better-sqlite3 + drizzle)
app/src/db/migrate.ts             — Drizzle migration helper
app/src/routes/lists.ts           — REST API: GET/POST/PATCH/DELETE /api/lists
app/src/routes/items.ts           — REST API: GET/POST/PATCH/DELETE /api/lists/:listId/items
app/src/routes/auth.ts            — REST API: POST /api/auth
app/src/middleware/jwt-auth.ts    — JWT sign/verify + authMiddleware
app/src/ws/rooms.ts               — WebSocket rooms (broadcast, addClient, removeClient)
app/src/server.ts                 — Express + WS server setup, route mounting
app/src/index.ts                  — Entry point (DB push, start server + bot)
app/src/bot.ts                    — Bot creation, command registration
app/src/bot-commands/lists.ts     — Bot commands: /newlist, /lists, /deletelist, /current, /switch
app/src/bot-commands/items.ts     — Bot commands: /add, /list, /done, /undo
app/src/bot-commands/start.ts     — Bot commands: /start, /help
web/src/App.tsx                   — Frontend root: state, handlers, layout
web/src/lib/api.ts                — Frontend API client (apiWithToken)
web/src/components/ListManager.tsx — Modal for create/rename/delete lists
web/src/components/ListTabs.tsx    — Horizontal tab bar for list switching
web/src/components/TodoList.tsx    — Item list (pending/completed split)
web/src/components/ItemRow.tsx     — Single item row
web/src/components/AddItemForm.tsx — Add item form with category picker
web/src/components/PresenceBar.tsx — Online user presence
web/src/components/CategoryDot.tsx — Category color dot
web/src/hooks/useWebSocket.ts     — WebSocket hook with auto-reconnect
web/src/hooks/useTelegram.ts      — Telegram WebApp API hook
```
