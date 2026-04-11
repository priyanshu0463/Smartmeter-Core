import { create } from "zustand"
import { useAuthStore } from "@/lib/store/use-auth-store"

interface EnergyData {
  timestamp: string
  usage: number // kWh
  voltage: number // V
  current: number // A
  frequency: number // Hz
}

interface EnergyState {
  liveData: EnergyData[]
  totalUsageToday: number
  estimatedBill: number
  isLive: boolean
  addLiveData: (data: EnergyData) => void
  setLive: (live: boolean) => void
  setDashboardSummary: (dailyUsage: number, estimatedBill: number) => void
  fetchDashboard: (meterId: string) => Promise<void>
}

export const useEnergyStore = create<EnergyState>((set, get) => ({
  liveData: [],
  totalUsageToday: 12.4,
  estimatedBill: 145.5,
  isLive: true,
  setLive: (live) => set({ isLive: live }),
  addLiveData: (data) =>
    set((state) => {
      const newData = [...state.liveData, data].slice(-20)
      return { liveData: newData }
    }),
  setDashboardSummary: (dailyUsage, estimatedBill) => set({ totalUsageToday: dailyUsage, estimatedBill }),
  fetchDashboard: async (meterId) => {
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000"
    const token = useAuthStore.getState().token

    const res = await fetch(`${apiBaseUrl}/api/consumer/dashboard?meterId=${encodeURIComponent(meterId)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    })
    if (!res.ok) {
      throw new Error(`fetchDashboard failed: ${res.status}`)
    }
    const data = await res.json()
    set({ totalUsageToday: data.dailyUsage, estimatedBill: data.estimatedBill })
  },
}))
