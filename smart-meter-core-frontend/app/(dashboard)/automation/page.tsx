"use client"

import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { useAutomationStore } from "@/lib/store/use-automation-store"
import { useAutomationWs } from "@/hooks/use-automation-ws"
import { useAuthStore } from "@/lib/store/use-auth-store"
import { useEffect, useCallback } from "react"
import {
  AlertTriangle, Bell, BellOff, CheckCircle2, Info,
  Lightbulb, Power, RefreshCw, ShieldAlert, Thermometer, Wind, Zap,
} from "lucide-react"
import type { Alert, Load, AutomationRule, AutomationAction } from "@/lib/store/use-automation-store"

const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000"

function severityColor(s: Alert["severity"]): "destructive" | "secondary" | "outline" {
  if (s === "critical") return "destructive"
  if (s === "warning") return "secondary"
  return "outline"
}

function severityIcon(s: Alert["severity"]) {
  if (s === "critical") return <ShieldAlert className="h-4 w-4 text-destructive" />
  if (s === "warning") return <AlertTriangle className="h-4 w-4 text-yellow-500" />
  return <Info className="h-4 w-4 text-blue-500" />
}

function loadIcon(type: string) {
  if (type === "hvac") return <Wind className="h-4 w-4" />
  if (type === "water_heater") return <Thermometer className="h-4 w-4" />
  if (type === "light") return <Lightbulb className="h-4 w-4" />
  return <Zap className="h-4 w-4" />
}

function priorityBadge(p: Load["priority"]) {
  const map: Record<Load["priority"], string> = {
    High: "bg-red-500/10 text-red-600 border-red-500/20",
    Medium: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
    Low: "bg-green-500/10 text-green-600 border-green-500/20",
  }
  return <span className={"text-xs px-2 py-0.5 rounded-full border font-medium " + map[p]}>{p}</span>
}

function fmtTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
  } catch {
    return iso
  }
}

