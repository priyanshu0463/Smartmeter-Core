"use client"

import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { useEnergyStore } from "@/lib/store/use-energy-store"
import { useRealtimeEnergy } from "@/hooks/use-realtime-energy"
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts"

export default function RealTimeMonitoring() {
  const { liveData, isLive, setLive } = useEnergyStore()
  useRealtimeEnergy()

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Real-Time Monitoring</h1>
            <p className="text-muted-foreground">High-frequency data streaming from your smart meter.</p>
          </div>
          <div className="flex items-center space-x-2 bg-card border rounded-lg p-2">
            <Label htmlFor="live-toggle" className="text-sm font-medium">
              Live Feed
            </Label>
            <Switch id="live-toggle" checked={isLive} onCheckedChange={setLive} />
          </div>
        </div>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Voltage Fluctuations (240V Nominal)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={liveData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                    <XAxis dataKey="timestamp" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} interval={4} />
                    <YAxis domain={[220, 245]} stroke="var(--muted-foreground)" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--card)",
                        borderColor: "var(--border)",
                        borderRadius: "var(--radius)",
                      }}
                    />
                    <Line
                      type="step"
                      dataKey="voltage"
                      stroke="var(--chart-2)"
                      strokeWidth={3}
                      dot={false}
                      animationDuration={300}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Current Load Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={liveData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                    <XAxis dataKey="timestamp" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} interval={4} />
                    <YAxis stroke="var(--muted-foreground)" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--card)",
                        borderColor: "var(--border)",
                        borderRadius: "var(--radius)",
                      }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="current"
                      name="Current (A)"
                      stroke="var(--chart-3)"
                      strokeWidth={2}
                      dot={{ r: 2 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="usage"
                      name="Usage (kW)"
                      stroke="var(--primary)"
                      strokeWidth={2}
                      dot={{ r: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  )
}
