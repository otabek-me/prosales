// Normalize: drop any trailing slash so `${API_BASE}${path}` never produces a double `//`
const API_BASE = (process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8001/api/v1').replace(/\/+$/, '');

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
    // Always fetch fresh data from the API — never serve a stale prerendered/cache result
    cache: 'no-store',
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

export function getApiBase(): string {
  return (process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8001/api/v1').replace(/\/+$/, '');
}

/**
 * Serverdagi /uploads/... yo'lini to'liq URL manzilga aylantiradi
 */
export function getFileUrl(pathOrUrl: string | null | undefined): string {
  if (!pathOrUrl) return '';
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
    return pathOrUrl;
  }
  const base = getApiBase().replace(/\/api\/v1$/, '');
  const cleanPath = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
  return `${base}${cleanPath}`;
}

/**
 * Katta hajmdagi rasm va videolarni real-time Progress Bar (0% - 100%) bilan yuklash
 */
export function uploadFileWithProgress(
  path: string,
  file: File,
  onProgress?: (percent: number, loaded: number, total: number) => void
): Promise<any> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const token = getToken();
    const orgId = getOrgId();
    const url = `${API_BASE}${path}`;

    xhr.open('POST', url);

    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    if (orgId) xhr.setRequestHeader('X-Organization-Id', orgId);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        const percent = Math.round((event.loaded / event.total) * 100);
        onProgress(percent, event.loaded, event.total);
      }
    };

    xhr.onload = () => {
      if (xhr.status === 401) {
        clearToken();
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
        reject(new Error('Unauthorized'));
        return;
      }

      let data: any = null;
      try {
        data = JSON.parse(xhr.responseText);
      } catch (e) {
        data = null;
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(data);
      } else {
        const errorMsg = data?.error?.message || data?.detail || `Yuklashda xatolik yuz berdi (${xhr.status})`;
        reject(new Error(errorMsg));
      }
    };

    xhr.onerror = () => {
      reject(new Error('Internet yoki tarmoq xatosi tufayli fayl yuklanmadi'));
    };

    const formData = new FormData();
    formData.append('file', file);
    xhr.send(formData);
  });
}
