import { create } from "zustand"
import { persist } from "zustand/middleware"

export type UserRole = "CONSUMER" | "UTILITY" | "ADMIN"

export interface User {
  id: string
  email: string
  name: string
  role: UserRole
  meterId?: string
}

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  login: (email: string, role: UserRole, meterId?: string) => Promise<void>
  logout: () => Promise<void>
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      login: async (email, role, meterId) => {
        const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000"
        const payload = {
          email,
          password: "password123",
          role,
          meterId: role === "CONSUMER" ? meterId || "MTR-8829-X1" : undefined,
        }

        const res = await fetch(`${apiBaseUrl}/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })

        if (!res.ok) {
          const text = await res.text().catch(() => "")
          throw new Error(`Login failed: ${res.status} ${text}`)
        }

        const data = (await res.json()) as {
          token: string
          user: User
          expiresIn: number
        }

        set({ user: data.user, token: data.token, isAuthenticated: true })
      },
      logout: async () => {
        const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000"
        const state = useAuthStore.getState()
        try {
          await fetch(`${apiBaseUrl}/auth/logout`, {
            method: "POST",
            headers: state.token ? { Authorization: `Bearer ${state.token}` } : undefined,
          })
        } finally {
          set({ user: null, token: null, isAuthenticated: false })
        }
      },
    }),
    {
      name: "smartmeter-auth-storage",
    },
  ),
)