export default function AutomationPage() {
  const { user, token } = useAuthStore()
  const meterId = user?.meterId
  const { alerts, loads, rules, recentActions, dismissAlert, setLoads, setRules, toggleRule } = useAutomationStore()

  useAutomationWs()

  useEffect(() => {
    if (!meterId) return
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}

    fetch(`${API}/api/consumer/loads?meterId=${encodeURIComponent(meterId)}`, { headers })
      .then((r) => r.json())
      .then((d) => setLoads(d.loads ?? []))
      .catch(() => {})

    fetch(`${API}/api/consumer/automation/rules?meterId=${encodeURIComponent(meterId)}`, { headers })
      .then((r) => r.json())
      .then((d) => setRules(d.rules ?? []))
      .catch(() => {})
  }, [meterId, token, setLoads, setRules])

  const handleDismiss = useCallback(
    async (alertId: string) => {
      dismissAlert(alertId)
      await fetch(`${API}/api/consumer/alerts/${alertId}/dismiss`, { method: "POST" }).catch(() => {})
    },
    [dismissAlert],
  )

  const handleLoadToggle = useCallback(
    async (loadId: string, newStatus: boolean) => {
      if (!meterId) return
      const headers: Record<string, string> = { "Content-Type": "application/json" }
      if (token) headers["Authorization"] = `Bearer ${token}`
      const res = await fetch(
        `${API}/api/consumer/loads/${loadId}/control?meterId=${encodeURIComponent(meterId)}`,
        { method: "POST", headers, body: JSON.stringify({ status: newStatus, manual: true }) },
      ).catch(() => null)
      if (res?.ok) {
        const d = await res.json()
        setLoads(loads.map((l: Load) => (l.id === loadId ? d.load : l)))
      }
    },
    [meterId, token, loads, setLoads],
  )

  const handleRuleToggle = useCallback(
    async (rule: AutomationRule) => {
      toggleRule(rule.id)
      const headers: Record<string, string> = { "Content-Type": "application/json" }
      if (token) headers["Authorization"] = `Bearer ${token}`
      await fetch(
        `${API}/api/consumer/automation/rules/${rule.id}?meterId=${encodeURIComponent(meterId ?? "")}`,
        { method: "PATCH", headers, body: JSON.stringify({ enabled: !rule.enabled }) },
      ).catch(() => {})
    },
    [token, meterId, toggleRule],
  )

  const criticalCount = alerts.filter((a: Alert) => a.severity === "critical").length
  const warningCount = alerts.filter((a: Alert) => a.severity === "warning").length
  const activeLoads = loads.filter((l: Load) => l.status)
  const totalActivekW = activeLoads.reduce((s: number, l: Load) => s + l.rated_kw, 0)

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Load Control & Automation</h1>
            <p className="text-muted-foreground">Real-time alerts, load shifting, and automation rules.</p>
          </div>
          <div className="flex items-center gap-3">
            {criticalCount > 0 && (
              <Badge variant="destructive" className="gap-1">
                <ShieldAlert className="h-3 w-3" />
                {criticalCount} Critical
              </Badge>
            )}
            {warningCount > 0 && (
              <Badge variant="secondary" className="gap-1">
                <AlertTriangle className="h-3 w-3" />
                {warningCount} Warning
              </Badge>
            )}
          </div>
        </div>

        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          {[
            { label: "Active Loads", value: `${activeLoads.length}/${loads.length}` },
            { label: "Active Power", value: `${totalActivekW.toFixed(2)} kW` },
            { label: "Active Alerts", value: String(alerts.length) },
            { label: "Rules Active", value: `${rules.filter((r: AutomationRule) => r.enabled).length}/${rules.length}` },
          ].map((s) => (
            <Card key={s.label} className="p-4">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="text-2xl font-bold">{s.value}</p>
            </Card>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-4 w-4" /> Live Alerts
                </CardTitle>
                {alerts.length === 0 && (
                  <span className="flex items-center gap-1 text-xs text-green-600">
                    <CheckCircle2 className="h-3 w-3" /> All clear
                  </span>
                )}
              </div>
              <CardDescription>Threshold-based alerts from the virtual smart meter.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 max-h-80 overflow-y-auto">
              {alerts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-2">
                  <BellOff className="h-8 w-8 opacity-30" />
                  <p className="text-sm">No active alerts</p>
                </div>
              ) : (
                alerts.map((alert: Alert) => (
                  <div
                    key={alert.id}
                    className={`flex items-start justify-between p-3 rounded-lg border gap-3 ${
                      alert.severity === "critical"
                        ? "border-destructive/40 bg-destructive/5"
                        : alert.severity === "warning"
                          ? "border-yellow-500/40 bg-yellow-500/5"
                          : "border-blue-500/20 bg-blue-500/5"
                    }`}
                  >
                    <div className="flex items-start gap-2 flex-1 min-w-0">
                      {severityIcon(alert.severity)}
                      <div className="min-w-0">
                        <p className="text-xs font-medium leading-snug">{alert.message}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{fmtTime(alert.timestamp)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Badge variant={severityColor(alert.severity)} className="text-[10px] py-0 px-1.5">
                        {alert.severity}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => handleDismiss(alert.id)}
                        title="Dismiss"
                      >
                        <CheckCircle2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <Power className="h-4 w-4" /> Load Control
              </CardTitle>
              <CardDescription>Toggle loads manually or let automation rules manage them.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {loads.map((load: Load) => (
                <div
                  key={load.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/40 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`h-9 w-9 rounded-full flex items-center justify-center ${
                        load.status ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {loadIcon(load.type)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm">{load.name}</p>
                        {load.auto_controlled && (
                          <span className="text-[10px] text-orange-500 border border-orange-500/30 rounded px-1">
                            auto
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {load.room} • {load.rated_kw} kW • GPIO {load.gpio_pin}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {priorityBadge(load.priority)}
                    <Switch checked={load.status} onCheckedChange={(v) => handleLoadToggle(load.id, v)} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4" /> Automation Rules
              </CardTitle>
              <CardDescription>Rules that auto-control loads based on alerts.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {rules.map((rule: AutomationRule) => (
                <div
                  key={rule.id}
                  className={`p-4 border rounded-lg space-y-2 transition-colors ${
                    rule.enabled ? "border-primary/20 bg-primary/5" : "opacity-60"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-sm">{rule.name}</p>
                    <Switch checked={rule.enabled} onCheckedChange={() => handleRuleToggle(rule)} />
                  </div>
                  <p className="text-xs text-muted-foreground">{rule.description}</p>
                  <div className="flex flex-wrap gap-1">
                    {rule.trigger_keys.map((k: string) => (
                      <Badge key={k} variant="outline" className="text-[10px] py-0">
                        {k}
                      </Badge>
                    ))}
                    <Badge
                      variant={rule.action === "turn_off" ? "destructive" : "secondary"}
                      className="text-[10px] py-0"
                    >
                      {rule.action === "turn_off" ? "→ OFF" : "→ ON"}
                    </Badge>
                    {rule.target_priorities.map((p: string) => (
                      <Badge key={p} variant="outline" className="text-[10px] py-0">
                        {p} priority
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-4 w-4" /> Automation Log
              </CardTitle>
              <CardDescription>Actions taken by automation rules in this session.</CardDescription>
            </CardHeader>
            <CardContent className="max-h-72 overflow-y-auto space-y-2">
              {recentActions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-2">
                  <CheckCircle2 className="h-8 w-8 opacity-30" />
                  <p className="text-sm">No actions yet</p>
                </div>
              ) : (
                recentActions.map((action: AutomationAction, i: number) => (
                  <div key={i} className="flex items-start gap-3 p-2 rounded-lg border text-xs">
                    <div
                      className={`mt-0.5 h-2 w-2 rounded-full shrink-0 ${
                        action.action === "turned_off" ? "bg-red-500" : "bg-green-500"
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">
                        {action.load_name}{" "}
                        <span className={action.action === "turned_off" ? "text-red-500" : "text-green-500"}>
                          {action.action}
                        </span>
                      </p>
                      <p className="text-muted-foreground truncate">{action.rule_name}</p>
                    </div>
                    <p className="text-muted-foreground shrink-0">{fmtTime(action.timestamp)}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  )
}
