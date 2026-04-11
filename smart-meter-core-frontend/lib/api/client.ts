import { useAuthStore } from "@/lib/store/use-auth-store"

const DEFAULT_API_BASE_URL = "http://localhost:8000"
const DEFAULT_WS_BASE_URL = "ws://localhost:8000"

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? DEFAULT_API_BASE_URL
export const WS_BASE_URL = process.env.NEXT_PUBLIC_WS_URL ?? DEFAULT_WS_BASE_URL

export function authHeader(): Record<string, string> {
  const token = useAuthStore.getState().token
  if (!token) return {}
  return { Authorization: `Bearer ${token}` }
}

function buildUrl(path: string) {
  // path is expected to be absolute-ish like "/api/consumer/dashboard"
  return `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`
}

export async function apiGet<T>(path: string) {
  const res = await fetch(buildUrl(path), { headers: authHeader() })
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`GET ${path} failed: ${res.status} ${text}`)
  }
  return (await res.json()) as T
}

export async function apiPost<T>(path: string, body: unknown) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...authHeader(),
  }
  const res = await fetch(buildUrl(path), {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`POST ${path} failed: ${res.status} ${text}`)
  }
  return (await res.json()) as T
}

