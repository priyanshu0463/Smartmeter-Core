"use client"

import { useEffect, useRef } from "react"
import { useAutomationStore } from "@/lib/store/use-automation-store"
import { useAuthStore } from "@/lib/store/use-auth-store"

export function useAutomationWs() {
  const { setAlerts, addAlerts, setLoads, addAction } = useAutomationStore()
  const { user, token } = useAuthStore()
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    if (!user?.meterId) return

    const wsBase = (process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8000").replace(/\/ws\/?$/, "")
    const url = `${wsBase}/ws/consumer/alerts/${encodeURIComponent(user.meterId)}?token=${encodeURIComponent(token ?? "")}`

    wsRef.current = new WebSocket(url)

    wsRef.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.loads) setLoads(data.loads)
        if (data.type === "snapshot") {
          setAlerts(data.alerts ?? [])
        } else if (data.type === "update") {
          if (data.new_alerts?.length) addAlerts(data.new_alerts)
          if (data.actions?.length) {
            data.actions.forEach((a: Parameters<typeof addAction>[0]) => addAction(a))
          }
          if (data.active_alerts) setAlerts(data.active_alerts)
        }
      } catch {
        // ignore
      }
    }

    return () => {
      wsRef.current?.close()
      wsRef.current = null
    }
  }, [user?.meterId, token, setAlerts, addAlerts, setLoads, addAction])
}
