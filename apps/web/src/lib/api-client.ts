export const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api";
export const fileBaseUrl = apiBaseUrl.replace(/\/api\/?$/, "");

export interface ApiErrorBody {
  error?: {
    message?: string;
  };
}

export interface AuthUser {
  id: number;
  username: string;
  email: string;
  fullName: string;
  role: "student" | "teacher" | "coach" | "admin";
}

export function getStoredToken() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem("lms_token");
}

export function getStoredUser(): AuthUser | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem("lms_user");
  return raw ? (JSON.parse(raw) as AuthUser) : null;
}

export function storeSession(token: string, user: AuthUser) {
  window.localStorage.setItem("lms_token", token);
  window.localStorage.setItem("lms_user", JSON.stringify(user));
}

export function clearSession() {
  window.localStorage.removeItem("lms_token");
  window.localStorage.removeItem("lms_user");
}

export async function apiRequest<TResponse>(
  path: string,
  options: RequestInit & { auth?: boolean } = {}
): Promise<TResponse> {
  const headers = new Headers(options.headers);
  const isFormData = options.body instanceof FormData;

  headers.set("Accept", "application/json");
  if (!isFormData && options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const token = getStoredToken();
  if (options.auth !== false && token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers,
    cache: "no-store"
  });

  if (!response.ok) {
    let message = `API request failed with status ${response.status}`;
    try {
      const body = (await response.json()) as ApiErrorBody;
      message = body.error?.message ?? message;
    } catch {
      // Keep the status-based fallback.
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as TResponse;
  }

  return response.json() as Promise<TResponse>;
}

export interface HealthResponse {
  status: "ok";
}
