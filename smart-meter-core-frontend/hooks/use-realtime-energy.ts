"use client"

import { useEffect, useRef } from "react"
import { useEnergyStore } from "@/lib/store/use-energy-store"
import { useAuthStore } from "@/lib/store/use-auth-store"

export function useRealtimeEnergy() {
  const { addLiveData, isLive } = useEnergyStore()
  const { user, token } = useAuthStore()
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    if (!isLive || !user?.meterId) return

    const wsBaseUrl = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8000"
    // README's env var may include a trailing `/ws`. Normalize to host/base.
    const wsBase = wsBaseUrl.replace(/\/ws\/?$/, "")
    const url = `${wsBase}/ws/consumer/realtime/${encodeURIComponent(user.meterId)}?token=${encodeURIComponent(
      token ?? "",
    )}`

    wsRef.current = new WebSocket(url)

    wsRef.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        addLiveData({
          timestamp: data.timestamp,
          usage: data.usage,
          voltage: data.voltage,
          current: data.current,
          frequency: data.frequency,
        })
      } catch {
        // Ignore malformed messages.
      }
    }

    wsRef.current.onerror = () => {
      // Connection errors are handled implicitly by closing below.
    }

    return () => {
      if (wsRef.current) wsRef.current.close()
      wsRef.current = null
    }
  }, [isLive, addLiveData, user?.meterId, token])

  return { isLive }
}
