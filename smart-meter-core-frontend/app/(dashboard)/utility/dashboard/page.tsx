"use client"

import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts"
import { TrendingUp } from "lucide-react"

const regionalData = [
  { region: "North", activeMeters: 1240, load: 3400, anomalies: 12 },
  { region: "South", activeMeters: 1890, load: 4200, anomalies: 4 },
  { region: "East", activeMeters: 850, load: 2100, anomalies: 18 },
  { region: "West", activeMeters: 2100, load: 5600, anomalies: 3 },
  { region: "Central", activeMeters: 1100, load: 2800, anomalies: 7 },
]

const consumerSegmentation = [
  { name: "Residential", value: 65, color: "var(--chart-1)" },
  { name: "Commercial", value: 25, color: "var(--chart-2)" },
  { name: "Industrial", value: 10, color: "var(--chart-3)" },
]

export default function UtilityDashboard() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Utility Command Center</h1>
          <p className="text-muted-foreground">Aggregated grid metrics and regional load analysis.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Online Meters</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">7,180</div>
              <div className="flex items-center gap-1 text-xs text-green-500 mt-1">
                <TrendingUp className="h-3 w-3" />
                98.4% uptime
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Aggregate Load</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">18.1 MW</div>
              <p className="text-xs text-muted-foreground mt-1">Peak demand expected at 19:00</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Active Anomalies</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">44</div>
              <p className="text-xs text-muted-foreground mt-1">12 high-risk fraud alerts</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Regional Coverage</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">5 Zones</div>
              <p className="text-xs text-muted-foreground mt-1">All substations reporting</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Regional Load Analysis</CardTitle>
              <CardDescription>Power demand across distribution zones.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={regionalData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                    <XAxis dataKey="region" />
                    <YAxis />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--card)",
                        borderColor: "var(--border)",
                        borderRadius: "var(--radius)",
                      }}
                    />
                    <Legend />
                    <Bar dataKey="load" name="Load (kW)" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="activeMeters" name="Online Meters" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Consumer Segmentation</CardTitle>
              <CardDescription>Grid distribution by customer category.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center">
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={consumerSegmentation}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {consumerSegmentation.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-3 gap-4 w-full mt-4 text-center">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Efficiency</p>
                  <p className="text-sm font-bold">92%</p>
                </div>
                <div className="space-y-1 border-x">
                  <p className="text-xs text-muted-foreground">Revenue</p>
                  <p className="text-sm font-bold">$4.2M</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Losses</p>
                  <p className="text-sm font-bold text-destructive">4.1%</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  )
}
