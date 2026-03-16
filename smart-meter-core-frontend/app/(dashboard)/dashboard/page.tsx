"use client"

import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useRealtimeEnergy } from "@/hooks/use-realtime-energy"
import { useEnergyStore } from "@/lib/store/use-energy-store"
import { Zap, Activity, Battery, CreditCard, TrendingUp, AlertCircle } from "lucide-react"
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts"

export default function ConsumerDashboard() {
  const { liveData, totalUsageToday, estimatedBill } = useEnergyStore()
  useRealtimeEnergy()

  const stats = [
    {
      title: "Live Power",
      value: `${liveData[liveData.length - 1]?.usage.toFixed(2) || "0.00"} kW`,
      icon: Zap,
      color: "text-primary",
    },
    {
      title: "Voltage",
      value: `${liveData[liveData.length - 1]?.voltage.toFixed(1) || "230.0"} V`,
      icon: Activity,
      color: "text-blue-500",
    },
    { title: "Energy Today", value: `${totalUsageToday} kWh`, icon: Battery, color: "text-green-500" },
    { title: "Est. Bill", value: `$${estimatedBill}`, icon: CreditCard, color: "text-orange-500" },
  ]

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Consumer Dashboard</h1>
          <p className="text-muted-foreground">Live monitoring for Meter ID: MTR-8829-X1</p>
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
          <Card className="col-span-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" />
                Live Power Consumption
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={liveData}>
                    <defs>
                      <linearGradient id="usageGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                    <XAxis dataKey="timestamp" hide />
                    <YAxis stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--card)",
                        borderColor: "var(--border)",
                        borderRadius: "var(--radius)",
                      }}
                      labelStyle={{ color: "var(--foreground)" }}
                    />
                    <Area
                      type="monotone"
                      dataKey="usage"
                      stroke="var(--primary)"
                      fillOpacity={1}
                      fill="url(#usageGradient)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="col-span-3">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-500" />
                Savings Opportunities
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-4 rounded-lg border p-3 bg-primary/5 border-primary/20">
                <Lightbulb className="h-5 w-5 text-primary mt-1" />
                <div>
                  <p className="text-sm font-medium">Shift Load to Off-Peak</p>
                  <p className="text-xs text-muted-foreground">
                    Running your HVAC 2 hours later could save $12 this month.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4 rounded-lg border p-3">
                <AlertCircle className="h-5 w-5 text-orange-500 mt-1" />
                <div>
                  <p className="text-sm font-medium">Phantom Load Detected</p>
                  <p className="text-xs text-muted-foreground">
                    Multiple devices in standby are consuming 0.4kW right now.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  )
}

function Lightbulb(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .5 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
      <path d="M9 18h6" />
      <path d="M10 22h4" />
    </svg>
  )
}
