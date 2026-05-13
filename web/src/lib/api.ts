export interface TelegramUser {
  id: number;
  firstName: string;
  lastName?: string;
  username?: string;
}

export interface AuthResult {
  token: string;
  user: TelegramUser;
  chatInstance: string;
}

const API_BASE = '/api';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }

  return res.json();
}

export function getAuthHeader(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

export async function authenticate(initData: string): Promise<AuthResult> {
  return request<AuthResult>('/auth', {
    method: 'POST',
    body: JSON.stringify({ initData }),
  });
}

export async function authenticateDev(user: TelegramUser, chatInstance: string): Promise<AuthResult> {
  return request<AuthResult>('/auth', {
    method: 'POST',
    body: JSON.stringify({ devUser: { ...user, chatInstance } }),
  });
}

export function apiWithToken(token: string) {
  const headers = getAuthHeader(token);

  return {
    getLists: () => request<any[]>('/lists', { headers }),

    createList: (name: string) =>
      request<any>('/lists', {
        method: 'POST',
        headers,
        body: JSON.stringify({ name }),
      }),

    renameList: (id: string, name: string) =>
      request<any>(`/lists/${id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ name }),
      }),

    deleteList: (id: string) =>
      request<any>(`/lists/${id}`, { method: 'DELETE', headers }),

    getItems: (listId: string) =>
      request<any[]>(`/lists/${listId}/items`, { headers }),

    addItem: (listId: string, text: string, category: string = 'other') =>
      request<any>(`/lists/${listId}/items`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ text, category }),
      }),

    updateItem: (listId: string, itemId: string, updates: Record<string, unknown>) =>
      request<any>(`/lists/${listId}/items/${itemId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(updates),
      }),

    deleteItem: (listId: string, itemId: string) =>
      request<any>(`/lists/${listId}/items/${itemId}`, {
        method: 'DELETE',
        headers,
      }),
  };
}
