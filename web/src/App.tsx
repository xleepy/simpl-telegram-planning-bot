import { useState, useEffect, useCallback, useRef } from 'react';
import { useTelegram, getMockUser } from './hooks/useTelegram';
import { useWebSocket } from './hooks/useWebSocket';
import {
  authenticate,
  authenticateDev,
  apiWithToken,
  AuthResult,
} from './lib/api';
import { ListTabs } from './components/ListTabs';
import { TodoList } from './components/TodoList';
import { AddItemForm } from './components/AddItemForm';
import { PresenceBar } from './components/PresenceBar';
import { ListManager } from './components/ListManager';
import './styles/app.css';

interface ListData {
  id: string;
  name: string;
  createdAt: string;
  createdBy: string;
}

interface ItemData {
  id: string;
  text: string;
  completed: boolean;
  completedBy: string | null;
  createdBy: string;
  category: string;
  createdAt: string;
  updatedAt: string;
}

interface OnlineUser {
  userId: string;
  firstName: string;
}

export default function App() {
  const telegram = useTelegram();

  const [auth, setAuth] = useState<AuthResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lists, setLists] = useState<ListData[]>([]);
  const [activeListId, setActiveListId] = useState<string | null>(null);
  const [items, setItems] = useState<ItemData[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [showListManager, setShowListManager] = useState(false);
  const [loading, setLoading] = useState(true);

  const firstName =
    auth?.user.firstName || telegram.user?.firstName || 'You';

  const activeListIdRef = useRef(activeListId);
  activeListIdRef.current = activeListId;

  const handleWsMessage = useCallback(
    (data: any) => {
      const currentListId = activeListIdRef.current;
      switch (data.type) {
        case 'item_added':
          if (data.listId === currentListId) {
            setItems((prev) => [...prev, data.item]);
          }
          break;
        case 'item_updated':
          if (data.listId === currentListId) {
            setItems((prev) =>
              prev.map((i) => (i.id === data.item.id ? data.item : i))
            );
          }
          break;
        case 'item_deleted':
          if (data.listId === currentListId) {
            setItems((prev) => prev.filter((i) => i.id !== data.itemId));
          }
          break;
        case 'presence':
          setOnlineUsers(data.users || []);
          break;
      }
    },
    []
  );

  const { send: wsSend } = useWebSocket(
    auth?.token || null,
    auth?.chatInstance || '',
    firstName,
    handleWsMessage
  );

  // Auth
  useEffect(() => {
    if (!telegram.isReady) return;

    const doAuth = async () => {
      try {
        setLoading(true);

        if (telegram.isDev) {
          const mockUser = getMockUser();
          const result = await authenticateDev(mockUser, 'dev-chat');
          setAuth(result);
        } else if (telegram.initData) {
          const result = await authenticate(telegram.initData);
          setAuth(result);
        } else {
          setError('Unable to authenticate. Open this app from Telegram.');
        }
      } catch (err: any) {
        setError(err.message || 'Authentication failed');
      } finally {
        setLoading(false);
      }
    };

    doAuth();
  }, [telegram.isReady, telegram.isDev, telegram.initData]);

  // Fetch lists
  useEffect(() => {
    if (!auth) return;
    const api = apiWithToken(auth.token);

    api.getLists().then((result) => {
      setLists(result);
      if (result.length > 0 && !activeListId) {
        setActiveListId(result[0].id);
      }
    }).catch(console.error);
  }, [auth, activeListId]);

  // Fetch items when active list changes
  useEffect(() => {
    if (!auth || !activeListId) return;
    const api = apiWithToken(auth.token);

    api.getItems(activeListId).then(setItems).catch(console.error);
  }, [auth, activeListId]);

  const activeList = lists.find((l) => l.id === activeListId);

  const handleCreateList = async (name: string) => {
    if (!auth) return;
    const api = apiWithToken(auth.token);
    try {
      const list = await api.createList(name);
      setLists((prev) => [...prev, list]);
      setActiveListId(list.id);
      setItems([]);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleRenameList = async (id: string, name: string) => {
    if (!auth) return;
    const api = apiWithToken(auth.token);
    try {
      await api.renameList(id, name);
      setLists((prev) => prev.map((l) => (l.id === id ? { ...l, name } : l)));
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteList = async (id: string) => {
    if (!auth) return;
    const api = apiWithToken(auth.token);
    try {
      await api.deleteList(id);
      setLists((prev) => prev.filter((l) => l.id !== id));
      if (activeListId === id) {
        const remaining = lists.filter((l) => l.id !== id);
        setActiveListId(remaining.length > 0 ? remaining[0].id : null);
        setItems([]);
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleAddItem = async (text: string, category: string) => {
    if (!auth || !activeListId) return;
    const api = apiWithToken(auth.token);
    await api.addItem(activeListId, text, category);
  };

  const handleToggleItem = async (itemId: string, completed: boolean) => {
    if (!auth || !activeListId) return;
    const api = apiWithToken(auth.token);
    await api.updateItem(activeListId, itemId, { completed });
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!auth || !activeListId) return;
    const api = apiWithToken(auth.token);
    await api.deleteItem(activeListId, itemId);
  };

  if (loading) {
    return (
      <div className="app-container">
        <div className="loading-screen">
          <div className="spinner" />
          <p>Loading Trip Planner...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app-container">
        <div className="loading-screen">
          <p className="error">{error}</p>
          <p>Open this app from the Telegram group.</p>
        </div>
      </div>
    );
  }

  const doneCount = items.filter((i) => i.completed).length;

  return (
    <div className={`app-container theme-${telegram.colorScheme}`}>
      <div className="app-header">
        <ListTabs
          lists={lists}
          activeListId={activeListId}
          onSelect={setActiveListId}
          onCreate={() => setShowListManager(true)}
        />
      </div>

      <div className="app-body">
        {activeList ? (
          <>
            <div className="list-stats">
              {items.length > 0 && (
                <span className="stats-text">
                  {doneCount}/{items.length} done
                </span>
              )}
              <button
                className="manage-btn"
                onClick={() => setShowListManager(true)}
              >
                Manage lists
              </button>
            </div>

            <AddItemForm onAdd={handleAddItem} />

            <TodoList
              items={items}
              onToggle={handleToggleItem}
              onDelete={handleDeleteItem}
            />

            <PresenceBar users={onlineUsers} currentUser={firstName} />
          </>
        ) : (
          <div className="empty-state">
            <p>No lists yet.</p>
            <button
              className="create-btn"
              onClick={() => setShowListManager(true)}
            >
              Create your first list
            </button>
          </div>
        )}
      </div>

      {showListManager && (
        <ListManager
          lists={lists}
          activeListId={activeListId}
          onClose={() => setShowListManager(false)}
          onCreate={handleCreateList}
          onRename={handleRenameList}
          onDelete={handleDeleteList}
        />
      )}
    </div>
  );
}
