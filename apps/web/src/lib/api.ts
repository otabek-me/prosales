const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8001/api/v1';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('access_token');
}

export function setToken(token: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('access_token', token);
}

export function clearToken() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('access_token');
}

export function getOrgId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('org_id');
}

export function setOrgId(id: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('org_id', id);
}

export async function fetchAPI(
  path: string,
  options: RequestInit = {}
): Promise<any> {
  const token = getToken();
  const orgId = getOrgId();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (orgId) headers['X-Organization-Id'] = orgId;

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    clearToken();
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
    throw new Error('Unauthorized');
  }

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(data?.error?.message || data?.detail || `API Error ${res.status}`);
  }

  return data;
}

export async function apiGet(path: string) {
  return fetchAPI(path, { method: 'GET' });
}

export async function apiPost(path: string, body?: any) {
  return fetchAPI(path, {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  });
}

export async function apiPut(path: string, body?: any) {
  return fetchAPI(path, {
    method: 'PUT',
    body: body ? JSON.stringify(body) : undefined,
  });
}

export async function apiDelete(path: string) {
  return fetchAPI(path, { method: 'DELETE' });
}
