type FetchOptions = RequestInit & {
  params?: Record<string, string | number | boolean | undefined>;
};

/**
 * Carries the server's `x-request-id` back to the UI, so a user-visible failure can
 * be traced to the exact server log line ("error id: 4f2c..." in a toast is enough).
 */
export class ApiError extends Error {
  readonly status: number;
  readonly requestId: string | null;
  readonly errors?: Record<string, string[]>;

  constructor(message: string, status: number, requestId: string | null, errors?: Record<string, string[]>) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.requestId = requestId;
    this.errors = errors;
  }
}

const throwApiError = (response: Response, payload: unknown, fallback: string): never => {
  const body = (payload ?? {}) as { message?: string; requestId?: string; errors?: Record<string, string[]> };
  const requestId = response.headers.get("x-request-id") ?? body.requestId ?? null;

  throw new ApiError(body.message || fallback, response.status, requestId, body.errors);
};

class ApiClient {
  private baseURL: string;

  constructor(baseURL: string = "") {
    this.baseURL = baseURL;
  }

  private async request<TResponse, TBody = unknown>(endpoint: string, options: Omit<FetchOptions, "body"> & { body?: TBody | null } = {}): Promise<TResponse> {
    const { params, body, ...fetchOptions } = options;

    let url = `${this.baseURL}${endpoint}`;
    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value));
        }
      });
      const queryString = searchParams.toString();
      if (queryString) {
        url += `?${queryString}`;
      }
    }

    const response = await fetch(url, {
      ...fetchOptions,
      headers: {
        "Content-Type": "application/json",
        ...fetchOptions.headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const data: TResponse = await response.json();

    if (!response.ok) throwApiError(response, data, "An error occurred");

    return data;
  }

  async getExternal<TResponse>(url: string, options?: FetchOptions): Promise<TResponse> {
    const { params, ...fetchOptions } = options ?? {};

    let fullUrl = url;
    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value));
        }
      });
      const queryString = searchParams.toString();
      if (queryString) fullUrl += `?${queryString}`;
    }

    const response = await fetch(fullUrl, { ...fetchOptions });
    const data: TResponse = await response.json();

    if (!response.ok) throwApiError(response, data, "An error occurred");

    return data;
  }

  async getBlob(endpoint: string, options?: FetchOptions): Promise<Blob> {
    const { params, ...fetchOptions } = options ?? {};

    let url = `${this.baseURL}${endpoint}`;
    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value));
        }
      });
      const queryString = searchParams.toString();
      if (queryString) url += `?${queryString}`;
    }

    const response = await fetch(url, { ...fetchOptions });

    if (!response.ok) throwApiError(response, null, `Request failed: ${response.status} ${response.statusText}`);

    return response.blob();
  }

  async get<TResponse>(endpoint: string, options?: FetchOptions): Promise<TResponse> {
    return this.request<TResponse>(endpoint, { ...options, method: "GET" });
  }

  async post<TResponse, TBody extends object>(endpoint: string, body: TBody, options?: FetchOptions): Promise<TResponse> {
    return this.request<TResponse, TBody>(endpoint, { ...options, method: "POST", body });
  }

  async put<TResponse, TBody extends object>(endpoint: string, body: TBody, options?: FetchOptions): Promise<TResponse> {
    return this.request<TResponse, TBody>(endpoint, { ...options, method: "PUT", body });
  }

  async patch<TResponse, TBody extends object>(endpoint: string, body: TBody, options?: FetchOptions): Promise<TResponse> {
    return this.request<TResponse, TBody>(endpoint, { ...options, method: "PATCH", body });
  }

  async delete<TResponse>(endpoint: string, options?: FetchOptions): Promise<TResponse> {
    return this.request<TResponse>(endpoint, { ...options, method: "DELETE" });
  }
}

export const apiClient = new ApiClient("/api");
