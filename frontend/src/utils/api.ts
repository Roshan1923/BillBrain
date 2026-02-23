const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

class ApiClient {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
  }

  private async request(path: string, options: RequestInit = {}): Promise<any> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const url = `${BACKEND_URL}/api${path}`;
    const res = await fetch(url, { ...options, headers });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ detail: 'Request failed' }));
      throw new Error(error.detail || `HTTP ${res.status}`);
    }

    const contentType = res.headers.get('content-type');
    if (contentType?.includes('text/csv')) {
      return res.text();
    }
    return res.json();
  }

  get(path: string) { return this.request(path); }

  post(path: string, body?: any) {
    return this.request(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined });
  }

  put(path: string, body?: any) {
    return this.request(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined });
  }

  delete(path: string) {
    return this.request(path, { method: 'DELETE' });
  }
}

export const api = new ApiClient();
export { BACKEND_URL };
