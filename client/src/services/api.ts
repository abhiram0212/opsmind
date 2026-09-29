export class ApiError extends Error {
  constructor(message: string, readonly status: number) { super(message); this.name = 'ApiError'; }
}

export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  });
  const result = await response.json() as { success: boolean; data?: T; error?: { message: string } };
  if (!response.ok || !result.success || result.data === undefined) {
    throw new ApiError(result.error?.message ?? `Request failed (${response.status})`, response.status);
  }
  return result.data;
}

export const post = <T>(path: string, body?: unknown): Promise<T> => api<T>(path, {
  method: 'POST', ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});