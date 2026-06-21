type FetchOptions = RequestInit & {
  params?: Record<string, string | number | boolean | undefined>;
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

    if (!response.ok) {
      const message = (data as { message?: string }).message || "An error occurred";
      throw new Error(message);
    }

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

    if (!response.ok) {
      const message = (data as { message?: string }).message || "An error occurred";
      throw new Error(message);
    }

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

    if (!response.ok) {
      throw new Error(`Request failed: ${response.status} ${response.statusText}`);
    }

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
