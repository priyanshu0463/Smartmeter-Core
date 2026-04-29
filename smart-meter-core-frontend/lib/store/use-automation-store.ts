import { create } from "zustand"

export type AlertSeverity = "critical" | "warning" | "info"

export interface Alert {
  id: string
  meterId: string
  key: string
  severity: AlertSeverity
  message: string
  timestamp: string
  dismissed: boolean
  acknowledged: boolean
}

export interface Load {
  id: string
  name: string
  type: string
  rated_kw: number
  priority: "High" | "Medium" | "Low"
  gpio_pin: number
  status: boolean
  auto_controlled: boolean
  room: string
}

export interface AutomationRule {
  id: string
  name: string
  description: string
  enabled: boolean
  trigger_keys: string[]
  action: "turn_off" | "turn_on"
  target_priorities: string[]
  target_load_ids: string[]
  created_at: string
}

export interface AutomationAction {
  rule_id: string
  rule_name: string
  load_id: string
  load_name: string
  action: string
  reason: string
  timestamp: string
}

interface AutomationState {
  alerts: Alert[]
  loads: Load[]
  rules: AutomationRule[]
  recentActions: AutomationAction[]
  setAlerts: (alerts: Alert[]) => void
  addAlerts: (alerts: Alert[]) => void
  setLoads: (loads: Load[]) => void
  setRules: (rules: AutomationRule[]) => void
  addAction: (action: AutomationAction) => void
  dismissAlert: (id: string) => void
  toggleRule: (id: string) => void
}

export const useAutomationStore = create<AutomationState>((set) => ({
  alerts: [],
  loads: [],
  rules: [],
  recentActions: [],

  setAlerts: (alerts) => set({ alerts }),
  addAlerts: (newAlerts) =>
    set((s) => {
      const existing = new Set(s.alerts.map((a) => a.id))
      const merged = [...s.alerts, ...newAlerts.filter((a) => !existing.has(a.id))]
      return { alerts: merged.filter((a) => !a.dismissed).slice(0, 50) }
    }),
  setLoads: (loads) => set({ loads }),
  setRules: (rules) => set({ rules }),
  addAction: (action) =>
    set((s) => ({ recentActions: [action, ...s.recentActions].slice(0, 20) })),
  dismissAlert: (id) =>
    set((s) => ({ alerts: s.alerts.filter((a) => a.id !== id) })),
  toggleRule: (id) =>
    set((s) => ({
      rules: s.rules.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)),
    })),
}))
