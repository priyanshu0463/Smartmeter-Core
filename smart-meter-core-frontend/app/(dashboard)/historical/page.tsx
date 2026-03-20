"use client"

import { useState, useEffect } from "react"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Calendar, TrendingUp, TrendingDown, Download } from "lucide-react"
import { useAuthStore } from "@/lib/store/use-auth-store"
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts"

type TimeRange = "day" | "week" | "month" | "year"

type HistoryPoint = {
  label: string
  usage: number
  cost: number
  temperature: number
  peakDemand: number
}

export default function HistoricalPage() {
  const { user, token } = useAuthStore()
  const [timeRange, setTimeRange] = useState<TimeRange>("day")
  const [data, setData] = useState<HistoryPoint[]>([])

  useEffect(() => {
    const meterId = user?.meterId
    if (!meterId) return

    const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000"
    const url = `${apiBaseUrl}/api/consumer/history?meterId=${encodeURIComponent(meterId)}&range=${timeRange}`
    setData([])

    fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    })
      .then((r) => {
        if (!r.ok) throw new Error(`history fetch failed: ${r.status}`)
        return r.json()
      })
      .then((json) => setData(json.data as HistoryPoint[]))
      .catch(() => setData([]))
  }, [timeRange, user?.meterId, token])

  // <CHANGE> Calculate summary statistics

  const totalUsage = data.reduce((sum, d) => sum + d.usage, 0)
  const totalCost = data.reduce((sum, d) => sum + d.cost, 0)
  const avgUsage = data.length ? totalUsage / data.length : 0
  const maxUsage = data.length ? Math.max(...data.map((d) => d.usage)) : 0
  const avgCostPerUnit = totalUsage ? totalCost / totalUsage : 0

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Historical Analysis</h1>
            <p className="text-muted-foreground">Deep dive into your energy consumption patterns.</p>
          </div>
          <Button variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Export Data
          </Button>
        </div>

        {/* <CHANGE> Time range selector */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                Select Time Range
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRange)}>
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="day">24 Hours</TabsTrigger>
                <TabsTrigger value="week">7 Days</TabsTrigger>
                <TabsTrigger value="month">30 Days</TabsTrigger>
                <TabsTrigger value="year">12 Months</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardContent>
        </Card>

        {/* <CHANGE> Summary statistics cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Usage</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalUsage.toFixed(1)} kWh</div>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                <TrendingUp className="h-3 w-3 text-green-500" />
                {timeRange === "day" ? "Per day" : timeRange === "week" ? "Per week" : timeRange === "month" ? "Per month" : "Per year"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${totalCost.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                ${avgCostPerUnit.toFixed(3)}/kWh average
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Average Load</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{avgUsage.toFixed(2)} kW</div>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                Baseline consumption
              </p>
            </CardContent>
          </Card>
          <Card className="border-primary/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Peak Demand</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{maxUsage.toFixed(2)} kW</div>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                <TrendingDown className="h-3 w-3 text-destructive" />
                Highest recorded
              </p>
            </CardContent>
          </Card>
        </div>

        {/* <CHANGE> Energy usage chart */}
        <Card>
          <CardHeader>
            <CardTitle>Energy Consumption Trend</CardTitle>
            <CardDescription>Historical usage data with cost overlay</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[400px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data}>
                  <defs>
                    <linearGradient id="usageGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis
                    dataKey="label"
                    stroke="var(--muted-foreground)"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    yAxisId="left"
                    stroke="var(--muted-foreground)"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    label={{ value: "kWh", angle: -90, position: "insideLeft" }}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    stroke="var(--muted-foreground)"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    label={{ value: "$", angle: 90, position: "insideRight" }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--card)",
                      borderColor: "var(--border)",
                      borderRadius: "var(--radius)",
                    }}
                  />
                  <Legend />
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="usage"
                    fill="url(#usageGradient)"
                    stroke="var(--primary)"
                    strokeWidth={2}
                    name="Usage (kWh)"
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="cost"
                    stroke="var(--chart-3)"
                    strokeWidth={2}
                    dot={false}
                    name="Cost ($)"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* <CHANGE> Peak demand and temperature correlation */}
        <Card>
          <CardHeader>
            <CardTitle>Peak Demand vs Temperature</CardTitle>
            <CardDescription>Correlation between ambient temperature and energy demand</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis
                    dataKey="label"
                    stroke="var(--muted-foreground)"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    yAxisId="left"
                    stroke="var(--muted-foreground)"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    stroke="var(--muted-foreground)"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--card)",
                      borderColor: "var(--border)",
                      borderRadius: "var(--radius)",
                    }}
                  />
                  <Legend />
                  <Bar yAxisId="left" dataKey="peakDemand" fill="var(--chart-2)" name="Peak Demand (kW)" radius={[4, 4, 0, 0]} />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="temperature"
                    stroke="var(--destructive)"
                    strokeWidth={2}
                    name="Temperature (°C)"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
