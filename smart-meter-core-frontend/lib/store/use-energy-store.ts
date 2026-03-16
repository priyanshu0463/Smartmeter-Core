import { create } from "zustand"

interface EnergyData {
  timestamp: string
  usage: number // kWh
  voltage: number // V
  current: number // A
  frequency: number // Hz
}

interface EnergyState {
  liveData: EnergyData[]
  historicalData: EnergyData[]
  totalUsageToday: number
  estimatedBill: number
  isLive: boolean
  addLiveData: (data: EnergyData) => void
  setLive: (live: boolean) => void
  fetchHistorical: (range: "day" | "week" | "month") => void
}

export const useEnergyStore = create<EnergyState>((set, get) => ({
  liveData: [],
  historicalData: [],
  totalUsageToday: 12.4,
  estimatedBill: 145.5,
  isLive: true,
  setLive: (live) => set({ isLive: live }),
  addLiveData: (data) =>
    set((state) => {
      const newData = [...state.liveData, data].slice(-20)
      return { liveData: newData }
    }),
  fetchHistorical: (range) => {
    // Mock historical data generation
    const count = range === "day" ? 24 : range === "week" ? 7 : 30
    const mockHistory = Array.from({ length: count }, (_, i) => ({
      timestamp: new Date(Date.now() - i * 3600000).toISOString(),
      usage: Math.random() * 5 + 1,
      voltage: 230 + (Math.random() - 0.5) * 5,
      current: Math.random() * 10,
      frequency: 50 + (Math.random() - 0.5) * 0.2,
    })).reverse()
    set({ historicalData: mockHistory })
  },
}))
