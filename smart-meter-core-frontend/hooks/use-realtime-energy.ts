"use client"

import { useEffect, useRef } from "react"
import { useEnergyStore } from "@/lib/store/use-energy-store"

export function useRealtimeEnergy() {
  const { addLiveData, isLive } = useEnergyStore()
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (isLive) {
      intervalRef.current = setInterval(() => {
        const newData = {
          timestamp: new Date().toLocaleTimeString(),
          usage: Math.random() * 2 + 0.5,
          voltage: 230 + (Math.random() - 0.5) * 4,
          current: Math.random() * 8 + 1,
          frequency: 50 + (Math.random() - 0.5) * 0.1,
        }
        addLiveData(newData)
      }, 3000)
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [isLive, addLiveData])

  return { isLive }
}
