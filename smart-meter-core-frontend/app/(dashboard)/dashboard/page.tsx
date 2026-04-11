"use client"

import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useRealtimeEnergy } from "@/hooks/use-realtime-energy"
import { useEnergyStore } from "@/lib/store/use-energy-store"
import { useAuthStore } from "@/lib/store/use-auth-store"
import { useEffect, useState } from "react"
import { Zap, Activity, Battery, CreditCard, TrendingUp, AlertCircle, TrendingDown } from "lucide-react"
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, BarChart, Bar, Legend } from "recharts"

type TimelinePoint = { time: string; usage: number }
type WeeklyComparison = { thisWeek: number; lastWeek: number; change: number }
type CostBreakdown = { peak: number; offPeak: number }

export default function ConsumerDashboard() {
  const { liveData, totalUsageToday, estimatedBill, fetchDashboard } = useEnergyStore()
  const { user, token } = useAuthStore()
  const meterId = user?.meterId

  const [timeline, setTimeline] = useState<TimelinePoint[]>([])
  const [weeklyComparison, setWeeklyComparison] = useState<WeeklyComparison | null>(null)
  const [costBreakdown, setCostBreakdown] = useState<CostBreakdown | null>(null)
  const [costSavings, setCostSavings] = useState(0)

  useRealtimeEnergy()

  useEffect(() => {
    if (!meterId) return
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000"
    fetch(`${apiBaseUrl}/api/consumer/dashboard?meterId=${encodeURIComponent(meterId)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    })
      .then((r) => r.json())
      .then((data) => {
        setTimeline(data.timeline ?? [])
        setWeeklyComparison(data.weeklyComparison ?? null)
        setCostBreakdown(data.costBreakdown ?? null)
        setCostSavings(data.costSavings ?? 0)
        useEnergyStore.setState({ totalUsageToday: data.dailyUsage, estimatedBill: data.estimatedBill })
      })
      .catch(() => {})
  }, [meterId, token])

  const latestReading = liveData[liveData.length - 1]

  const stats = [
    {
      title: "Live Power",
      value: `${latestReading?.usage.toFixed(2) ?? "0.00"} kW`,
      icon: Zap,
      color: "text-primary",
    },
    {
      title: "Voltage",
      value: `${latestReading?.voltage.toFixed(1) ?? "230.0"} V`,
      icon: Activity,
      color: "text-blue-500",
    },
    {
      title: "Energy Today",
      value: `${typeof totalUsageToday === "number" ? totalUsageToday.toFixed(3) : totalUsageToday} kWh`,
      icon: Battery,
      color: "text-green-500",
    },
    {
      title: "Est. Bill",
      value: `₹${typeof estimatedBill === "number" ? estimatedBill.toFixed(2) : estimatedBill}`,
      icon: CreditCard,
      color: "text-orange-500",
    },
  ]

  const weeklyChartData = weeklyComparison
    ? [
        { label: "Last Week", usage: weeklyComparison.lastWeek },
        { label: "This Week", usage: weeklyComparison.thisWeek },
      ]
    : []

  const costBreakdownData = costBreakdown
    ? [
        { name: "Peak (17-21h)", value: costBreakdown.peak },
        { name: "Off-Peak", value: costBreakdown.offPeak },
      ]
    : []

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Consumer Dashboard</h1>
          <p className="text-muted-foreground">Live monitoring for Meter ID: {meterId ?? "MTR-8829-X1"}</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-7">
          {/* Live feed chart */}
          <Card className="col-span-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" />
                Live Power (last 20 readings)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={liveData}>
                    <defs>
                      <linearGradient id="liveGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                    <XAxis
                      dataKey="timestamp"
                      stroke="var(--muted-foreground)"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      interval={4}
                    />
                    <YAxis
                      stroke="var(--muted-foreground)"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => `${v.toFixed(1)}kW`}
                    />
                    <Tooltip
                      contentStyle={{ backgroundColor: "var(--card)", borderColor: "var(--border)", borderRadius: "var(--radius)" }}
                      formatter={(v: number) => [`${v.toFixed(3)} kW`, "Power"]}
                      labelFormatter={(l) => `Time: ${l}`}
                    />
                    <Area type="monotone" dataKey="usage" stroke="var(--primary)" fillOpacity={1} fill="url(#liveGradient)" strokeWidth={2} name="kW" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Savings & alerts */}
          <Card className="col-span-3">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-500" />
                Savings & Alerts
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {costSavings > 0 && (
                <div className="flex items-start gap-3 rounded-lg border p-3 bg-green-500/5 border-green-500/20">
                  <TrendingDown className="h-5 w-5 text-green-500 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Potential Savings Today</p>
                    <p className="text-xs text-muted-foreground">
                      Shift load to off-peak to save <strong>₹{costSavings.toFixed(4)}</strong> today.
                    </p>
                  </div>
                </div>
              )}
              <div className="flex items-start gap-4 rounded-lg border p-3 bg-primary/5 border-primary/20">
                <Lightbulb className="h-5 w-5 text-primary mt-1" />
                <div>
                  <p className="text-sm font-medium">Shift Load to Off-Peak</p>
                  <p className="text-xs text-muted-foreground">
                    Peak hours are 17:00–21:00 IST. Rate: ₹0.25/kWh vs ₹0.12/kWh off-peak.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4 rounded-lg border p-3">
                <AlertCircle className="h-5 w-5 text-orange-500 mt-1" />
                <div>
                  <p className="text-sm font-medium">Phantom Load Detected</p>
                  <p className="text-xs text-muted-foreground">
                    Standby devices consuming ~0.4 kW continuously.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Today's hourly timeline from real data */}
        {timeline.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Today's Hourly Consumption (IST)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={timeline}>
                    <defs>
                      <linearGradient id="timelineGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--chart-2)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="var(--chart-2)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                    <XAxis dataKey="time" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} interval={2} />
                    <YAxis stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${v.toFixed(1)}`} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "var(--card)", borderColor: "var(--border)", borderRadius: "var(--radius)" }}
                      formatter={(v: number) => [`${v.toFixed(3)} kW`, "Avg Power"]}
                    />
                    <Area type="monotone" dataKey="usage" stroke="var(--chart-2)" fill="url(#timelineGradient)" strokeWidth={2} name="Avg kW" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Weekly comparison + cost breakdown */}
        <div className="grid gap-4 md:grid-cols-2">
          {weeklyChartData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Weekly Comparison</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[220px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={weeklyChartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                      <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${v.toFixed(1)}`} />
                      <Tooltip
                        contentStyle={{ backgroundColor: "var(--card)", borderColor: "var(--border)", borderRadius: "var(--radius)" }}
                        formatter={(v: number) => [`${v.toFixed(3)} kWh`, "Avg Daily"]}
                      />
                      <Bar dataKey="usage" fill="var(--primary)" radius={[4, 4, 0, 0]} name="kWh/day" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                {weeklyComparison && (
                  <p className="text-xs text-muted-foreground mt-2 text-center">
                    {weeklyComparison.change >= 0
                      ? `↑ ${weeklyComparison.change.toFixed(3)} kWh/day more than last week`
                      : `↓ ${Math.abs(weeklyComparison.change).toFixed(3)} kWh/day less than last week`}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {costBreakdownData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Cost Breakdown (Last 24h)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[220px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={costBreakdownData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                      <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${v.toFixed(3)}`} />
                      <Tooltip
                        contentStyle={{ backgroundColor: "var(--card)", borderColor: "var(--border)", borderRadius: "var(--radius)" }}
                        formatter={(v: number) => [`₹${v.toFixed(4)}`, "Cost"]}
                      />
                      <Bar dataKey="value" fill="var(--chart-3)" radius={[4, 4, 0, 0]} name="Cost (₹)" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}

function Lightbulb(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .5 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
      <path d="M9 18h6" />
      <path d="M10 22h4" />
    </svg>
  )
}
