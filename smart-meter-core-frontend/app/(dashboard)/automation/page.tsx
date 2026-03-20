"use client"

import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Zap, Power, Clock, Plus, Settings2 } from "lucide-react"
import { useEffect, useState } from "react"
import { useAuthStore } from "@/lib/store/use-auth-store"

type DeviceCard = { id: string; name: string; room: string; status: boolean; load: string; priority: string }

export default function AutomationPage() {
  const { user, token } = useAuthStore()
  const meterId = user?.meterId
  const [devices, setDevices] = useState<DeviceCard[]>([])

  useEffect(() => {
    if (!meterId) return
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000"
    fetch(`${apiBaseUrl}/api/consumer/devices?meterId=${encodeURIComponent(meterId)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    })
      .then((r) => r.json())
      .then((json) => setDevices((json.devices as DeviceCard[]) ?? []))
      .catch(() => setDevices([]))
  }, [meterId, token])

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Load Control & Automation</h1>
            <p className="text-muted-foreground">Manage your appliances and energy-saving rules.</p>
          </div>
          <Button className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            New Rule
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Connected Appliances</CardTitle>
              <CardDescription>Direct control and real-time load per device.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {devices.map((app) => (
                <div
                  key={app.name}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`h-10 w-10 rounded-full flex items-center justify-center ${app.status ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}
                    >
                      <Power className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{app.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {app.room} • {app.load}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge variant={app.priority === "High" ? "default" : "outline"} className="text-[10px] py-0">
                      {app.priority}
                    </Badge>
                    <Switch checked={app.status} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>AI Automation Rules</CardTitle>
              <CardDescription>Automated actions based on grid price or load limits.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 border border-primary/20 bg-primary/5 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary" />
                    <span className="font-medium text-sm">Peak Shaving Mode</span>
                  </div>
                  <Switch defaultChecked />
                </div>
                <p className="text-xs text-muted-foreground">
                  Automatically turn off "Low" priority devices when grid load exceeds 5.0 kW or prices spike.
                </p>
                <div className="flex gap-2">
                  <Badge variant="secondary" className="text-[10px]">
                    EV Charger
                  </Badge>
                  <Badge variant="secondary" className="text-[10px]">
                    Dishwasher
                  </Badge>
                </div>
              </div>

              <div className="p-4 border rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-orange-500" />
                    <span className="font-medium text-sm">Solar Maximizer</span>
                  </div>
                  <Switch />
                </div>
                <p className="text-xs text-muted-foreground">
                  Activate Water Heater and EV Charger only when solar generation exceeds 2.0 kW.
                </p>
              </div>

              <Button variant="outline" className="w-full text-xs h-8 border-dashed bg-transparent">
                <Settings2 className="h-3 w-3 mr-2" />
                Configure Smart Constraints
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  )
}
