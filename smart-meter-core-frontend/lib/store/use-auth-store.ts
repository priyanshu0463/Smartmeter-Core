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
  isAuthenticated: boolean
  login: (email: string, role: UserRole, meterId?: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      login: (email, role, meterId) => {
        // Mock login logic
        const mockUser: User = {
          id: Math.random().toString(36).substring(7),
          email,
          name: email.split("@")[0],
          role,
          meterId: role === "CONSUMER" ? meterId || "MTR-8829-X1" : undefined,
        }
        set({ user: mockUser, isAuthenticated: true })
      },
      logout: () => set({ user: null, isAuthenticated: false }),
    }),
    {
      name: "smartmeter-auth-storage",
    },
  ),
)
